import type { ComponentProps } from "preact";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { ChatBar } from "../../src/components/chat/bar.tsx";

afterEach(cleanup);

const MODELS = [
  { contextWindow: 400_000, id: "gpt-5", name: "GPT-5" },
  { contextWindow: 200_000, id: "gpt-5-mini", name: "GPT-5 mini" },
];

const PROVIDERS = [{ id: "openai", label: "OpenAI" }];

const bar = (props: Partial<ComponentProps<typeof ChatBar>> = {}) => (
  <ChatBar modelId="gpt-5" models={MODELS} providerId="openai" providers={PROVIDERS} {...props} />
);

describe("ChatBar", () => {
  it("names the model and asks the surface for the settings page", () => {
    const opened: boolean[] = [];
    render(bar({ onPickerOpenChange: (open) => opened.push(open) }));

    // A model id says nothing about where it runs, so the provider comes with it.
    const trigger = screen.getByRole("button", { name: /GPT-5/ });
    expect(trigger.textContent).toBe("GPT-5 (OpenAI)");

    // The trigger opens nothing itself — the page stands where the transcript
    // is, which only `Chat` can answer for.
    fireEvent.click(trigger);
    expect(opened).toEqual([true]);
  });

  it("says nothing about a model where there is nothing to choose", () => {
    render(<ChatBar />);
    expect(screen.queryByRole("button", { name: /Select a provider/ })).toBeNull();
  });

  it("reads from both ends: what a click changes, then what the turns cost", () => {
    const { container } = render(
      bar({
        onToolPolicyChange: () => {},
        toolPolicy: "bypass",
        usage: { maxTokens: 200_000, usedTokens: 20_000 },
      }),
    );

    const row = container.firstElementChild as HTMLElement;
    // The row ends at the meter: the host's own chrome heads the surface with
    // the title instead.
    expect([...row.children].map((el) => el.textContent)).toEqual([
      "GPT-5 (OpenAI)",
      "Bypass",
      "", // The gap that holds the two ends apart.
      "1010%20K / 200K", // The meter: the ring's own label, then the reading.
    ]);
  });

  it("switches what stands in front of a tool call, and says which state it is in", () => {
    const asked: string[] = [];
    const gate = (toolPolicy: "ask" | "bypass") =>
      bar({ onToolPolicyChange: (policy) => asked.push(policy), toolPolicy });

    const { rerender } = render(gate("bypass"));
    // Each state says which one it is: a shield alone is a picture of a gate
    // and not of a gate that is up.
    const off = screen.getByRole("button", { name: "Bypass tool confirmations" });
    expect(off.getAttribute("aria-pressed")).toBe("true");
    expect(off.textContent).toBe("Bypass");

    fireEvent.click(off);
    expect(asked).toEqual(["ask"]);

    rerender(gate("ask"));
    const on = screen.getByRole("button", { name: "Ask before tool calls" });
    expect(on.getAttribute("aria-pressed")).toBe("false");
    expect(on.textContent).toBe("Ask");

    fireEvent.click(on);
    expect(asked).toEqual(["ask", "bypass"]);
  });

  it("shows no such switch where nothing is gated", () => {
    render(bar({ onToolPolicyChange: () => {} }));
    expect(screen.queryByRole("button", { name: /Bypass/ })).toBeNull();
  });

  it("offers a compaction inside the meter, and only where one is offered", () => {
    const asked: number[] = [];
    const usage = { maxTokens: 200_000, nearLimit: true, usedTokens: 190_000 };

    const { rerender } = render(bar({ usage }));
    fireEvent.click(screen.getByRole("img", { name: /%/ }).closest("button") as HTMLButtonElement);
    // A harness that cannot compact shows no button for it.
    expect(screen.queryByRole("button", { name: "Compact" })).toBeNull();

    rerender(bar({ onCompact: () => asked.push(1), usage }));
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(asked).toEqual([1]);
  });

  it("says why it waits where a compaction would change nothing", () => {
    render(
      bar({
        onCompact: () => {},
        usage: { canCompact: false, maxTokens: 200_000, usedTokens: 1_000 },
      }),
    );
    fireEvent.click(screen.getByRole("img", { name: /%/ }).closest("button") as HTMLButtonElement);

    // Offered and not hidden, so the panel says what the button is for — and
    // disabled, so a click is never a click that does nothing.
    expect(screen.getByRole("button", { name: "Compact" })).toHaveProperty("disabled", true);
    expect(screen.getByText(/Nothing to compact/)).toBeTruthy();
  });

  it("waits for the turn, and says so while a compaction runs", () => {
    const compact = { maxTokens: 200_000, usedTokens: 190_000 };

    const { rerender } = render(bar({ busy: true, onCompact: () => {}, usage: compact }));
    fireEvent.click(screen.getByRole("img", { name: /%/ }).closest("button") as HTMLButtonElement);
    expect(screen.getByRole("button", { name: "Compact" })).toHaveProperty("disabled", true);

    rerender(bar({ onCompact: () => {}, usage: { ...compact, compacting: true } }));
    const running = screen.getByRole("button", { name: "Compacting…" });
    expect(running).toHaveProperty("disabled", true);
  });

  it("says so in the meter when the window is nearly spent", () => {
    const meter = (nearLimit: boolean) =>
      bar({ usage: { maxTokens: 200_000, nearLimit, usedTokens: 190_000 } });

    const { rerender } = render(meter(false));
    // The ring reads the same either way; only the warning is new.
    const ring = screen.getByRole("img", { name: /95%$/ });
    fireEvent.click(ring.closest("button") as HTMLButtonElement);
    expect(screen.queryByText(/Near the context limit/)).toBeNull();

    rerender(meter(true));
    expect(screen.getByRole("img", { name: /near the limit/ })).toBeTruthy();
    expect(screen.getByText(/Near the context limit/)).toBeTruthy();
  });
});
