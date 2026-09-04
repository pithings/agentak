import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Element } from "../../src/components/elements.tsx";
import { Progress } from "../../src/components/ui/progress.tsx";

afterEach(cleanup);

const fill = () => document.querySelector('[data-slot="progress-fill"]') as HTMLElement;

describe("Progress", () => {
  it("fills to the reading and names it", () => {
    render(<Progress label="Loading Granite 4.1 3B" value={42} />);

    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-label")).toBe("Loading Granite 4.1 3B");
    expect(fill().style.width).toBe("42%");
    expect(screen.getByText("42%")).toBeTruthy();
  });

  it("reads a value out of its own max as a percentage", () => {
    render(<Progress max={4} value={1} />);

    expect(screen.getByText("25%")).toBeTruthy();
    expect(fill().style.width).toBe("25%");
  });

  it("holds the ends of the track", () => {
    const { rerender } = render(<Progress value={-20} />);
    expect(fill().style.width).toBe("0%");

    rerender(<Progress value={400} />);
    expect(fill().style.width).toBe("100%");
  });

  it("sweeps, and reports no reading, when the length is unknown", () => {
    render(<Progress label="Loading" />);

    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe(null);
    expect(fill().style.width).toBe("25%");
    expect(screen.queryByText(/%/)).toBe(null);
  });
});

describe("the progress element", () => {
  it("is registered, so a marker in a turn draws a bar", () => {
    render(<Element name="progress" props={{ value: 40, label: "Loading" }} />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("Loading")).toBeTruthy();
  });
});
