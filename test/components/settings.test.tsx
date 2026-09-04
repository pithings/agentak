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

/** Two models over several releases, oldest first, as a catalog lists them. */
const CATALOG = [
  { contextWindow: 400_000, id: "openai/gpt-5.5", name: "GPT 5.5" },
  { contextWindow: 400_000, id: "openai/gpt-5.6-luna", name: "GPT 5.6 Luna" },
  { contextWindow: 400_000, id: "openai/gpt-5.6-sol", name: "GPT 5.6 Sol" },
  { contextWindow: 200_000, id: "openai/gpt-5.4-mini", name: "GPT 5.4 Mini" },
  { contextWindow: 200_000, id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" },
  { contextWindow: 1_000_000, id: "anthropic/claude-sonnet-5", name: "Claude Sonnet 5" },
];

/** That same catalog with the long tail a gateway carries around it. */
const GATEWAY = [
  ...CATALOG,
  { contextWindow: 1_000_000, id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash" },
  { contextWindow: 1_000_000, id: "google/gemini-3.7-flash", name: "Gemini 3.7 Flash" },
  { contextWindow: 128_000, id: "sakana/namazu", name: "Sakana Namazu" },
  { contextWindow: 128_000, id: "poolside/laguna-s-2.1", name: "Laguna S 2.1" },
  { contextWindow: 128_000, id: "thinkingmachines/inkling", name: "Inkling" },
  { contextWindow: 128_000, id: "nvidia/nemotron-3-ultra", name: "Nemotron 3 Ultra" },
  { contextWindow: 128_000, id: "tencent/hy3", name: "Hy3" },
];

/** The model dropdown: one control, and the list it opens. */
const menu = (container: Element) =>
  container.querySelector('[data-slot="chat-settings-models"]') as HTMLElement;

/** What names the model that is running, and opens the list. */
const face = (container: Element) =>
  menu(container).querySelector('[data-slot="dropdown-menu-trigger"]') as HTMLElement;

/** The model rows in order, by their name and not the meta beside it. */
const names = (container: Element) =>
  [...menu(container).querySelectorAll('[role="menuitemradio"]')].map(
    (row) => row.querySelector("span")?.textContent,
  );

describe("ChatSettings", () => {
  it("shows provider, key, thinking and model at once", () => {
    const { container } = render(
      <ChatSettings
        modelId="gpt-5"
        models={MODELS}
        providerId="openai"
        providers={PROVIDERS}
        thinkingLevel="medium"
        thinkingLevels={["off", "low", "medium", "high"]}
      />,
    );

    // A provider and a model are both already running, so both dropdowns stay
    // shut — the page is five lines of what is set and not a page of rows.
    expect(screen.queryByRole("menuitemradio")).toBeNull();

    // Nothing is behind a step: every section is on the page together.
    expect(screen.getByText("Provider")).toBeTruthy();
    expect(screen.getByText("OpenAI API key")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change key" })).toBeTruthy();
    expect(screen.getByText("Thinking")).toBeTruthy();
    expect(screen.getByText("Model — OpenAI")).toBeTruthy();

    // What is chosen says so — each on its own dropdown's face, so the line says
    // which it is and what it costs without being opened.
    expect(screen.getByRole("button", { name: /OpenAI/ }).textContent).toBe("OpenAIKey saved");
    expect(face(container).textContent).toBe("GPT-5400K ctx");
    expect(screen.getByRole("button", { name: "Medium" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
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
    // Its models are the provider before it's, so the section goes with the
    // choice — the key field is the whole page until a key is saved.
    expect(screen.queryByText(/^Model/)).toBeNull();

    const key = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.input(key, { target: { value: "sk-ant-live" } });
    fireEvent.click(screen.getByText("Save"));
    expect(saved).toEqual([["anthropic", "sk-ant-live"]]);
    expect(picked).toEqual(["llm7", "anthropic"]);
  });

  it("opens the provider list where the provider set up cannot answer", () => {
    render(<ChatSettings providerId="anthropic" providers={PROVIDERS} />);

    // A chat opens on the head of the picker whether or not this browser holds
    // that provider's key, so a row with no key behind it is still a question:
    // the list is down, with the free providers in it, and the key field is the
    // other answer under it.
    expect(screen.getAllByRole("menuitemradio").length).toBe(PROVIDERS.length);
    expect(screen.getByText("Anthropic API key")).toBeTruthy();

    // One that can answer is a choice made, and opens nothing.
    cleanup();
    render(<ChatSettings providerId="openai" providers={PROVIDERS} />);
    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  it("lists the newest of each model, and the older ones behind one button", () => {
    const { container } = render(<ChatSettings models={CATALOG} providerLabel="Gateway" />);

    // One row per model: Sonnet 4.5 goes under Sonnet 5, and GPT 5.5 under the
    // 5.6s — a codename is a release of GPT and not a model of its own. Both of
    // those 5.6s stay, because a release under two names is two models.
    expect(names(container)).toEqual([
      "Claude Sonnet 5",
      "GPT 5.4 Mini",
      "GPT 5.6 Sol",
      "GPT 5.6 Luna",
    ]);

    fireEvent.click(screen.getByRole("menuitem", { name: /Show 2 more models/ }));
    // Opened, each model is one run of rows with its newest at the head. The row
    // chose no model, so the panel it was clicked in is still up.
    expect(names(container)).toEqual([
      "Claude Sonnet 5",
      "Claude Sonnet 4.5",
      "GPT 5.4 Mini",
      "GPT 5.6 Sol",
      "GPT 5.6 Luna",
      "GPT 5.5",
    ]);

    fireEvent.click(screen.getByRole("menuitem", { name: /Show fewer/ }));
    expect(names(container).length).toBe(4);
  });

  it("offers the newest of the well-known lines before anything is typed", () => {
    const { container } = render(<ChatSettings models={GATEWAY} providerLabel="Gateway" />);

    // A catalog is a recommendation until it is searched: the lines a person
    // asks for by name, newest each, and none of the long tail around them.
    expect(names(container)).toEqual(["Gemini 3.7 Flash", "Claude Sonnet 5", "GPT 5.6 Sol"]);

    // The rest is one click away — the tail and the older releases together.
    fireEvent.click(screen.getByRole("menuitem", { name: /Show 10 more models/ }));
    expect(names(container).length).toBe(GATEWAY.length);

    // A search is the other question, so it reads the whole catalog. The
    // grouping still holds: Sonnet 4.5 is behind the button, under Sonnet 5.
    fireEvent.click(screen.getByRole("menuitem", { name: /Show fewer/ }));
    fireEvent.input(screen.getByLabelText("Search models"), { target: { value: "sonnet" } });
    expect(names(container)).toEqual(["Claude Sonnet 5"]);
    fireEvent.click(screen.getByRole("menuitem", { name: /Show 1 more model$/ }));
    expect(names(container)).toEqual(["Claude Sonnet 5", "Claude Sonnet 4.5"]);
  });

  it("keeps the model running in the list, however old it is", () => {
    const { container } = render(
      <ChatSettings
        modelId="anthropic/claude-sonnet-4.5"
        models={CATALOG}
        providerLabel="Gateway"
      />,
    );

    // A model is running, so the control is shut and says which one.
    expect(face(container).textContent).toBe("Claude Sonnet 4.5200K ctx");

    // Collapsed, and the tick is still in the list.
    fireEvent.click(face(container));
    expect(names(container)).toContain("Claude Sonnet 4.5");
    expect(
      screen.getByRole("menuitemradio", { name: /Claude Sonnet 4.5/ }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.getByRole("menuitem", { name: /Show 1 more model$/ })).toBeTruthy();
  });

  it("collapses what the filter matched, and says when it matches none", () => {
    const { container } = render(<ChatSettings models={manyModels()} providerLabel="Local" />);
    const rows = () => menu(container).querySelectorAll('[role="menuitemradio"]');

    const search = screen.getByLabelText("Search models") as HTMLInputElement;
    fireEvent.input(search, { target: { value: "Model 1" } });
    // 1 and 10 and 11 match, and the three are one model — so the newest of them
    // is the row, and the two behind the button are what the filter also matched.
    expect(rows().length).toBe(1);
    expect(rows()[0]?.textContent).toContain("Model 11");
    fireEvent.click(screen.getByRole("menuitem", { name: /Show 2 more models/ }));
    expect(rows().length).toBe(3);

    fireEvent.input(search, { target: { value: "nothing" } });
    expect(screen.getByText(/No models match/)).toBeTruthy();
  });

  it("gives the search field the focus, but not to a finger", () => {
    const many = manyModels();

    // jsdom carries no `matchMedia`, which reads as a pointer that is not coarse.
    render(<ChatSettings models={many} providerLabel="Local" />);
    // No model is running, so the panel is the question the section opens on, and
    // a dozen rows are read by typing at them.
    expect(document.activeElement).toBe(screen.getByLabelText("Search models"));

    cleanup();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("coarse") }));
    render(<ChatSettings models={many} providerLabel="Local" />);
    // A keyboard over the list it filters is worse than the list, so the panel
    // keeps the focus itself.
    expect(document.activeElement).toBe(screen.getByRole("menu"));
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
    expect(screen.getByText("Agentak")).toBeTruthy();

    // One way in: the bar's trigger, which names what is running and shuts
    // again the page it opened. Found by its tooltip, because the name it
    // carries is the model — which the list under the page carries too.
    const trigger = () => screen.getByTitle("Provider, model and thinking level");
    fireEvent.click(trigger());
    expect(screen.getByText("Provider")).toBeTruthy();
    fireEvent.click(trigger());
    expect(screen.getByText("Agentak")).toBeTruthy();

    fireEvent.click(trigger());
    expect(screen.queryByText("Agentak")).toBeNull();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Provider")).toBeTruthy();
    // One title bar: the way back replaces the new-conversation button.
    expect(screen.queryByRole("button", { name: "New conversation" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Agentak")).toBeTruthy();
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

    fireEvent.click(screen.getByTitle("Provider, model and thinking level"));
    fireEvent.click(face(container));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /GPT-5 mini/ }));

    expect(chosen).toEqual(["gpt-5-mini"]);
    // Back to the conversation, with the cursor where the next message goes.
    expect(screen.getByText("Agentak")).toBeTruthy();
    expect(document.activeElement).toBe(container.querySelector("textarea"));
  });

  it("offers the device lock, and says what it is doing", () => {
    const locked: boolean[] = [];
    const { rerender } = render(
      <ChatSettings
        keyLock={{ state: "off" }}
        onKeyLockChange={(on) => locked.push(on)}
        providerId="llm7"
        providers={PROVIDERS}
      />,
    );

    expect(screen.getByText("Device lock")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lock keys to this device" }));
    expect(locked).toEqual([true]);

    // Unlocked, the one thing left to do with it is turn it off again.
    rerender(
      <ChatSettings
        keyLock={{ state: "open" }}
        onKeyLockChange={(on) => locked.push(on)}
        providerId="llm7"
        providers={PROVIDERS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Turn the lock off" }));
    expect(locked).toEqual([true, false]);

    // A refusal is shown where the button that caused it is.
    rerender(
      <ChatSettings
        keyLock={{ error: "This device did not confirm it.", state: "locked" }}
        providerId="llm7"
        providers={PROVIDERS}
      />,
    );
    expect(screen.getByText("This device did not confirm it.")).toBeTruthy();
  });

  it("offers to unlock a locked key, and to type another one instead", () => {
    let unlocked = 0;
    const saved: [string, string][] = [];
    const providers = [{ hasKey: true, id: "openai", keyed: true, label: "OpenAI", locked: true }];
    render(
      <ChatSettings
        keyLock={{ state: "locked" }}
        onSaveKey={(id, key) => saved.push([id, key])}
        onUnlockKeys={() => (unlocked += 1)}
        providerId="openai"
        providers={providers}
      />,
    );

    // A key it has and cannot read: neither changing nor removing it is what
    // the page offers first.
    expect(screen.queryByRole("button", { name: "Change key" })).toBeNull();
    expect(screen.getByRole("button", { name: /OpenAI/ }).textContent).toBe("OpenAILocked");

    fireEvent.click(screen.getAllByRole("button", { name: "Unlock" })[0] as HTMLElement);
    expect(unlocked).toBe(1);

    // And the way back for a passkey that is gone: type another key.
    fireEvent.click(screen.getByRole("button", { name: "Use another key" }));
    const field = document.querySelector("input[type=password]") as HTMLInputElement;
    fireEvent.input(field, { target: { value: "sk-new" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(saved).toEqual([["openai", "sk-new"]]);
  });

  it("says why a key it cannot open is not being offered", () => {
    const providers = [
      { hasKey: false, id: "openai", keyed: true, keyLost: true, label: "OpenAI" },
    ];
    render(<ChatSettings keyLock={{ state: "off" }} providerId="openai" providers={providers} />);

    // The field is the one a provider with no key shows — the note is the whole
    // difference, because an empty box alone reads as a key never saved.
    expect(screen.queryByRole("button", { name: "Unlock" })).toBeNull();
    expect(
      screen.getByText(
        "The saved key was locked to a device this browser no longer has. Save another one.",
      ),
    ).toBeTruthy();
  });

  it("shows no device lock where the harness reports none", () => {
    render(<ChatSettings providerId="llm7" providers={PROVIDERS} />);
    expect(screen.queryByText("Device lock")).toBeNull();
  });

  it("shows no device lock until a key is stored", () => {
    const free = [
      { id: "llm7", label: "LLM7" },
      { id: "anthropic", keyed: true, label: "Anthropic" },
    ];
    const { rerender } = render(
      <ChatSettings keyLock={{ state: "off" }} providerId="llm7" providers={free} />,
    );
    // Nothing is stored, so the lock locks nothing.
    expect(screen.queryByText("Device lock")).toBeNull();

    rerender(<ChatSettings keyLock={{ state: "off" }} providerId="llm7" providers={PROVIDERS} />);
    expect(screen.getByText("Device lock")).toBeTruthy();
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
    expect(screen.getByText("Agentak")).toBeTruthy();
  });
});
