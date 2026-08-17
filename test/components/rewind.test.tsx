import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Chat, type ChatProps } from "../../src/components/chat.tsx";
import type { ViewMessage } from "../../src/types.ts";

afterEach(cleanup);

const MESSAGES: ViewMessage[] = [
  { id: "u0", role: "user", parts: [{ kind: "text", text: "what is this page?" }] },
  { id: "a1", role: "assistant", parts: [{ kind: "text", text: "Two plans." }] },
  { id: "u2", role: "user", parts: [{ kind: "text", text: "and the tools?" }] },
];

const surface = (props: Partial<ChatProps> = {}) =>
  render(
    <Chat
      isStreaming={false}
      messages={MESSAGES}
      onReset={() => {}}
      onSend={() => {}}
      onStop={() => {}}
      {...props}
    />,
  );

const forks = () => screen.queryAllByRole("button", { name: "Fork from here" });
const retries = () => screen.queryAllByRole("button", { name: "Retry from here" });
const field = () => screen.getByRole("textbox") as HTMLTextAreaElement;

describe("forking from a user message", () => {
  it("offers nothing where the harness cannot rewind", () => {
    surface();
    expect(forks()).toHaveLength(0);
    expect(retries()).toHaveLength(0);
  });

  it("marks the user turns alone, and hands the harness the one clicked", () => {
    const forked: string[] = [];
    surface({ onFork: (id) => forked.push(id) });

    // Two user turns, and no button under the answer between them.
    expect(forks()).toHaveLength(2);

    fireEvent.click(forks()[1]);
    expect(forked).toEqual(["u2"]);
  });

  it("says the message again in the composer, with the caret after it", () => {
    surface({ onFork: () => {} });

    fireEvent.click(forks()[0]);
    expect(field().value).toBe("what is this page?");
    expect(field().selectionStart).toBe("what is this page?".length);
    expect(document.activeElement).toBe(field());
  });

  it("fills the field again for a second fork, whatever was typed over the first", () => {
    surface({ onFork: () => {} });

    fireEvent.click(forks()[0]);
    field().value = "something else";

    // The field is uncontrolled, so the same request twice has to arrive twice.
    fireEvent.click(forks()[1]);
    expect(field().value).toBe("and the tools?");

    fireEvent.click(forks()[1]);
    expect(field().value).toBe("and the tools?");
  });

  it("keeps the two rewinds apart, and offers each on its own", () => {
    const { rerender } = surface({ onRetryFrom: () => {} });
    // The button under the answer above is the copy row, not this one.
    expect(retries()).toHaveLength(2);
    expect(forks()).toHaveLength(0);

    rerender(
      <Chat
        isStreaming={false}
        messages={MESSAGES}
        onFork={() => {}}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
      />,
    );
    expect(retries()).toHaveLength(0);
    expect(forks()).toHaveLength(2);
  });

  it("runs a message again in place, and types nothing back", () => {
    const rerun: string[] = [];
    surface({ onFork: () => {}, onRetryFrom: (id) => rerun.push(id) });

    fireEvent.click(retries()[1]);
    expect(rerun).toEqual(["u2"]);
    // The harness still holds the message, so the composer is left alone.
    expect(field().value).toBe("");
  });

  it("is a message and not a command, whatever the words were", () => {
    surface({
      messages: [{ id: "u0", role: "user", parts: [{ kind: "text", text: "/new" }] }],
      onFork: () => {},
      onReset: () => {},
    });

    // The list belongs to what the reader types. A message put back is neither
    // typed nor run, so the field holds it and the list stays shut.
    fireEvent.click(forks()[0]);
    expect(field().value).toBe("/new");
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
  });
});
