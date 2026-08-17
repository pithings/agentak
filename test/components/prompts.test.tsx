import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Chat } from "../../src/components/chat.tsx";
import type { ChatProps } from "../../src/components/chat.tsx";

afterEach(cleanup);

const surface = (props: Partial<ChatProps> = {}) =>
  render(
    <Chat
      isStreaming={false}
      messages={[]}
      onReset={() => {}}
      onSend={() => {}}
      onStop={() => {}}
      {...props}
    />,
  );

const message = {
  id: "m1",
  parts: [{ kind: "text" as const, text: "hello" }],
  role: "user" as const,
};

describe("the starter prompts", () => {
  it("offers none where the host declares none", () => {
    surface();
    expect(screen.queryAllByRole("button", { name: /Summarize/ })).toEqual([]);
  });

  it("sends one as it stands, on the click", () => {
    const onSend = vi.fn();
    surface({ onSend, prompts: ["Summarize this page"] });

    fireEvent.click(screen.getByRole("button", { name: "Summarize this page" }));
    expect(onSend).toHaveBeenCalledWith("Summarize this page");
  });

  it("sends the message behind a short button", () => {
    const onSend = vi.fn();
    surface({
      onSend,
      prompts: [{ label: "Summarize", prompt: "Summarize this page in three bullets." }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Summarize" }));
    expect(onSend).toHaveBeenCalledWith("Summarize this page in three bullets.");
  });

  it("goes once something has been said", () => {
    surface({ messages: [message], prompts: ["Summarize this page"] });
    expect(screen.queryByRole("button", { name: "Summarize this page" })).toBeNull();
  });

  it("ends the empty state, under the conversations already had", () => {
    const { container } = surface({
      history: [{ id: "a", title: "Two plans on this page" }],
      onOpenConversation: () => {},
      prompts: ["Summarize this page"],
    });
    const row = container.querySelector('[data-slot="chat-prompts"]');
    const recent = screen.getByRole("group", { name: "Recent chats" });

    expect(row?.parentElement?.lastElementChild).toBe(row);
    const order = row?.compareDocumentPosition(recent) ?? 0;
    expect(order & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("goes with the transcript under the settings page", () => {
    surface({
      models: [{ contextWindow: 1000, id: "m", name: "M" }],
      pickerOpen: true,
      prompts: ["Summarize this page"],
    });
    expect(screen.queryByRole("button", { name: "Summarize this page" })).toBeNull();
  });
});
