import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Chat } from "../../src/components/chat.tsx";
import type { ChatProps } from "../../src/components/chat.tsx";
import { registerElements } from "../../src/components/elements.tsx";

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

/** What a host contributes: definitions, and never a node of its own. */
describe("host actions", () => {
  it("draws a definition as one of the title bar's own buttons", () => {
    const onClick = vi.fn();
    surface({
      actions: [{ icon: "panel-right-close", id: "collapse", label: "Collapse", onClick }],
    });

    const button = screen.getByRole("button", { name: "Collapse" });
    // The name is the tooltip too: the button carries a picture and no words.
    expect(button.getAttribute("title")).toBe("Collapse");
    expect(button.textContent).toBe("");
    expect(button.querySelector("svg")).toBeTruthy();

    // At the corner, past the buttons that change which conversation this is.
    const header = button.closest("header") as HTMLElement;
    expect(header).toBeTruthy();
    expect(header.lastElementChild).toBe(button);

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("sizes a host's glyph as it sizes its own", () => {
    surface({
      actions: [
        { icon: "panel-right-close", id: "collapse", label: "Collapse", onClick: () => {} },
      ],
    });

    // `Button` sizes the icons among its children by their type, so a wrapper
    // component around one would draw at its own 24px beside 16px buttons.
    const glyph = screen.getByRole("button", { name: "Collapse" }).querySelector("svg");
    const own = screen.getByRole("button", { name: "New conversation" }).querySelector("svg");
    expect(glyph?.getAttribute("style")).toBe(own?.getAttribute("style"));
    expect(glyph?.getAttribute("style")).toContain("width: 1rem");
  });

  it("draws an icon it does not ship from the path data it was given", () => {
    surface({
      actions: [{ icon: { paths: ["M4 4h16"] }, id: "x", label: "Put away", onClick: () => {} }],
    });

    const path = screen.getByRole("button", { name: "Put away" }).querySelector("path");
    expect(path?.getAttribute("d")).toBe("M4 4h16");
  });

  it("says the state of a switch, and carries words where it has them", () => {
    surface({
      actions: [
        { id: "pin", label: "Pin the panel", onClick: () => {}, pressed: true, text: "Pin" },
      ],
    });

    const button = screen.getByRole("button", { name: "Pin the panel" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toBe("Pin");
  });

  it("stays in the header once the conversation has started", () => {
    surface({
      actions: [{ id: "collapse", label: "Collapse", onClick: () => {}, text: "Collapse" }],
      messages: [{ id: "m1", parts: [{ kind: "text", text: "hello" }], role: "user" }],
    });

    expect(screen.getByRole("button", { name: "Collapse" })).toBeTruthy();
  });

  it("stays there while a page stands in front of the transcript", () => {
    surface({
      actions: [{ id: "collapse", label: "Collapse", onClick: () => {}, text: "Collapse" }],
      models: [{ contextWindow: 1000, id: "m", name: "M" }],
      pickerOpen: true,
    });

    // The page replaces the controls of the conversation, not the host's own:
    // a chat that cannot be put away while its settings are up is a trap.
    expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();
    expect(screen.getByRole("button", { name: "Collapse" })).toBeTruthy();
  });
});

describe("host content in the empty state", () => {
  it("renders prose, buttons and a registered element, and nothing else", () => {
    const onClick = vi.fn();
    registerElements({
      launcher: (props) => <p>{String(props.text)}</p>,
    });

    surface({
      emptyItems: [
        { kind: "text", text: "Ask me about this page." },
        { actions: [{ id: "tour", label: "Take a tour", onClick }], kind: "actions" },
        { kind: "element", name: "launcher", props: { text: "From the registry" } },
        // A name nothing registered leaves the surface as it was.
        { kind: "element", name: "nothing-registered" },
      ],
    });

    expect(screen.getByText("Ask me about this page.")).toBeTruthy();
    expect(screen.getByText("From the registry")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Take a tour" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("goes once something has been said", () => {
    surface({
      emptyItems: [{ kind: "text", text: "Ask me about this page." }],
      messages: [{ id: "m1", parts: [{ kind: "text", text: "hello" }], role: "user" }],
    });

    expect(screen.queryByText("Ask me about this page.")).toBeNull();
  });

  it("leads with the way to the settings page while no provider is set", () => {
    surface({
      emptyItems: [{ kind: "text", text: "Ask me about this page." }],
      providers: [{ id: "openai", keyed: true, label: "OpenAI" }],
    });

    const hint = screen.getByRole("button", { name: /Select a model/ });
    const note = screen.getByText("Ask me about this page.");
    // Choosing a model comes before whatever the host offers to do with one.
    expect(hint.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The page it opens stands where the transcript was, so the empty state goes.
    fireEvent.click(hint);
    expect(screen.getByText("Provider")).toBeTruthy();
    expect(screen.queryByText("Ask me about this page.")).toBeNull();
  });

  it("says nothing about a model where one is already set", () => {
    surface({
      providerId: "openai",
      providers: [{ id: "openai", keyed: true, label: "OpenAI" }],
    });

    expect(screen.queryByRole("button", { name: /Select a model/ })).toBeNull();
  });
});
