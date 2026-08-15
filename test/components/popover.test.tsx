import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../src/components/ui/hover-card.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../../src/components/ui/popover.tsx";

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

    // fireEvent returns false when the handler cancelled the event: the panel
    // marks Escape used, so a host that closes on Escape too keeps its surface.
    expect(fireEvent.keyDown(document, { key: "Escape" })).toBe(false);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves Escape alone while it is closed", () => {
    render(<Basic />);

    expect(fireEvent.keyDown(document, { key: "Escape" })).toBe(true);
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
    expect(panel.style.getPropertyValue("--popover-offset")).toBe("12px");
  });

  // An anchor near the foot of the window, as the composer's picker is: `fill`
  // pulls the panel down over it to `EDGE` off the bottom, and counts the rows
  // it took as room — the panel then spans the band, less an edge at each end.
  // jsdom reports an empty rect for everything, so the anchor states its own.
  it("opens over the anchor under fill", async () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent fill side="top">
          body
        </PopoverContent>
      </Popover>,
    );

    const root = document.querySelector('[data-slot="popover"]') as HTMLElement;
    root.getBoundingClientRect = () =>
      ({ bottom: 318, height: 28, left: 0, right: 100, top: 290, width: 100 }) as DOMRect;

    const panel = screen.getByRole("dialog");
    const band = globalThis.innerHeight;
    await waitFor(() => {
      expect(panel.style.getPropertyValue("--popover-offset")).toBe(`${8 - (band - 290)}px`);
    });
    expect(panel.style.getPropertyValue("--popover-available")).toBe(`${band - 16}px`);
    expect(panel.dataset.side).toBe("top");
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
