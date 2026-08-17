import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Context } from "../../src/components/ai-elements/context.tsx";

afterEach(cleanup);

const meter = () => document.querySelector('[data-slot="collapsible"]') as HTMLElement;
const panel = () => document.querySelector('[data-slot="collapsible-content"]') as HTMLElement;
const shut = () => panel().hidden;

/** Longer than either delay, so a wait that changes nothing has really passed. */
const REST = 250;
const rest = () => new Promise((resolve) => setTimeout(resolve, REST));

function Basic(props: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return (
    <Context
      maxTokens={200_000}
      onOpenChange={props.onOpenChange}
      open={props.open}
      usage={{ inputTokens: 100, outputTokens: 20, reasoningTokens: 0, cachedInputTokens: 0 }}
      usedTokens={120}
    />
  );
}

describe("Context", () => {
  it("opens where the pointer arrives and shuts where it leaves", async () => {
    render(<Basic />);

    fireEvent.pointerEnter(meter());
    expect(shut()).toBe(true); // Not on the first frame.
    await waitFor(() => expect(shut()).toBe(false));

    fireEvent.pointerLeave(meter());
    await waitFor(() => expect(shut()).toBe(true));
  });

  // The pointer crossing the gap under the panel leaves the meter, then enters
  // it again on the way into the breakdown.
  it("keeps the panel where the pointer comes back", async () => {
    render(<Basic />);

    fireEvent.pointerEnter(meter());
    await waitFor(() => expect(shut()).toBe(false));

    fireEvent.pointerLeave(meter());
    fireEvent.pointerEnter(meter());

    await rest();
    expect(shut()).toBe(false);
  });

  it("still toggles on a click, and the click wins over a pending open", async () => {
    render(<Basic />);
    const trigger = screen.getByRole("button");

    fireEvent.click(trigger);
    expect(shut()).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.pointerEnter(meter());
    fireEvent.click(trigger);
    await rest();
    expect(shut()).toBe(true);
  });

  it("leaves a tap to the click behind it", async () => {
    render(<Basic />);

    fireEvent.pointerEnter(meter(), { pointerType: "touch" });
    await rest();
    expect(shut()).toBe(true);
  });

  it("reports to onOpenChange and stays shut while controlled", async () => {
    const seen: boolean[] = [];
    render(<Basic onOpenChange={(open) => seen.push(open)} open={false} />);

    fireEvent.pointerEnter(meter());

    await waitFor(() => expect(seen).toEqual([true]));
    expect(shut()).toBe(true); // The prop still says closed.
  });
});
