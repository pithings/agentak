import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { renderHook, waitFor } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_MODEL } from "@/agent/models";
import { generateTitle, toTitle, useTitle } from "@/agent/title";
import type { ViewMessage } from "@/types";

const user = (text: string): ViewMessage => ({
  id: "u0",
  role: "user",
  parts: [{ kind: "text", text }],
});

const assistant = (parts: ViewMessage["parts"]): ViewMessage => ({
  id: "a1",
  role: "assistant",
  parts,
});

const answer = (text: string): AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
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
  stopReason: "stop",
  timestamp: 0,
});

/** Answers one prepared message, so no provider is involved. */
const scripted = (message: AssistantMessage): StreamFn => {
  return () => {
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: { ...message, content: [] } });
    stream.push({ type: "done", reason: "stop", message });
    stream.end(message);
    return stream;
  };
};

describe("toTitle", () => {
  it("takes the first message, on one line", () => {
    expect(toTitle([user("  what is\n on this page? ")])).toBe("what is");
  });

  it("cuts a long question on a word", () => {
    const title = toTitle([
      user("compare every plan on this page and tell me which one fits a small team best"),
    ]);

    expect(title).toMatch(/…$/);
    expect(title!.length).toBeLessThanOrEqual(49);
    expect(title).not.toMatch(/\s…$/);
  });

  it("has none before the first message, or for an image alone", () => {
    expect(toTitle([])).toBeUndefined();
    expect(
      toTitle([{ id: "u0", role: "user", parts: [{ kind: "text", text: "   " }] }]),
    ).toBeUndefined();
  });
});

describe("generateTitle", () => {
  it("takes the model's line, without its quotes or its period", async () => {
    const title = await generateTitle({
      model: DEFAULT_MODEL,
      seed: "what is on this page?",
      streamFn: scripted(answer('"The plans on this page."')),
    });

    expect(title).toBe("The plans on this page");
  });

  it("answers nothing when the request fails, so the derived title stands", async () => {
    const title = await generateTitle({
      model: DEFAULT_MODEL,
      seed: "what is on this page?",
      streamFn: () => {
        throw new Error("429");
      },
    });

    expect(title).toBeUndefined();
  });
});

describe("useTitle", () => {
  const conversation = [
    user("what is on this page?"),
    assistant([{ kind: "text", text: "Plans." }]),
  ];

  it("derives the title, and asks for none unless a host opts in", async () => {
    const streamFn = vi.fn(scripted(answer("Named by the model")));
    const { result } = renderHook(() =>
      useTitle({ messages: conversation, model: DEFAULT_MODEL, streamFn }),
    );

    expect(result.current).toBe("what is on this page?");
    expect(streamFn).not.toHaveBeenCalled();
  });

  it("replaces it with the model's, once, after the first answer", async () => {
    const streamFn = vi.fn(scripted(answer("Named by the model")));
    const { rerender, result } = renderHook((props: { isStreaming?: boolean }) =>
      useTitle({
        generate: true,
        messages: conversation,
        model: DEFAULT_MODEL,
        streamFn,
        ...props,
      }),
    );

    await waitFor(() => expect(result.current).toBe("Named by the model"));

    rerender({ isStreaming: false });
    expect(streamFn).toHaveBeenCalledTimes(1);
  });

  it("waits for the turn to settle — one request at a time", () => {
    const streamFn = vi.fn(scripted(answer("Named by the model")));
    renderHook(() =>
      useTitle({
        generate: true,
        isStreaming: true,
        messages: conversation,
        model: DEFAULT_MODEL,
        streamFn,
      }),
    );

    expect(streamFn).not.toHaveBeenCalled();
  });
});
