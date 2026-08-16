import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, StopReason } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { cleanup, render, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentChat } from "../../src/agent-chat.tsx";
import { createPiSession, type PiSessionOptions } from "../../src/pi/session.ts";
import { memoryStorage } from "../../src/pi/storage.ts";

const turn = (content: AssistantMessage["content"], stopReason: StopReason): AssistantMessage => ({
  role: "assistant",
  content,
  api: "openai-completions",
  provider: "llm7",
  model: "gemini-3.1-flash-lite",
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

/** Replays one prepared message per request, so no provider is involved. */
const scripted = (script: AssistantMessage[]): StreamFn => {
  let index = 0;
  return () => {
    const message = script[Math.min(index, script.length - 1)];
    index += 1;
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({ type: "done", reason: message.stopReason as "stop" | "toolUse", message });
    stream.end(message);
    return stream;
  };
};

const answer = turn([{ type: "text", text: "Two plans." }], "stop");
const named = turn([{ type: "text", text: "Plans on this page" }], "stop");

/** LLM7 is free and its catalog is written into the bundle, so nothing is fetched. */
const FREE = "llm7";
const MODEL = "gemini-3.1-flash-lite";

/** The same, and its catalog carries a reasoning model beside a plain one. */
const THINKS = "ovhcloud";
const REASONING_MODEL = "gpt-oss-20b";
const PLAIN_MODEL = "Qwen3-Coder-30B-A3B-Instruct";

afterEach(cleanup);

/**
 * One store per test, shared by the sessions in it: what a session picks is
 * there for the next one, and no test opens on what another left.
 */
let storage = memoryStorage();
beforeEach(() => {
  storage = memoryStorage();
});
const piSession = (options: PiSessionOptions = {}) => createPiSession({ storage, ...options });

describe("createPiSession", () => {
  it("holds the first message until a provider can answer, then sends it", async () => {
    const session = piSession({ streamFn: scripted([answer]) });

    // Nothing is chosen on a fresh session, so the message waits and the picker
    // is the question.
    session.send("what is this page?");
    expect(session.snapshot().messages).toHaveLength(0);
    expect(session.snapshot().pickerOpen).toBe(true);

    session.selectProvider?.(FREE);
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
    // A provider chosen for the first time picks no model, so the message is
    // still waiting.
    expect(session.snapshot().messages).toHaveLength(0);

    session.selectModel?.(MODEL);
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    expect(session.snapshot().modelId).toBe(MODEL);
    expect(session.snapshot().title).toBe("what is this page?");
  });

  it("opens on the model this browser last used with the provider", async () => {
    piSession({ provider: FREE, streamFn: scripted([answer]) }).selectModel?.(MODEL);

    const session = piSession({ provider: FREE, streamFn: scripted([answer]) });
    await waitFor(() => expect(session.snapshot().modelId).toBe(MODEL));

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
  });

  it("asks the model to name the conversation, once, when a host opts in", async () => {
    piSession({ provider: FREE, streamFn: scripted([answer]) }).selectModel?.(MODEL);

    const session = piSession({
      generateTitle: true,
      provider: FREE,
      streamFn: scripted([answer, named]),
    });
    await waitFor(() => expect(session.snapshot().modelId).toBe(MODEL));

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().title).toBe("Plans on this page"));
  });

  it("offers a thinking level only where the model has one", async () => {
    const session = piSession({ provider: THINKS, streamFn: scripted([answer]) });
    await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));

    session.selectModel?.(REASONING_MODEL);
    expect(session.snapshot().thinkingLevels).toContain("medium");
    expect(session.snapshot().thinkingLevel).toBe("off");

    // Nothing to choose from, so the picker shows no level at all.
    session.selectModel?.(PLAIN_MODEL);
    expect(session.snapshot().thinkingLevels).toEqual(["off"]);
  });

  it("keeps the thinking level per model, and drops one the next model refuses", async () => {
    const first = piSession({ provider: THINKS, streamFn: scripted([answer]) });
    await waitFor(() => expect(first.snapshot().models?.length).toBeGreaterThan(0));
    first.selectModel?.(REASONING_MODEL);
    first.setThinkingLevel?.("high");
    expect(first.snapshot().thinkingLevel).toBe("high");

    // A model that cannot reason must not be asked to: the level goes with it.
    first.selectModel?.(PLAIN_MODEL);
    expect(first.snapshot().thinkingLevel).toBe("off");

    const next = piSession({ provider: THINKS, streamFn: scripted([answer]) });
    await waitFor(() => expect(next.snapshot().models?.length).toBeGreaterThan(0));
    next.selectModel?.(REASONING_MODEL);
    expect(next.snapshot().thinkingLevel).toBe("high");
  });

  it("notifies subscribers and keeps the snapshot until it changes", async () => {
    const session = piSession({ provider: FREE, streamFn: scripted([answer]) });
    let events = 0;
    session.subscribe(() => (events += 1));

    const first = session.snapshot();
    expect(session.snapshot()).toBe(first);

    session.setPickerOpen?.(true);
    expect(events).toBe(1);
    expect(session.snapshot()).not.toBe(first);
    expect(session.snapshot().pickerOpen).toBe(true);
  });
});

describe("AgentChat over a pi session", () => {
  it("keeps the session's own generateTitle when the host declares none", async () => {
    piSession({ provider: FREE, streamFn: scripted([answer]) }).selectModel?.(MODEL);

    const session = piSession({
      generateTitle: true,
      provider: FREE,
      streamFn: scripted([answer, named]),
    });
    // The element passes a boolean either way; a preact host may pass nothing,
    // and nothing must not turn the session's own choice off.
    render(<AgentChat session={session} />);
    await waitFor(() => expect(session.snapshot().modelId).toBe(MODEL));

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().title).toBe("Plans on this page"));
  });
});
