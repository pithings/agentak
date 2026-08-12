import { act, renderHook } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDemoChat } from "../src/demo-chat";
import type { ViewPart } from "@/types";

const textOf = (part: ViewPart) =>
  part.kind === "text" || part.kind === "thinking" ? part.text : "";

describe("useDemoChat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("streams a canned turn", async () => {
    const { result } = renderHook(() => useDemoChat());

    act(() => result.current.send("hi"));
    // The assistant message only appears with its first part.
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.messages).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    const partial = result.current.messages[1];
    expect(partial.role).toBe("assistant");
    expect(textOf(partial.parts[0]).length).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.isStreaming).toBe(false);

    const done = result.current.messages[1];
    expect(done.parts.map((part) => part.kind)).toEqual(["thinking", "tool", "text"]);
    expect(textOf(done.parts[0])).toContain("canned turn");
  });

  it("marks a tool call running before its output lands", async () => {
    const { result } = renderHook(() => useDemoChat());

    act(() => result.current.send("hi"));
    // Past the thinking part, into the tool call.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    const running = result.current.messages[1].parts.at(-1);
    expect(running?.kind).toBe("tool");
    expect(running?.kind === "tool" && running.status).toBe("running");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    const settled = result.current.messages[1].parts[1];
    expect(settled.kind === "tool" && settled.status).toBe("done");
  });

  it("streams every turn on autoStart, with no prompt", async () => {
    const { result } = renderHook(() => useDemoChat({ autoStart: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600_000);
    });
    expect(result.current.isStreaming).toBe(false);
    // A reel of assistant turns — nothing was typed, so no user message.
    expect(result.current.messages.every((message) => message.role === "assistant")).toBe(true);
    expect(result.current.messages.length).toBeGreaterThan(3);
  });

  it("stops mid-stream and keeps the partial turn", async () => {
    const { result } = renderHook(() => useDemoChat());

    act(() => result.current.send("hi"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    act(() => result.current.stop());

    const partial = result.current.messages[1].parts.length;
    expect(result.current.isStreaming).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.messages[1].parts).toHaveLength(partial);
    expect(result.current.isStreaming).toBe(false);
  });
});
