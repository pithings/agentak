import type { ComponentProps } from "preact";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { ChatComposer } from "../../src/components/chat/composer.tsx";

afterEach(cleanup);

const MODELS = [
  { contextWindow: 400_000, id: "gpt-5", name: "GPT-5" },
  { contextWindow: 200_000, id: "gpt-5-mini", name: "GPT-5 mini" },
];

const PROVIDERS = [{ id: "openai", label: "OpenAI" }];

const composer = (props: Partial<ComponentProps<typeof ChatComposer>> = {}) => (
  <ChatComposer
    isStreaming={false}
    modelId="gpt-5"
    models={MODELS}
    onSend={() => {}}
    onStop={() => {}}
    providerId="openai"
    providers={PROVIDERS}
    {...props}
  />
);

describe("ChatComposer", () => {
  it("names the model and asks the surface for the settings page", () => {
    const opened: boolean[] = [];
    render(composer({ onPickerOpenChange: (open) => opened.push(open) }));

    // A model id says nothing about where it runs, so the provider comes with it.
    const trigger = screen.getByRole("button", { name: /GPT-5/ });
    expect(trigger.textContent).toBe("GPT-5 (OpenAI)");

    // The trigger opens nothing itself — the page stands where the transcript
    // is, which only `Chat` can answer for.
    fireEvent.click(trigger);
    expect(opened).toEqual([true]);
  });

  it("gives the focus to the textarea when the settings page closes", async () => {
    const { rerender } = render(composer({ pickerOpen: true }));
    expect((document.activeElement as HTMLElement)?.tagName).not.toBe("TEXTAREA");

    rerender(composer({ pickerOpen: false }));
    await Promise.resolve();
    expect((document.activeElement as HTMLElement)?.tagName).toBe("TEXTAREA");
  });

  it("says so in the meter when the window is nearly spent", () => {
    const meter = (nearLimit: boolean) => (
      <ChatComposer
        isStreaming={false}
        onSend={() => {}}
        onStop={() => {}}
        usage={{ maxTokens: 200_000, nearLimit, usedTokens: 190_000 }}
      />
    );

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
