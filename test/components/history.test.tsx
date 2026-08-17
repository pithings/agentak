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

  it("keeps the button with the others at the end of the bar", () => {
    surface({ history: HISTORY });
    const header = screen.getByRole("button", { name: "Conversations" }).parentElement;
    // The title leads and the buttons follow it, in the order they are reached
    // for. An unnamed conversation still takes the room the title would have,
    // else the row packs right and nothing holds its two ends apart.
    expect(header?.firstElementChild?.getAttribute("style")).toContain("flex: 1");
    expect([...(header?.children ?? [])].map((el) => el.getAttribute("aria-label"))).toEqual([
      null,
      "New conversation",
      "Conversations",
    ]);
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

  it("offers the newest few under the greeting, and the way to the rest", () => {
    const opened: string[] = [];
    const many = [
      ...HISTORY,
      { id: "c", title: "Third", updated: Date.now() - 3 * MINUTE },
      { id: "d", title: "Fourth", updated: Date.now() - 4 * MINUTE },
    ];
    surface({ history: many, onOpenConversation: (id) => opened.push(id) });

    const recent = screen.getByRole("group", { name: "Recent chats" });
    expect(recent.textContent).toContain("Third");
    // Three, and no more — the fourth is what the page is for.
    expect(recent.textContent).not.toContain("Fourth");

    fireEvent.click(screen.getByRole("button", { name: /Two plans/ }));
    expect(opened).toEqual(["a"]);
  });

  it("shows no recent block where nothing opens a row", () => {
    surface({ history: HISTORY });
    expect(screen.queryByRole("group", { name: "Recent chats" })).toBeNull();
  });

  it("shows no recent block where nothing is stored yet", () => {
    surface({ history: [], onOpenConversation: () => {} });
    expect(screen.queryByRole("group", { name: "Recent chats" })).toBeNull();
  });

  it("goes with the greeting once something is said", () => {
    surface({
      history: HISTORY,
      messages: [{ id: "m1", parts: [{ kind: "text", text: "Hello" }], role: "user" }],
      onOpenConversation: () => {},
    });
    expect(screen.queryByRole("group", { name: "Recent chats" })).toBeNull();
  });

  it("opens the page from the last row", () => {
    surface({ history: HISTORY, onOpenConversation: () => {} });

    fireEvent.click(screen.getByRole("button", { name: "All conversations" }));
    expect(screen.getByRole("heading", { name: "Conversations" })).toBeTruthy();
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
