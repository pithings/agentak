import type { AgentTool, StreamFn } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, StopReason } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { act, renderHook, waitFor } from "@testing-library/preact";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";

import { createAgent } from "@/pi/create-agent";
import type { AnyModel } from "@/pi/providers";
import { useAgent } from "@/pi/use-agent";
import type { ViewToolPart } from "@/types";

const turn = (content: AssistantMessage["content"], stopReason: StopReason): AssistantMessage => ({
  role: "assistant",
  content,
  api: "anthropic-messages",
  provider: "anthropic",
  model: "claude-sonnet-5",
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
    stream.push({
      type: "done",
      reason: message.stopReason as "stop" | "toolUse",
      message,
    });
    stream.end(message);
    return stream;
  };
};

/** A host tool, because the loop ships with none. */
const lookup: AgentTool<ReturnType<typeof Type.Object>> = {
  name: "lookup",
  label: "Look up",
  description: "Answers with a fixed line, so a turn can run a tool.",
  parameters: Type.Object({}, { additionalProperties: false }),
  execute: () =>
    Promise.resolve({ content: [{ type: "text", text: "two plans" }], details: undefined }),
};

const lookupTurn = turn(
  [{ type: "toolCall", id: "call-1", name: "lookup", arguments: {} }],
  "toolUse",
);

const answerTurn = turn([{ type: "text", text: "Two plans." }], "stop");

/** The runtime is built once, outside the render — a new one per render would
 *  hand the hook a fresh, empty agent every time. */
const setup = (script: AssistantMessage[], approvals: "once" | "never" = "once") => {
  const runtime = createAgent({
    apiKey: "test-key",
    approvals,
    tools: [lookup],
    streamFn: scripted(script),
  });
  return renderHook(() => useAgent(runtime));
};

const toolOf = (parts: { kind: string }[]) =>
  parts.find((part) => part.kind === "tool") as ViewToolPart;

