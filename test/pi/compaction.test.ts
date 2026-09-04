import type { AgentMessage, StreamFn } from "@earendil-works/pi-agent-core";
import { convertToLlm } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Context } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";

import { compactMessages } from "../../src/pi/chat/compaction.ts";
import { compactionSettings } from "../../src/pi/chat/transcript.ts";
import { DEFAULT_MODEL } from "../../src/pi/providers/models.ts";

/** A small window, so a test conversation is a handful of lines and not a book. */
const model = { ...DEFAULT_MODEL, contextWindow: 4_000 };

const usage = () => ({
  input: 100,
  output: 10,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 110,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

const answer = (text: string): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
  api: "anthropic-messages",
  provider: "anthropic",
  model: "claude-sonnet-5",
  usage: usage(),
  stopReason: "stop",
  timestamp: 0,
});

/** One prepared summary, and the request it was asked for. */
const scripted = (message: AssistantMessage, seen: Context[] = []): StreamFn => {
  return (_model, context) => {
    seen.push(context);
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({ type: "done", reason: "stop", message });
    stream.end(message);
    return stream;
  };
};

/** A provider that answers nothing: the shape a failed request comes back in. */
const failing = (): StreamFn => () => {
  const message = { ...answer(""), stopReason: "error" as const, errorMessage: "503" };
  const stream = createAssistantMessageEventStream();
  stream.push({ type: "start", partial: { ...message, content: [] } });
  stream.push({ type: "error", reason: "error", error: message });
  stream.end(message);
  return stream;
};

/** A conversation long enough that its first turns fall behind the cut point. */
const long = (): AgentMessage[] => {
  const said = "a".repeat(2_000);
  return [
    { role: "user", content: said, timestamp: 0 },
    answer(said),
    { role: "user", content: said, timestamp: 0 },
    answer(said),
    { role: "user", content: "and the last one?", timestamp: 0 },
    answer("The last one."),
  ];
};

describe("compactionSettings", () => {
  it("keeps pi's own numbers where the window is large", () => {
    const settings = compactionSettings(200_000);
    expect(settings.reserveTokens).toBe(16_384);
    expect(settings.keepRecentTokens).toBe(20_000);
  });

  it("caps both against a window smaller than they are", () => {
    // Gemini Nano's 9k: half of it for the summary, a quarter of it kept.
    const settings = compactionSettings(9_216);
    expect(settings.reserveTokens).toBe(4_608);
    expect(settings.keepRecentTokens).toBe(2_304);
  });
});

describe("compactMessages", () => {
  it("replaces the turns before the cut with one summary", async () => {
    const messages = long();
    const next = await compactMessages({
      messages,
      model,
      streamFn: scripted(answer("## Goal\nName the plans.")),
    });

    expect(next).toBeDefined();
    expect(next?.[0]).toMatchObject({
      role: "compactionSummary",
      summary: "## Goal\nName the plans.",
    });
    // Shorter than what it replaced, and the last turn is still there whole.
    expect(next?.length).toBeLessThan(messages.length);
    expect(next?.at(-1)).toEqual(messages.at(-1));
  });

  it("gives the summary to the model as the history it stands for", async () => {
    const seen: Context[] = [];
    const next = await compactMessages({
      messages: long(),
      model,
      streamFn: scripted(answer("## Goal\nName the plans."), seen),
    });

    // What the loop would send next: the summary is a message of its own, and
    // pi's default conversion drops it. `createAgent` uses this one.
    const sent = convertToLlm(next ?? []);
    expect(sent[0].role).toBe("user");
    expect(JSON.stringify(sent[0].content)).toContain("## Goal");
  });

  it("asks the provider about the conversation it is summarizing", async () => {
    const seen: Context[] = [];
    await compactMessages({
      messages: long(),
      model,
      streamFn: scripted(answer("summary"), seen),
    });

    expect(seen).toHaveLength(1);
    const asked = JSON.stringify(seen[0].messages);
    // The turns behind the cut point, and not the recent ones: those are kept
    // whole, so summarizing them too would say everything twice.
    expect(asked).toContain("aaaa");
    expect(asked).not.toContain("and the last one?");
    // The summary is asked for outside the conversation, so it carries its own
    // system prompt rather than the agent's.
    expect(seen[0].systemPrompt).toContain("summarization assistant");
  });

  it("leaves a short conversation alone", async () => {
    const next = await compactMessages({
      messages: [
        { role: "user", content: "what is this page?", timestamp: 0 },
        answer("A pricing page."),
      ],
      model,
      streamFn: scripted(answer("summary")),
    });

    expect(next).toBeUndefined();
  });

  it("throws where the summary could not be written", async () => {
    await expect(compactMessages({ messages: long(), model, streamFn: failing() })).rejects.toThrow(
      /503/,
    );
  });
});
