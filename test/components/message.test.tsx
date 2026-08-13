import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { ChatMessage } from "@/components/chat/message";
import type { ViewMessage, ViewToolPart } from "@/types";

afterEach(cleanup);

const message = (part: ViewToolPart): ViewMessage => ({
  id: "a0",
  role: "assistant",
  parts: [part],
});

const call: ViewToolPart = {
  kind: "tool",
  toolCallId: "call-1",
  name: "pageRead",
  args: { selector: "main" },
  status: "running",
};

/** The card body is a `CollapsibleContent`, hidden when the card is closed. */
const body = () => document.querySelector('[data-slot="collapsible-content"]');

describe("tool header subtitle", () => {
  it("reads a single-key input on the header line", () => {
    render(<ChatMessage message={message(call)} />);
    expect(screen.getByText("selector: main")).toBeTruthy();
  });

  it("shows nothing for an input that needs more than one line", () => {
    render(<ChatMessage message={message({ ...call, args: { a: 1, b: 2 } })} />);
    expect(screen.queryByText(/a: 1/)).toBeNull();
  });

  it("drops the parameters box when the subtitle holds the whole input", () => {
    render(<ChatMessage message={message(call)} />);
    expect(screen.queryByText("Parameters")).toBeNull();
  });

  it("keeps the parameters box when the subtitle cannot hold the input", () => {
    render(<ChatMessage message={message({ ...call, args: { a: 1, b: 2 } })} />);
    expect(screen.getByText("Parameters")).toBeTruthy();
  });

  it("cuts a long value to one line", () => {
    render(<ChatMessage message={message({ ...call, args: { text: `x\n${"y".repeat(200)}` } })} />);
    const subtitle = screen.getByTitle(/^text: x y/);
    expect(subtitle.textContent?.length).toBe(72);
    expect(subtitle.textContent?.endsWith("…")).toBe(true);
  });
});

const run = (parts: ViewToolPart[]): ViewMessage => ({ id: "a0", role: "assistant", parts });

const read = (index: number, over: Partial<ViewToolPart> = {}): ViewToolPart => ({
  ...call,
  toolCallId: `call-${index}`,
  name: "read_file",
  args: { path: `src/${index}.ts` },
  status: "done",
  output: "ok",
  ...over,
});

/** The run trigger is the first one — the folded cards are inside it. */
const trigger = () => document.querySelector('[data-slot="collapsible-trigger"]');

describe("ChatMessage tool run", () => {
  it("folds settled calls of one tool into a single row", () => {
    render(<ChatMessage message={run([read(1), read(2), read(3)])} />);

    expect(trigger()?.textContent).toContain("read_file");
    expect(screen.getByText("× 3")).toBeTruthy();
    // The calls are still there, closed — the row is a fold, not a summary.
    expect(screen.getAllByText("read_file").length).toBe(4);
  });

  it("leaves a single call alone", () => {
    render(<ChatMessage message={run([read(1)])} />);
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it("breaks the run on another tool, and on a gate", () => {
    render(
      <ChatMessage
        message={run([read(1), read(2), { ...read(3), name: "write_file" }, read(4), read(5)])}
      />,
    );
    expect(screen.getAllByText("× 2").length).toBe(2);

    cleanup();
    render(<ChatMessage message={run([read(1), { ...read(2), status: "pending" }, read(3)])} />);
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it("keeps the streaming call out of the run", () => {
    render(<ChatMessage isStreaming message={run([read(1), read(2), read(3)])} />);
    expect(screen.getByText("× 2")).toBeTruthy();
  });

  it("reports the worst status of the run", () => {
    render(<ChatMessage message={run([read(1), read(2, { status: "error" })])} />);
    expect(trigger()?.textContent).toContain("Error");
  });
});

describe("ChatMessage tool part", () => {
  it("opens the card when the gate asks", () => {
    const { rerender } = render(<ChatMessage message={message(call)} />);
    expect(body()?.hasAttribute("hidden")).toBe(true);

    // The call renders first and the gate asks after, so the open state has to
    // follow the status, not a mount-time default.
    rerender(<ChatMessage message={message({ ...call, status: "pending" })} />);
    expect(body()?.hasAttribute("hidden")).toBe(false);
    expect(screen.getByText("Allow")).toBeTruthy();
  });

  it("keeps the reader's toggle while the gate waits", () => {
    render(<ChatMessage message={message({ ...call, status: "pending" })} />);

    fireEvent.click(screen.getByText("pageRead"));
    expect(body()?.hasAttribute("hidden")).toBe(true);
  });

  it("answers with the tool call id", () => {
    const answers: [string, boolean][] = [];
    render(
      <ChatMessage
        message={message({ ...call, status: "pending" })}
        onRespond={(id, approved) => answers.push([id, approved])}
      />,
    );

    fireEvent.click(screen.getByText("Deny"));
    fireEvent.click(screen.getByText("Allow"));
    expect(answers).toEqual([
      ["call-1", false],
      ["call-1", true],
    ]);
  });

  it("reports the outcome once the call is done", () => {
    render(
      <ChatMessage
        message={message({
          ...call,
          status: "done",
          output: "ok",
          approval: { id: "call-1", approved: true },
        })}
      />,
    );

    expect(screen.getByText("Allowed")).toBeTruthy();
    expect(screen.queryByText("Allow")).toBeNull();
  });
});
