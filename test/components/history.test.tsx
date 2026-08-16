import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Chat } from "../../src/components/chat.tsx";
import type { ChatProps } from "../../src/components/chat.tsx";

afterEach(cleanup);

const MINUTE = 60_000;

const HISTORY = [
  { id: "a", title: "Two plans on this page", updated: Date.now() - MINUTE },
  { id: "b", title: "What the tools do", updated: Date.now() - 90 * MINUTE },
];

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

const open = () => fireEvent.click(screen.getByRole("button", { name: "Conversations" }));

describe("the history page", () => {
  it("shows no way in where a harness stores nothing", () => {
    surface();
    expect(screen.queryByRole("button", { name: "Conversations" })).toBeNull();
  });

  it("keeps the button at the head of the bar before the conversation is named", () => {
    surface({ history: HISTORY });
    const header = screen.getByRole("button", { name: "Conversations" }).parentElement;
    // The title holds the two ends apart, so an unnamed conversation needs the
    // room it would have taken — else the row packs right and the button with it.
    expect(header?.firstElementChild?.getAttribute("aria-label")).toBe("Conversations");
    expect(header?.children[1].getAttribute("style")).toContain("flex: 1");
  });

  it("lists the stored conversations, and says which one is live", () => {
    surface({ conversationId: "b", history: HISTORY });
    open();

    // The page takes the transcript's place, exactly as the settings page does.
    expect(screen.getByRole("heading", { name: "Conversations" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Two plans/ }).getAttribute("aria-current")).toBe(
      null,
    );
    expect(
      screen.getByRole("button", { name: /What the tools do/ }).getAttribute("aria-current"),
    ).toBe("true");
    // How long ago it was said, on the far side of the row.
    expect(screen.getByRole("button", { name: /Two plans/ }).textContent).toContain("1m");
  });

  it("opens one and closes again", () => {
    const opened: string[] = [];
    surface({ history: HISTORY, onOpenConversation: (id) => opened.push(id) });
    open();

    fireEvent.click(screen.getByRole("button", { name: /Two plans/ }));
    expect(opened).toEqual(["a"]);
    // Picking one is the last thing the page is for, so the transcript is back.
    expect(screen.queryByRole("heading", { name: "Conversations" })).toBeNull();
  });

  it("forgets one without leaving the page", () => {
    const forgotten: string[] = [];
    surface({ history: HISTORY, onForgetConversation: (id) => forgotten.push(id) });
    open();

    fireEvent.click(screen.getByRole("button", { name: "Forget Two plans on this page" }));
    expect(forgotten).toEqual(["a"]);
    // Forgetting one is rarely the only one.
    expect(screen.getByRole("heading", { name: "Conversations" })).toBeTruthy();
  });

  it("carries no forget button where nothing answers one", () => {
    surface({ history: HISTORY });
    open();
    expect(screen.queryByRole("button", { name: /^Forget/ })).toBeNull();
  });

  it("holds one page at a time", () => {
    surface({
      history: HISTORY,
      models: [{ contextWindow: 200_000, id: "gpt-5", name: "GPT-5" }],
      providerLabel: "OpenAI",
    });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    // The way in is gone while a page is up: the back arrow is that spot now.
    expect(screen.queryByRole("button", { name: "Conversations" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    open();
    expect(screen.getByRole("heading", { name: "Conversations" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Settings" })).toBeNull();
  });
});