describe("the wired agent", () => {
  it("renders a turn as a user message and an assistant answer", async () => {
    const { result } = setup([answerTurn]);

    act(() => result.current.send("what is this page?"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    expect(result.current.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(result.current.messages[1].parts[0]).toEqual({ kind: "text", text: "Two plans." });
    expect(result.current.usage?.usedTokens).toBe(15);
  });

  it("holds a tool call until it is allowed, then runs it", async () => {
    const { result } = setup([lookupTurn, answerTurn]);

    act(() => result.current.send("read it"));
    await waitFor(() =>
      expect(toolOf(result.current.messages[1]?.parts ?? []).status).toBe("pending"),
    );

    act(() => result.current.respond("call-1", true));
    await waitFor(() => expect(toolOf(result.current.messages[1].parts).status).toBe("done"));

    const tool = toolOf(result.current.messages[1].parts);
    expect(tool.output).toContain("two plans");
    expect(tool.approval).toEqual({ id: "call-1", approved: true, reason: undefined });
  });

  it("blocks a denied tool call and says so in the result", async () => {
    const { result } = setup([lookupTurn, answerTurn]);

    act(() => result.current.send("read it"));
    await waitFor(() =>
      expect(toolOf(result.current.messages[1]?.parts ?? []).status).toBe("pending"),
    );

    act(() => result.current.respond("call-1", false));
    await waitFor(() => expect(toolOf(result.current.messages[1].parts).status).toBe("denied"));

    const tool = toolOf(result.current.messages[1].parts);
    expect(tool.output).toContain("denied");
  });

  it("tells the model why a call was denied, when the reader says", async () => {
    const { result } = setup([lookupTurn, answerTurn]);

    act(() => result.current.send("read it"));
    await waitFor(() =>
      expect(toolOf(result.current.messages[1]?.parts ?? []).status).toBe("pending"),
    );

    act(() => result.current.respond("call-1", false, "Read the other tab."));
    await waitFor(() => expect(toolOf(result.current.messages[1].parts).status).toBe("denied"));

    const tool = toolOf(result.current.messages[1].parts);
    // The reason stands in for the tool's output, so the next turn can take it.
    expect(tool.output).toContain("Read the other tab.");
    expect(tool.approval?.reason).toBe("Read the other tab.");
  });

  it("runs a failed turn again, in place of the failure", async () => {
    // The provider refuses once, then answers — what a retry is for.
    const answer = scripted([answerTurn]);
    let down = true;
    const flaky: StreamFn = (...args) => {
      if (!down) return answer(...args);
      down = false;
      throw new Error("Provider is down.");
    };

    const runtime = createAgent({ apiKey: "test-key", approvals: "never", streamFn: flaky });
    const { result } = renderHook(() => useAgent(runtime));

    act(() => result.current.send("what is this page?"));
    await waitFor(() => expect(result.current.error).toBe("Provider is down."));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // The failed turn is gone rather than answered around: one question, one
    // answer, and no error left over.
    expect(result.current.error).toBeUndefined();
    expect(result.current.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(result.current.messages[1].parts[0]).toEqual({ kind: "text", text: "Two plans." });
  });

  it("carries the thinking level into the request, and sends none when it is off", async () => {
    const asked: (string | undefined)[] = [];
    const answer = scripted([answerTurn]);
    const recording: StreamFn = (model, context, options) => {
      asked.push(options?.reasoning);
      return answer(model, context, options);
    };

    const runtime = createAgent({
      apiKey: "test-key",
      approvals: "never",
      streamFn: recording,
    });
    const { result } = renderHook(() => useAgent(runtime));

    // `off` is not a level a provider knows — pi drops it rather than sending it.
    expect(result.current.thinkingLevel).toBe("off");
    act(() => result.current.send("hello"));
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toBeUndefined();

    act(() => result.current.setThinkingLevel("high"));
    expect(result.current.thinkingLevel).toBe("high");

    act(() => result.current.send("again"));
    await waitFor(() => expect(asked).toHaveLength(2));
    expect(asked[1]).toBe("high");
  });

  it("leaves an answered transcript alone when there is nothing to retry", async () => {
    const { result } = setup([answerTurn]);

    act(() => result.current.send("what is this page?"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    act(() => result.current.retry());
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.isStreaming).toBe(false);
  });

  it("asks nothing when the policy is never", async () => {
    const { result } = setup([lookupTurn, answerTurn], "never");

    act(() => result.current.send("read it"));
    await waitFor(() =>
      expect(toolOf(result.current.messages[1]?.parts ?? []).status).toBe("done"),
    );
  });

  it("queues a message typed mid-turn, and drops it once the loop takes it", async () => {
    const { result } = setup([lookupTurn, answerTurn]);

    act(() => result.current.send("read it"));
    await waitFor(() =>
      expect(toolOf(result.current.messages[1]?.parts ?? []).status).toBe("pending"),
    );

    act(() => result.current.send("and the prices"));
    expect(result.current.queued.map((item) => item.text)).toEqual(["and the prices"]);

    act(() => result.current.respond("call-1", true));
    await waitFor(() => expect(result.current.queued).toEqual([]));
  });

  it("runs a gateway model, and prices it from that model's own entry", async () => {
    const gateway = {
      id: "anthropic/claude-sonnet-5",
      name: "Claude Sonnet 5",
      api: "openai-completions",
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      reasoning: true,
      input: ["text"],
      cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      contextWindow: 200_000,
      maxTokens: 64_000,
    } as AnyModel;

    const runtime = createAgent({
      apiKey: (provider) => (provider === "openrouter" ? "sk-or-test" : undefined),
      model: gateway,
      streamFn: scripted([
        {
          ...answerTurn,
          api: "openai-completions",
          provider: "openrouter",
          model: gateway.id,
        },
      ]),
    });
    const { result } = renderHook(() => useAgent(runtime));

    act(() => result.current.send("hello"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    expect(result.current.model.provider).toBe("openrouter");
    expect(result.current.usage?.maxTokens).toBe(200_000);
    expect(result.current.usage?.modelId).toBe("anthropic/claude-sonnet-5");
  });

  it("empties the transcript on reset", async () => {
    const { result } = setup([answerTurn]);

    act(() => result.current.send("hello"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => result.current.reset());
    expect(result.current.messages).toEqual([]);
    expect(result.current.usage).toBeUndefined();
  });
});
