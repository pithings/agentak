import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { ChatPicker } from "../../src/components/_parked/chat/picker.tsx";

afterEach(cleanup);

const PROVIDERS = [
  { id: "llm7", label: "LLM7" },
  { id: "openai", keyed: true, keyPlaceholder: "sk-…", label: "OpenAI" },
];

const MODELS = [{ contextWindow: 400_000, id: "gpt-5", name: "GPT-5" }];

describe("ChatPicker", () => {
  it("chooses provider, then key, then model, in the one panel", () => {
    const picked: string[] = [];
    const saved: [string, string][] = [];

    const picker = (providerId?: string) => (
      <ChatPicker
        modelId={providerId && "gpt-5"}
        models={providerId ? MODELS : []}
        onProviderChange={(id) => picked.push(id)}
        onSaveKey={(id, key) => saved.push([id, key])}
        providerId={providerId}
        providers={PROVIDERS}
      />
    );

    // No provider: the panel opens on the providers, with no way past them.
    const { container, rerender } = render(picker());
    fireEvent.click(screen.getByText("Select a provider"));
    expect(screen.getByText("Providers")).toBeTruthy();
    expect(screen.getByText("BYOK")).toBeTruthy();
    expect(screen.queryByText("400K")).toBeNull();

    // A free provider is taken at once, and the panel goes on to its models.
    fireEvent.click(screen.getByText("LLM7"));
    expect(picked).toEqual(["llm7"]);
    expect(screen.getByPlaceholderText("Search models…")).toBeTruthy();

    // A provider with no key asks for one before it is chosen at all.
    fireEvent.click(screen.getByRole("button", { name: "Providers" }));
    fireEvent.click(screen.getByText("OpenAI"));
    expect(picked).toEqual(["llm7"]);
    expect(screen.getByText("OpenAI API key")).toBeTruthy();

    const key = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.input(key, { target: { value: "sk-live" } });
    fireEvent.click(screen.getByText("Save"));
    expect(saved).toEqual([["openai", "sk-live"]]);
    expect(picked).toEqual(["llm7", "openai"]);

    // Saved, and again on the models — the panel never closes on a provider.
    rerender(picker("openai"));
    expect(screen.getByText("400K")).toBeTruthy();
    expect(screen.getByText("(OpenAI)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Providers" }));
    expect(screen.getByText("Providers")).toBeTruthy();
    expect(screen.queryByText("400K")).toBeNull();
  });

  it("opens on the caller's word — how a first message asks", () => {
    render(<ChatPicker pickerOpen providers={PROVIDERS} />);

    expect(screen.getByText("Select a provider")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search providers…")).toBeTruthy();
  });

  it("hands the focus back to the search on every level, so the keys still work", () => {
    render(
      <ChatPicker modelId="gpt-5" models={MODELS} providerId="openai" providers={PROVIDERS} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    const models = screen.getByPlaceholderText("Search models…");
    expect(document.activeElement).toBe(models);

    // A click takes the focus with it — the level behind must take it back.
    const back = screen.getByRole("button", { name: "Providers" });
    back.focus();
    fireEvent.click(back);
    const providers = screen.getByPlaceholderText("Search providers…");
    expect(document.activeElement).toBe(providers);

    // Which is what the arrow keys need: they are the panel's, not the field's.
    fireEvent.keyDown(providers, { key: "ArrowDown" });
    const row = screen.getByText("OpenAI").closest("[aria-selected]");
    expect(row?.getAttribute("aria-selected")).toBe("true");
  });

  it("shows the thinking level only when the model offers a choice", () => {
    const chosen: string[] = [];
    const level = (levels?: ("off" | "low" | "high")[]) => (
      <ChatPicker
        modelId="gpt-5"
        models={MODELS}
        onThinkingLevelChange={(next) => chosen.push(next)}
        providerId="openai"
        providers={PROVIDERS}
        thinkingLevel="low"
        thinkingLevels={levels}
      />
    );

    // One level is no choice, so nothing is offered.
    const { rerender } = render(level(["off"]));
    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    expect(screen.queryByRole("button", { name: /Thinking level/ })).toBeNull();

    rerender(level(["off", "low", "high"]));
    fireEvent.click(screen.getByRole("button", { name: "Thinking level: Low" }));
    expect(screen.getByText("Thinking")).toBeTruthy();
    // Its own level, so the way back is the models rather than the providers.
    expect(screen.getByRole("button", { name: /Models/ })).toBeTruthy();

    fireEvent.click(screen.getByText("High"));
    expect(chosen).toEqual(["high"]);
    // And back on the models, which is what the level was chosen for.
    expect(screen.getByPlaceholderText("Search models…")).toBeTruthy();
  });

  it("goes back a level on backspace, once the field is empty", () => {
    render(
      <ChatPicker modelId="gpt-5" models={MODELS} providerId="openai" providers={PROVIDERS} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    const search = screen.getByPlaceholderText("Search models…");

    // Something to delete: the key does what it always does.
    fireEvent.input(search, { target: { value: "gp" } });
    fireEvent.keyDown(search, { key: "Backspace" });
    expect(screen.getByText("400K")).toBeTruthy();

    fireEvent.input(search, { target: { value: "" } });
    fireEvent.keyDown(search, { key: "Backspace" });
    expect(screen.getByText("Providers")).toBeTruthy();
    expect(screen.queryByText("400K")).toBeNull();
  });
});
