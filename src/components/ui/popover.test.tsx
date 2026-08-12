import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { declares } from "@/styles/declared";
import { styleText } from "@/styles/sheet";

afterEach(cleanup);

function Basic(props: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return (
    <Popover onOpenChange={props.onOpenChange} open={props.open}>
      <PopoverTrigger>Open</PopoverTrigger>
      <PopoverContent>
        <button type="button">Inside</button>
      </PopoverContent>
    </Popover>
  );
}

describe("Popover", () => {
  it("opens and closes from the trigger", () => {
    render(<Basic />);
    const trigger = screen.getByText("Open");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(screen.getByRole("dialog").id);

    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports to onOpenChange and stays shut while controlled", () => {
    const seen: boolean[] = [];
    render(<Basic onOpenChange={(open) => seen.push(open)} open={false} />);

    fireEvent.click(screen.getByText("Open"));

    expect(seen).toEqual([true]);
    expect(screen.queryByRole("dialog")).toBeNull(); // The prop still says closed.
  });

  it("closes on Escape and gives focus back to the trigger", () => {
    render(<Basic />);
    const trigger = screen.getByText("Open");

    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByText("Inside"));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on an outside pointerdown but not on one inside", () => {
    render(<Basic />);
    fireEvent.click(screen.getByText("Open"));

    fireEvent.pointerDown(screen.getByText("Inside"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Tab inside the panel", () => {
    render(<Basic />);
    fireEvent.click(screen.getByText("Open"));

    const panel = screen.getByRole("dialog");
    const inside = screen.getByText("Inside");

    // One focusable, so both directions land back on it.
    fireEvent.keyDown(panel, { key: "Tab" });
    expect(document.activeElement).toBe(inside);
    fireEvent.keyDown(panel, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(inside);
  });

  it("carries side, align and the offset variable", () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent align="start" side="right" sideOffset={12}>
          body
        </PopoverContent>
      </Popover>,
    );

    const panel = screen.getByRole("dialog");
    expect(panel.dataset.side).toBe("right"); // jsdom has no layout, so no flip.
    expect(panel.dataset.align).toBe("start");
    expect(panel.style.getPropertyValue("--wa-popover-offset")).toBe("12px");
  });

  it("declares every class it renders", () => {
    const { container } = render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent>card</HoverCardContent>
      </HoverCard>,
    );

    const sheet = styleText();
    const used = new Set<string>();
    for (const element of container.querySelectorAll("*")) {
      for (const name of element.classList) {
        if (name.startsWith("wa-")) used.add(name);
      }
    }

    // A class only earns its place if a rule still selects it — styles that need
    // no selector are inline now. Counting classes would measure nothing.
    expect([...used].filter((name) => !declares(sheet, name))).toEqual([]);
  });
});

describe("HoverCard", () => {
  it("waits out the open delay, then closes after the pointer leaves", async () => {
    render(
      <HoverCard closeDelay={20} openDelay={40}>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent>card</HoverCardContent>
      </HoverCard>,
    );
    const trigger = screen.getByText("Trigger");

    fireEvent.pointerEnter(trigger);
    expect(screen.queryByText("card")).toBeNull(); // Not on the first frame.

    await waitFor(() => expect(screen.getByText("card")).toBeTruthy());

    fireEvent.pointerLeave(trigger);
    await waitFor(() => expect(screen.queryByText("card")).toBeNull());
  });

  it("stays open while the pointer is over the card", async () => {
    render(
      <HoverCard closeDelay={20} defaultOpen openDelay={40}>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent>card</HoverCardContent>
      </HoverCard>,
    );

    fireEvent.pointerLeave(screen.getByText("Trigger"));
    fireEvent.pointerEnter(screen.getByText("card")); // Cancels the pending close.

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(screen.getByText("card")).toBeTruthy();
  });

  it("does not toggle on a click and does not take focus", () => {
    render(
      <HoverCard defaultOpen>
        <HoverCardTrigger>Trigger</HoverCardTrigger>
        <HoverCardContent>
          <a href="https://example.com">link</a>
        </HoverCardContent>
      </HoverCard>,
    );

    expect(document.activeElement).not.toBe(screen.getByText("link"));

    fireEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText("link")).toBeTruthy();
  });
});
