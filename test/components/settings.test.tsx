import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Chat } from "../../src/components/chat.tsx";
import { ChatSettings } from "../../src/components/chat/settings.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

const PROVIDERS = [
  { id: "llm7", label: "LLM7" },
  { hasKey: true, id: "openai", keyed: true, keyPlaceholder: "sk-…", label: "OpenAI" },
  { id: "anthropic", keyed: true, keyPlaceholder: "sk-ant-…", label: "Anthropic" },
];

const MODELS = [
  { contextWindow: 400_000, id: "gpt-5", name: "GPT-5" },
  { contextWindow: 200_000, id: "gpt-5-mini", name: "GPT-5 mini" },
];

/** Past `SEARCH_FROM`, so the list carries its search field. */
const manyModels = () =>
  Array.from({ length: 12 }, (_, index) => ({
    contextWindow: 128_000,
    id: `m-${index}`,
    name: `Model ${index}`,
  }));

describe("ChatSettings", () => {
  it("shows provider, key, thinking and model at once", () => {
    render(
      <ChatSettings
        modelId="gpt-5"
        models={MODELS}
        providerId="openai"
        providers={PROVIDERS}
        thinkingLevel="medium"
        thinkingLevels={["off", "low", "medium", "high"]}
      />,
    );

    // A provider is already running, so the dropdown stays shut.
    expect(screen.queryByRole("menuitemradio")).toBeNull();

    // Nothing is behind a step: every section is on the page together.
    expect(screen.getByText("Provider")).toBeTruthy();
    expect(screen.getByText("OpenAI API key")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change key" })).toBeTruthy();
    expect(screen.getByText("Thinking")).toBeTruthy();
    expect(screen.getByText("Model — OpenAI")).toBeTruthy();

    // What is chosen says so — the provider on the dropdown's own face, so the
    // one line says which it is and what it costs without being opened.
    expect(screen.getByRole("button", { name: /OpenAI/ }).textContent).toBe("OpenAIKey saved");
    expect(screen.getByRole("button", { name: /GPT-5 mini/ }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.getByRole("button", { name: "Medium" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("400K ctx")).toBeTruthy();
  });

  it("offers to replace a saved key rather than an empty field", () => {
    const picked: string[] = [];
    const saved: [string, string][] = [];

    const { container } = render(
      <ChatSettings
        onProviderChange={(id) => picked.push(id)}
        onSaveKey={(id, key) => saved.push([id, key])}
        providerId="openai"
        providers={PROVIDERS}
      />,
    );

    // Nothing reads a key back out of storage, so there is nothing to show.
    expect(container.querySelector('input[type="password"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Change key" }));
    const key = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(key).toBeTruthy();
    expect(document.activeElement).toBe(key);

    fireEvent.input(key, { target: { value: "sk-new" } });
    fireEvent.keyDown(key, { key: "Enter" });
    expect(saved).toEqual([["openai", "sk-new"]]);
    // The provider was already running — replacing its key does not re-pick it.
    expect(picked).toEqual([]);
    expect(screen.getByRole("button", { name: "Change key" })).toBeTruthy();
  });

  it("removes a stored key only where a harness answers for one", () => {
    const forgotten: string[] = [];

    const { rerender } = render(<ChatSettings providerId="openai" providers={PROVIDERS} />);
    // A harness that cannot drop a key offers no button that would.
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();

    rerender(
      <ChatSettings
        onForgetKey={(id) => forgotten.push(id)}
        providerId="openai"
        providers={PROVIDERS}
      />,
    );
    expect(screen.getByText(/Removing the key stops OpenAI/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(forgotten).toEqual(["openai"]);
  });

  it("takes a free provider outright and a keyed one only after its key", () => {
    const picked: string[] = [];
    const saved: [string, string][] = [];

    const { container } = render(
      <ChatSettings
        onProviderChange={(id) => picked.push(id)}
        onSaveKey={(id, key) => saved.push([id, key])}
        providers={PROVIDERS}
      />,
    );

    const open = () =>
      fireEvent.click(screen.getByRole("button", { name: /Select a provider|LLM7/ }));

    // Nothing is running, so the page opens on the question it exists to ask.
    expect(screen.getAllByRole("menuitemradio").length).toBe(PROVIDERS.length);

    fireEvent.click(screen.getByRole("menuitemradio", { name: /LLM7/ }));
    expect(picked).toEqual(["llm7"]);
    // Choosing closes the menu — the page behind it is the rest of the answer.
    expect(screen.queryByRole("menuitemradio")).toBeNull();

    // A provider with no key asks for one, and is not chosen until it answers.
    open();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Anthropic/ }));
    expect(picked).toEqual(["llm7"]);
    expect(screen.getByText("Anthropic API key")).toBeTruthy();

    // The control still names what was clicked, and says why nothing switched —
    // `providerId` cannot name it yet, so the page must not look inert.
    expect(screen.getByRole("button", { name: /Anthropic/ }).textContent).toBe(
      "AnthropicNeeds key",
    );
    expect(screen.getByText(/Save the key to load Anthropic/)).toBeTruthy();

    const key = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.input(key, { target: { value: "sk-ant-live" } });
    fireEvent.click(screen.getByText("Save"));
    expect(saved).toEqual([["anthropic", "sk-ant-live"]]);
    expect(picked).toEqual(["llm7", "anthropic"]);
  });

  it("says which models are left when the filter matches none", () => {
    const { container } = render(<ChatSettings models={manyModels()} providerLabel="Local" />);
    const rows = () => container.querySelectorAll('[data-slot="chat-settings-row"]');

    const search = screen.getByLabelText("Search models") as HTMLInputElement;
    fireEvent.input(search, { target: { value: "Model 1" } });
    // 1 and 10 and 11.
    expect(rows().length).toBe(3);

    fireEvent.input(search, { target: { value: "nothing" } });
    expect(screen.getByText(/No models match/)).toBeTruthy();
  });

  it("gives the search field the focus, but not to a finger", () => {
    const many = manyModels();

    // jsdom carries no `matchMedia`, which reads as a pointer that is not coarse.
    const { container, rerender } = render(<ChatSettings models={many} providerLabel="Local" />);
    expect(document.activeElement).toBe(screen.getByLabelText("Search models"));

    // A key is what the page is waiting on, so the field for it keeps the focus.
    rerender(<ChatSettings models={many} providerId="openai" providers={PROVIDERS} />);
    fireEvent.click(screen.getByRole("button", { name: "Change key" }));
    expect(document.activeElement).toBe(container.querySelector('input[type="password"]'));

    cleanup();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("coarse") }));
    render(<ChatSettings models={many} providerLabel="Local" />);
    // A keyboard over the list it filters is worse than the list.
    expect(document.activeElement).toBe(document.body);
  });
});

describe("Chat", () => {
  it("shows the page in place of the transcript, and the header leads back", () => {
    render(
      <Chat
        isStreaming={false}
        messages={[]}
        modelId="gpt-5"
        models={MODELS}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        providerId="openai"
        providers={PROVIDERS}
        title="A conversation"
      />,
    );

    // The greeting stands in for the transcript: both are the conversation.
    expect(screen.getByText("agentak")).toBeTruthy();

    // Two ways in — the header's button, and the composer's trigger which also
    // names what is running.
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByText("Provider")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("agentak")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    expect(screen.queryByText("agentak")).toBeNull();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Provider")).toBeTruthy();
    // One title bar: the way back replaces the new-conversation button.
    expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("agentak")).toBeTruthy();
    expect(screen.getByText("A conversation")).toBeTruthy();
  });

  it("closes the page when a model is chosen, and gives the composer the focus", () => {
    const chosen: string[] = [];
    const { container } = render(
      <Chat
        isStreaming={false}
        messages={[]}
        modelId="gpt-5"
        models={MODELS}
        onModelChange={(id) => chosen.push(id)}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        providerId="openai"
        providers={PROVIDERS}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /GPT-5 mini/ }));

    expect(chosen).toEqual(["gpt-5-mini"]);
    // Back to the conversation, with the cursor where the next message goes.
    expect(screen.getByText("agentak")).toBeTruthy();
    expect(document.activeElement).toBe(container.querySelector("textarea"));
  });

  it("closes the page when a message is sent", () => {
    const sent: string[] = [];
    const open: boolean[] = [];
    const { container } = render(
      <Chat
        isStreaming={false}
        messages={[]}
        modelId="gpt-5"
        models={MODELS}
        onPickerOpenChange={(next) => open.push(next)}
        onReset={() => {}}
        onSend={(text) => sent.push(text)}
        onStop={() => {}}
        providers={PROVIDERS}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    expect(open).toEqual([true]);
    expect(screen.getByText("Provider")).toBeTruthy();

    const field = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.input(field, { target: { value: "hello" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(sent).toEqual(["hello"]);
    expect(open).toEqual([true, false]);
    expect(screen.getByText("agentak")).toBeTruthy();
  });
});
