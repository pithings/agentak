import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OpenIn,
  OpenInChatGPT,
  OpenInClaude,
  OpenInContent,
  OpenInCursor,
  OpenInItem,
  OpenInLabel,
  OpenInScira,
  OpenInSeparator,
  OpenInT3,
  OpenInTrigger,
  OpenInv0,
} from "@/components/ai-elements/open-in-chat";
import { declares } from "@/styles/declared";
import { styleText } from "@/styles/sheet";

afterEach(cleanup);

const query = "How do I center a div?";
/** URLSearchParams encoding: a space is `+`, `?` is `%3F`. */
const encoded = "How+do+I+center+a+div%3F";

function Menu(props: { defaultOpen?: boolean; onCopy?: () => void }) {
  return (
    <OpenIn defaultOpen={props.defaultOpen} query={query}>
      <OpenInTrigger />
      <OpenInContent>
        <OpenInLabel>Open this prompt in</OpenInLabel>
        <OpenInChatGPT />
        <OpenInClaude />
        <OpenInT3 />
        <OpenInScira />
        <OpenInv0 />
        <OpenInCursor />
        <OpenInSeparator />
        <OpenInItem onClick={props.onCopy}>Copy prompt</OpenInItem>
      </OpenInContent>
    </OpenIn>
  );
}

const menuItems = () => screen.getAllByRole("menuitem");

describe("OpenIn", () => {
  it("renders the default trigger and no menu", () => {
    render(<Menu />);
    const trigger = screen.getByText("Open in chat");

    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("builds every provider link from the query", () => {
    render(<Menu defaultOpen />);

    const href = (title: string) =>
      screen.getByText(title).closest("a")?.getAttribute("href") ?? "";

    expect(href("Open in ChatGPT")).toBe(`https://chatgpt.com/?hints=search&prompt=${encoded}`);
    expect(href("Open in Claude")).toBe(`https://claude.ai/new?q=${encoded}`);
    expect(href("Open in T3 Chat")).toBe(`https://t3.chat/new?q=${encoded}`);
    expect(href("Open in Scira")).toBe(`https://scira.ai/?q=${encoded}`);
    expect(href("Open in v0")).toBe(`https://v0.app?q=${encoded}`);
    expect(href("Open in Cursor")).toBe(`https://cursor.com/link/prompt?text=${encoded}`);

    // Every provider link opens away from the page, and safely.
    for (const title of ["Open in ChatGPT", "Open in Cursor"]) {
      const link = screen.getByText(title).closest("a");
      expect(link?.getAttribute("target")).toBe("_blank");
      expect(link?.getAttribute("rel")).toBe("noopener");
    }
  });

  it("opens on a click, as a menu of menuitems", () => {
    render(<Menu />);

    fireEvent.click(screen.getByText("Open in chat"));

    const panel = screen.getByRole("menu");
    expect(panel.getAttribute("aria-orientation")).toBe("vertical");
    expect(panel.dataset.align).toBe("start");
    expect(menuItems()).toHaveLength(7); // Six providers plus the plain item.
    expect(screen.getByText("Open this prompt in")).toBeTruthy();
  });

  it("declares every class it renders", () => {
    const { container } = render(<Menu defaultOpen />);

    const sheet = styleText();
    const used = new Set<string>();
    for (const element of container.querySelectorAll("*")) {
      for (const name of element.classList) {
        if (name.startsWith("wa-")) used.add(name);
      }
    }

    // Guards against a vacuous check. Counts `data-slot`, not `wa-` classes:
    // a class lives only while a rule selects it, so that count falls to zero as
    // styles move inline, but every component keeps its slot.
    expect(container.querySelectorAll("[data-slot]").length).toBeGreaterThan(5);
    expect([...used].filter((name) => !declares(sheet, name))).toEqual([]);
  });
});

describe("DropdownMenu keyboard", () => {
  it("opens on ArrowDown with focus on the first item, ArrowUp on the last", () => {
    const { unmount } = render(<Menu />);

    fireEvent.keyDown(screen.getByText("Open in chat"), { key: "ArrowDown" });
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(document.activeElement).toBe(menuItems()[0]);

    unmount();
    render(<Menu />);

    fireEvent.keyDown(screen.getByText("Open in chat"), { key: "ArrowUp" });
    const items = menuItems();
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("does not move focus when the pointer opened the menu", () => {
    render(<Menu />);
    const trigger = screen.getByText("Open in chat");

    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("menu"));
  });

  it("rolls focus around the items, with Home and End", () => {
    render(<Menu defaultOpen />);
    const panel = screen.getByRole("menu");
    const items = menuItems();
    const last = items[items.length - 1];

    fireEvent.keyDown(panel, { key: "ArrowDown" }); // From the panel itself.
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(panel, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(panel, { key: "ArrowUp" });
    fireEvent.keyDown(panel, { key: "ArrowUp" }); // Wraps off the first.
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(panel, { key: "ArrowDown" }); // Wraps off the last.
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(panel, { key: "End" });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(panel, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("activates the focused item with Enter and with Space, once", () => {
    const onCopy = vi.fn();
    render(<Menu defaultOpen onCopy={onCopy} />);

    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Enter" });

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull(); // Activation closes the menu.

    fireEvent.click(screen.getByText("Open in chat"));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    fireEvent.keyDown(screen.getByRole("menu"), { key: " " });

    expect(onCopy).toHaveBeenCalledTimes(2);
  });

  it("closes on Escape and gives focus back to the trigger", () => {
    render(<Menu />);
    const trigger = screen.getByText("Open in chat");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItems()[0]);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on a click outside", () => {
    render(<Menu defaultOpen />);

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole("menu")).toBeNull();
  });
});
