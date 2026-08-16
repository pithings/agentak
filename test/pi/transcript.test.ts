import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Usage } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";

import { toContextUsage, toViewMessages } from "../../src/pi/transcript.ts";
import { DEFAULT_MODEL } from "../../src/pi/models.ts";
import type { ViewToolPart } from "../../src/types.ts";

const usage = (over: Partial<Usage> = {}): Usage => ({
  input: 1000,
  output: 100,
  cacheRead: 200,
  cacheWrite: 50,
  reasoning: 20,
  totalTokens: 1350,
  cost: { input: 0.003, output: 0.001, cacheRead: 0.0001, cacheWrite: 0.0002, total: 0.0043 },
  ...over,
});

const assistant = (content: AssistantMessage["content"]): AgentMessage => ({
  role: "assistant",
  content,
  api: "anthropic-messages",
  provider: "anthropic",
  model: "claude-sonnet-5",
  usage: usage(),
  stopReason: "stop",
  timestamp: 0,
});

const toolPart = (messages: AgentMessage[]): ViewToolPart =>
  toViewMessages(messages)
    .flatMap((message) => message.parts)
    .find((part) => part.kind === "tool") as ViewToolPart;

describe("toViewMessages", () => {
  it("maps a turn to text, thinking and tool parts", () => {
    const view = toViewMessages([
      { role: "user", content: "what is this page?", timestamp: 0 },
      assistant([
        { type: "thinking", thinking: "read it first" },
        { type: "text", text: "One moment." },
        { type: "toolCall", id: "call-1", name: "lookup", arguments: { maxChars: 100 } },
      ]),
    ]);

    expect(view.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(view[1].parts.map((part) => part.kind)).toEqual(["thinking", "text", "tool"]);
  });

  it("fills the call a tool result answers, rather than adding a part", () => {
    const part = toolPart([
      assistant([{ type: "toolCall", id: "call-1", name: "lookup", arguments: {} }]),
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "lookup",
        content: [{ type: "text", text: "the page" }],
        isError: false,
        timestamp: 0,
      },
    ]);

    expect(part.status).toBe("done");
    expect(part.output).toBe("the page");
  });

  it("separates a denied call from a failed one", () => {
    const messages: AgentMessage[] = [
      assistant([{ type: "toolCall", id: "call-1", name: "lookup", arguments: {} }]),
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "lookup",
        content: [{ type: "text", text: "The user denied this call." }],
        isError: true,
        timestamp: 0,
      },
    ];

    expect(toolPart(messages).status).toBe("error");

    const denied = toViewMessages(messages, undefined, {
      pending: [],
      answers: { "call-1": { id: "call-1", approved: false } },
    });
    const part = denied[0].parts.find((entry) => entry.kind === "tool") as ViewToolPart;
    expect(part.status).toBe("denied");
  });

  it("marks a call that is waiting for an answer", () => {
    const view = toViewMessages(
      [assistant([{ type: "toolCall", id: "call-1", name: "lookup", arguments: {} }])],
      undefined,
      { pending: [{ id: "call-1", toolName: "lookup", args: {} }], answers: {} },
    );

    expect((view[0].parts[0] as ViewToolPart).status).toBe("pending");
  });

  it("renders an image a tool returned beside the call", () => {
    const view = toViewMessages([
      assistant([{ type: "toolCall", id: "call-1", name: "screenshot", arguments: {} }]),
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "screenshot",
        content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
        isError: false,
        timestamp: 0,
      },
    ]);

    expect(view[0].parts.map((part) => part.kind)).toEqual(["tool", "element"]);
  });

  it("appends the streaming message, and keeps ids stable while it grows", () => {
    const messages: AgentMessage[] = [{ role: "user", content: "hi", timestamp: 0 }];
    const first = toViewMessages(messages, assistant([{ type: "text", text: "He" }]));
    const second = toViewMessages(messages, assistant([{ type: "text", text: "Hello" }]));

    expect(first[1].id).toBe(second[1].id);
    expect(second[1].parts[0]).toEqual({ kind: "text", text: "Hello" });
  });

  it("keeps a failed turn that carries only an error", () => {
    const failed = { ...assistant([]), stopReason: "error", errorMessage: "401" } as AgentMessage;
    expect(toViewMessages([failed])[0].error).toBe("401");
  });

  it("shows a compaction as a checkpoint", () => {
    const view = toViewMessages([
      { role: "compactionSummary", summary: "…", tokensBefore: 120_000, timestamp: 0 },
    ]);

    expect(view[0].parts[0]).toMatchObject({ kind: "element", name: "checkpoint" });
  });
});

describe("toContextUsage", () => {
  const model = DEFAULT_MODEL;

  it("reports the last window and the summed cost", () => {
    const view = toContextUsage([assistant([]), assistant([])], model);

    // The window is one turn; the cost is both.
    expect(view?.usedTokens).toBe(1350);
    expect(view?.maxTokens).toBe(model.contextWindow);
    expect(view?.costs.total).toBeCloseTo(0.0086);
    expect(view?.usage.outputTokens).toBe(200);
    expect(view?.usage.cachedInputTokens).toBe(500);
  });

  it("is undefined before the first turn", () => {
    expect(toContextUsage([{ role: "user", content: "hi", timestamp: 0 }], model)).toBeUndefined();
  });

  it("warns once the window is as good as spent", () => {
    expect(toContextUsage([assistant([])], model)?.nearLimit).toBe(false);

    // Everything but the room pi keeps for a summary — the point it would
    // compact at, which is the point the meter warns at.
    const full = assistant([]);
    const spent = model.contextWindow - 16_384 + 1;
    if (full.role === "assistant") {
      full.usage = usage({ cacheRead: 0, cacheWrite: 0, input: spent, output: 0 });
    }

    expect(toContextUsage([full], model)?.nearLimit).toBe(true);
  });

  it("does not warn from the first turn on a window smaller than pi's reserve", () => {
    // Gemini Nano's 9k window: the fixed 16k reserve would put the threshold
    // below zero, so half the window is the reserve instead.
    const small = { ...model, contextWindow: 9_216 };

    expect(toContextUsage([assistant([])], small)?.nearLimit).toBe(false);

    const full = assistant([]);
    if (full.role === "assistant") {
      full.usage = usage({ cacheRead: 0, cacheWrite: 0, input: 4_609, output: 0 });
    }

    expect(toContextUsage([full], small)?.nearLimit).toBe(true);
  });
});
