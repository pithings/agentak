import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { ChatComposer } from "../../src/components/chat/composer.tsx";

afterEach(cleanup);

const MODELS = [
  { contextWindow: 400_000, id: "gpt-5", name: "GPT-5" },
  { contextWindow: 200_000, id: "gpt-5-mini", name: "GPT-5 mini" },
];

const PROVIDERS = [{ id: "openai", label: "OpenAI" }];

const composer = () => (
  <ChatComposer
    isStreaming={false}
    modelId="gpt-5"
    models={MODELS}
    onSend={() => {}}
    onStop={() => {}}
    providerId="openai"
    providers={PROVIDERS}
  />
);

describe("ChatComposer", () => {
  it("gives the focus to the textarea when a model is chosen by click", async () => {
    render(composer());
    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    fireEvent.click(screen.getByText("GPT-5 mini"));

    await Promise.resolve();
    expect((document.activeElement as HTMLElement)?.tagName).toBe("TEXTAREA");
  });

  it("gives the focus to the textarea when a model is chosen by Enter", async () => {
    render(composer());
    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    const search = screen.getByPlaceholderText("Search models…");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

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
