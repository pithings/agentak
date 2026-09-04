import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("Progress that hides when it is done", () => {
  /** Past the rest and the fade — see `REST_MS` and `FADE_MS`. */
  const OVER = 1400;

  const bar = () => document.querySelector('[data-slot="progress"]') as HTMLElement | null;

  it("fades, then goes, when the bar fills", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<Progress hideWhenDone label="Loading" value={40} />);
      await act(async () => rerender(<Progress hideWhenDone label="Loading" value={100} />));

      // Full, and still on screen: the reader is shown the work finishing.
      expect(bar()?.dataset.state).toBe("open");

      await act(async () => void vi.advanceTimersByTime(1100));
      expect(bar()?.dataset.state).toBe("leaving");

      await act(async () => void vi.advanceTimersByTime(OVER));
      expect(bar()).toBe(null);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never appears when it arrives full, as a stored turn does", () => {
    render(<Progress hideWhenDone label="Loading" value={100} />);

    expect(bar()).toBe(null);
    expect(screen.queryByRole("progressbar")).toBe(null);
  });

  it("stays where it is not asked to leave", async () => {
    vi.useFakeTimers();
    try {
      render(<Progress label="Loading" value={100} />);
      await act(async () => void vi.advanceTimersByTime(OVER));

      expect(screen.getByRole("progressbar")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("the progress element", () => {
  it("is registered, so a marker in a turn draws a bar", () => {
    render(<Element name="progress" props={{ value: 40, label: "Loading" }} />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("Loading")).toBeTruthy();
  });

  it("leaves the turn it reported on, once it is full", () => {
    render(<Element name="progress" props={{ value: 100, label: "Loading" }} />);

    expect(screen.queryByRole("progressbar")).toBe(null);
  });
});
