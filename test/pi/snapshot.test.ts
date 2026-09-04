import type { AgentMessage, StreamFn } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, StopReason } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it } from "vitest";

import { createPiSession, type PiSessionOptions } from "../../src/pi/session.ts";
import { memoryStorage } from "../../src/pi/storage.ts";
import {
  PI_SNAPSHOT_FIELDS,
  PI_SNAPSHOT_VERSION,
  type PiSnapshot,
  readPiSnapshot,
  usablePiMessages,
} from "../../src/pi/snapshot.ts";

const turn = (content: AssistantMessage["content"], stopReason: StopReason): AssistantMessage => ({
  role: "assistant",
  content,
  api: "openai-completions",
  provider: "ovhcloud",
  model: "gpt-oss-20b",
  usage: {
    input: 10,
    output: 5,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 15,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason,
  timestamp: 0,
});

/** Replays one prepared message per request, and counts what was asked. */
const scripted = (script: AssistantMessage[]) => {
  let index = 0;
  const streamFn: StreamFn = () => {
    const message = script[Math.min(index, script.length - 1)];
    index += 1;
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
    stream.end(message);
    return stream;
  };
  return { requests: () => index, streamFn };
};

const answer = turn([{ type: "text", text: "Two plans." }], "stop");
const named = turn([{ type: "text", text: "Plans on this page" }], "stop");

const asked = (text: string): AgentMessage => ({
  role: "user",
  content: [{ type: "text", text }],
  timestamp: 0,
});

const called = (id: string): AgentMessage =>
  turn([{ type: "toolCall", id, name: "read_page", arguments: {} }], "toolUse");

const answered = (id: string): AgentMessage => ({
  role: "toolResult",
  toolCallId: id,
  toolName: "read_page",
  content: [{ type: "text", text: "the page" }],
  isError: false,
  timestamp: 0,
});

const failed: AgentMessage = { ...turn([], "stop"), errorMessage: "the provider said no" };

/** Free, and its catalog carries a reasoning model beside a plain one. */
const THINKS = "ovhcloud";
const REASONING_MODEL = "gpt-oss-20b";
const PLAIN_MODEL = "Qwen3-Coder-30B-A3B-Instruct";

/** Free too, and the provider the default model belongs to. */
const DEFAULT_PROVIDER = "llm7";
const OTHER_DEFAULT_MODEL = "codestral-latest";

const snapshot = (fields: Partial<PiSnapshot> = {}): PiSnapshot => ({
  messages: [],
  version: PI_SNAPSHOT_VERSION,
  ...fields,
});

/**
 * One store per test, shared by the sessions in it: what a session picks is
 * there for the next one, and no test opens on what another left.
 */
let storage = memoryStorage();
beforeEach(() => {
  storage = memoryStorage();
});
const piSession = (options: PiSessionOptions = {}) => createPiSession({ storage, ...options });

describe("usablePiMessages", () => {
  it("keeps a transcript that ends where a model can answer", () => {
    const messages = [asked("what is this page?"), called("t1"), answered("t1")];
    expect(usablePiMessages(messages)).toBe(messages);
  });

  it("cuts at a tool call nothing answered, and takes its results with it", () => {
    const messages = [asked("what is this page?"), called("t1"), answered("t1"), called("t2")];
    expect(usablePiMessages(messages)).toEqual(messages.slice(0, 3));
  });

  it("keeps a compaction summary, which is a turn the model reads", () => {
    const messages = [
      { role: "compactionSummary" as const, summary: "…", tokensBefore: 4_000, timestamp: 0 },
      asked("and now?"),
    ];
    expect(usablePiMessages(messages)).toBe(messages);
  });

  it("drops a turn that ended in an error", () => {
    expect(usablePiMessages([asked("what is this page?"), failed])).toEqual([
      asked("what is this page?"),
    ]);
  });
});

describe("readPiSnapshot", () => {
  it("refuses anything but a stored snapshot of this version", () => {
    expect(readPiSnapshot(undefined)).toBeUndefined();
    expect(readPiSnapshot("{}")).toBeUndefined();
    expect(readPiSnapshot({ messages: [] })).toBeUndefined();
    expect(readPiSnapshot({ messages: [], version: PI_SNAPSHOT_VERSION + 1 })).toBeUndefined();
    expect(readPiSnapshot({ version: PI_SNAPSHOT_VERSION })).toBeUndefined();
  });

  it("keeps the fields it knows and drops the rest", () => {
    const stored = { ...snapshot({ provider: THINKS }), scrolled: true };
    expect(readPiSnapshot(stored)).toEqual(snapshot({ provider: THINKS }));
  });
});

describe("a pi session over a snapshot", () => {
  it("brings back every field it saved", async () => {
    const first = piSession({
      generateTitle: true,
      provider: THINKS,
      streamFn: scripted([answer, named]).streamFn,
    });
    await waitFor(() => expect(first.snapshot().models?.length).toBeGreaterThan(0));
    first.selectModel?.(REASONING_MODEL);
    first.setThinkingLevel?.("high");
    first.send("what is this page?");
    await waitFor(() => expect(first.snapshot().title).toBe("Plans on this page"));

    const saved = first.save();
    expect(saved).toEqual(
      snapshot({
        messages: saved.messages,
        model: REASONING_MODEL,
        provider: THINKS,
        thinkingLevel: "high",
        title: "Plans on this page",
      }),
    );

    // A second browser session, on nothing but what was stored.
    storage = memoryStorage();
    const again = piSession({ snapshot: saved, streamFn: scripted([answer]).streamFn });
    await waitFor(() => expect(again.snapshot().modelId).toBe(REASONING_MODEL));

    expect(again.snapshot().messages).toHaveLength(2);
    expect(again.snapshot().title).toBe("Plans on this page");
    // Field by field, so one added to `PiSnapshot` and restored nowhere fails
    // here rather than being saved and silently dropped.
    const restored = again.save();
    for (const field of PI_SNAPSHOT_FIELDS) expect(restored[field]).toEqual(saved[field]);
  });

  it("does not buy the title a second time", async () => {
    const model = scripted([named]);
    const session = piSession({
      generateTitle: true,
      snapshot: snapshot({
        messages: [asked("what is this page?"), turn([{ type: "text", text: "Two." }], "stop")],
        model: REASONING_MODEL,
        provider: THINKS,
        title: "Plans on this page",
      }),
      streamFn: model.streamFn,
    });

    await waitFor(() => expect(session.snapshot().modelId).toBe(REASONING_MODEL));
    expect(session.snapshot().title).toBe("Plans on this page");
    expect(model.requests()).toBe(0);
  });

  it("opens on the conversation's own model rather than the browser's", async () => {
    const before = piSession({ provider: THINKS, streamFn: scripted([answer]).streamFn });
    await waitFor(() => expect(before.snapshot().models?.length).toBeGreaterThan(0));
    before.selectModel?.(PLAIN_MODEL);

    const session = piSession({
      snapshot: snapshot({ model: REASONING_MODEL, provider: THINKS, thinkingLevel: "medium" }),
      streamFn: scripted([answer]).streamFn,
    });
    await waitFor(() => expect(session.snapshot().modelId).toBe(REASONING_MODEL));
    expect(session.snapshot().thinkingLevel).toBe("medium");

    // Spent: the next pick is the visitor's, and the stored one never returns.
    session.selectModel?.(PLAIN_MODEL);
    expect(session.snapshot().modelId).toBe(PLAIN_MODEL);
  });

  it("restores a model of the provider the agent already starts on", async () => {
    const session = piSession({
      snapshot: snapshot({ model: OTHER_DEFAULT_MODEL, provider: DEFAULT_PROVIDER }),
      streamFn: scripted([answer]).streamFn,
    });
    await waitFor(() => expect(session.snapshot().modelId).toBe(OTHER_DEFAULT_MODEL));
  });

  it("opens on the transcript a stored conversation can still be continued from", async () => {
    const session = piSession({
      snapshot: snapshot({
        messages: [asked("what is this page?"), called("t1")],
        model: REASONING_MODEL,
        provider: THINKS,
      }),
      streamFn: scripted([answer]).streamFn,
    });

    // The call nothing answered is gone, so the question is all that is left.
    await waitFor(() => expect(session.snapshot().modelId).toBe(REASONING_MODEL));
    expect(session.snapshot().messages).toHaveLength(1);
    expect(session.save().messages).toHaveLength(1);
  });
});
