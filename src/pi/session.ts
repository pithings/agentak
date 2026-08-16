import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";

import { cachedCatalog, loadCatalog } from "./catalog.ts";
import { type AgentOptions, createAgent, SYSTEM_PROMPT } from "./create-agent.ts";
import { findModel } from "./models.ts";
import { type AnyModel, availableProviders, findProvider, type Provider } from "./providers.ts";
import {
  PI_SNAPSHOT_VERSION,
  type PiSnapshot,
  usablePiMessages,
  type WholePiSnapshot,
} from "./snapshot.ts";
import { createChoices, type PiChoices, type PiStorage } from "./storage.ts";
import { createAgentStore } from "./store.ts";
import { generateTitle, titleRequest } from "./title.ts";
import type { ChatAgent, ChatProvider } from "../components/chat/types.ts";
import type { ChatSession, ChatSessionOptions, ChatSnapshot } from "../session.ts";

/** `AgentOptions`, minus what the picker and the snapshot decide for themselves. */
export interface PiSessionOptions extends Omit<AgentOptions, "apiKey" | "messages" | "model"> {
  /**
   * A key for the provider named by `provider`, or one per provider id. Without
   * one the picker asks, and keeps what it is given in memory; the extension
   * passes one from `chrome.storage` instead. A free provider asks for none.
   */
  apiKey?: string | Record<string, string>;
  /**
   * Where the picker's choices go: the keys, the provider, the model and the
   * level. Default: memory shared by the page, so they go with the page. Pass
   * `browserStorage()` for `localStorage`, or a store of your own.
   */
  storage?: PiStorage;
  /**
   * Which provider to open on. Default: the snapshot's, then the one the store
   * holds, then none — a fresh session chooses nothing, and the picker asks
   * with the first message.
   */
  provider?: string;
  /**
   * A conversation to open on: what `save()` returned, from wherever the host
   * kept it. Its provider, model and thinking level come back with the
   * transcript, and they win over the per-browser defaults.
   */
  snapshot?: PiSnapshot;
  /** Name the conversation with the model rather than the first message. */
  generateTitle?: boolean;
}

/**
 * A session this module made, and so one its caller ends.
 *
 * `dispose` lives here rather than on `ChatSession` because nothing in the
 * surface calls it: it is this factory's contract with whoever called it, not
 * what the chat asks of a harness.
 */
export interface PiSession extends ChatSession {
  /** Stops listening to the agent and drops every listener. */
  dispose(): void;
  /**
   * This conversation, ready to be stored — the transcript and the choices it
   * ran under. Cheap, and safe to call while the model streams: what has landed
   * is in it, and the turn in flight is not.
   *
   * It is `dispose()`'s neighbour rather than a `ChatSession` member for the
   * same reason: the surface never calls it, so it is what this factory owes its
   * caller, not what the chat asks of a harness.
   */
  save(): PiSnapshot;
}

/** Keys already in hand: what a host passed, over what the store holds. */
function seedKeys(
  choices: PiChoices,
  providers: Provider[],
  apiKey: PiSessionOptions["apiKey"],
  providerId?: string,
): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const provider of providers) {
    const stored = choices.storedApiKey(provider.id);
    if (stored) keys[provider.id] = stored;
  }
  if (typeof apiKey === "string" && providerId) keys[providerId] = apiKey;
  else if (apiKey) Object.assign(keys, apiKey);
  return keys;
}

/**
 * The provider to open on, if any. One that cannot answer counts as none — a
 * stored key may have been dropped, a host may name a provider it passed no key
 * for, and one stored in the panel is out of reach on a page.
 */
const openingProvider = (
  providers: Provider[],
  keys: Record<string, string>,
  wanted?: string,
): string | undefined => {
  const entry = providers.find((provider) => provider.id === wanted);
  return entry && (entry.free || keys[entry.id]) ? entry.id : undefined;
};

/**
 * The built-in session: pi's `Agent` over the host's tools, with the provider,
 * model and key picker in front of it.
 *
 * This is the whole of what `agentak` knows about providers — the surface itself
 * knows none of it, so a host with its own harness implements `ChatSession` and
 * never loads this module. There is no key screen either: the picker in the
 * composer is the one place anything is chosen.
 */
export function createPiSession(options: PiSessionOptions = {}): PiSession {
  const {
    apiKey,
    provider: openOn,
    generateTitle: named,
    snapshot: stored,
    storage,
    ...agentOptions
  } = options;

  const choices = createChoices(storage);

  // Where the surface runs decides the list: a page drops the providers that
  // answer no preflight. Fixed for the life of the session.
  const available = availableProviders();
  const wanted = openOn ?? stored?.provider ?? choices.storedProviderId();

  let keys = seedKeys(choices, available, apiKey, wanted);
  let providerId = openingProvider(available, keys, wanted);
  let preferences: ChatSessionOptions = { generateTitle: named };
  /**
   * The stored choices, until they land: the model waits for its catalog, and
   * the level for the model. Spent once, because a pick after that is the
   * visitor's and must not be overruled by the file it came from.
   */
  let opening = stored;

  // Keys are read through the closure, so adding one does not rebuild the agent
  // and lose the transcript. pi asks per provider, which is the id it passes.
  const runtime = createAgent({
    ...agentOptions,
    apiKey: (provider) => keys[provider],
    messages: stored ? usablePiMessages(stored.messages) : [],
  });
  const store = createAgentStore(runtime);

  const listeners = new Set<() => void>();
  let cached: ChatSnapshot | undefined;
  let models: AnyModel[] = [];
  let modelsLoading = false;
  let catalogError: string | undefined;
  /** Typed before a provider was chosen. It goes as soon as one can answer. */
  let pending = "";
  let pickerOpen = false;
  /**
   * A restored title is the model's own from last time, kept against the same
   * first message it named — and `asked` with it, so bringing a conversation
   * back does not buy its title a second time.
   */
  const restoredTitle = stored?.title ? titleRequest(store.snapshot().messages).derived : undefined;
  let titled =
    restoredTitle && stored?.title ? { for: restoredTitle, title: stored.title } : undefined;
  /** What was asked already, so a second event does not ask twice. */
  let asked: string | undefined = restoredTitle;

  const notify = () => {
    cached = undefined;
    for (const listener of listeners) listener();
  };

  const model = () => runtime.agent.state.model as AnyModel;
  // The loop is built on a model of its own, so "chosen" is the provider's own
  // model in hand — not whatever the agent happens to hold.
  const ready = () => Boolean(providerId) && model().provider === providerId;

  /** What the current model offers, in order. `off` alone when it cannot reason. */
  const levels = (): ThinkingLevel[] => getSupportedThinkingLevels(model());

  /** The stored conversation's own choices, while they are still owed. */
  const restoring = () => (opening?.provider === providerId ? opening : undefined);

  /**
   * Run the model at the level the conversation was written at, or the one this
   * browser last used it at — and never at one it does not offer, because a
   * level carried over from another model would go to a provider that refuses
   * it.
   */
  const followThinking = () => {
    if (!providerId) return;
    const restore = restoring();
    const kept = restore?.thinkingLevel ?? choices.storedThinkingLevel(providerId, model().id);
    const offered = levels();
    const known = offered.find((level) => level === kept);
    const wanted = known ?? runtime.agent.state.thinkingLevel;
    store.setThinkingLevel(offered.includes(wanted) ? wanted : "off");
    // The last thing a restore owed, so the snapshot is spent here.
    if (restore) opening = undefined;
  };

  const chooseModel = (next: AnyModel) => {
    store.setModel(next);
    followThinking();
  };

  const flush = () => {
    if (!pending || !ready()) return;
    const text = pending;
    pending = "";
    store.send(text);
  };

  /**
   * Follow the provider, but only as far as this browser has been: the model it
   * last used with it. A provider chosen for the first time ends on its model
   * list, because nothing here picks a model for anyone.
   */
  const follow = () => {
    if (!providerId || models.length === 0) return;
    const restore = restoring();
    // Already on this provider's model: only the level is left to restore. A
    // stored conversation is not on it yet, whatever the agent happens to
    // hold — the default model belongs to a provider too, so the shortcut is
    // not taken while a snapshot is still owed.
    if (!restore && model().provider === providerId) {
      followThinking();
      return;
    }
    const next = findModel(models, restore?.model ?? choices.storedModelId(providerId));
    // Its model may be gone from the catalog. The level is still the
    // conversation's, and the snapshot is spent either way.
    if (next) chooseModel(next);
    else if (restore) followThinking();
    flush();
  };

  const load = (id: string) => {
    catalogError = undefined;
    const have = cachedCatalog(id);
    if (have) {
      models = have;
      modelsLoading = false;
      follow();
      notify();
      return;
    }

    models = [];
    modelsLoading = true;
    notify();
    loadCatalog(id).then(
      (loaded) => {
        if (providerId !== id) return;
        models = loaded;
        modelsLoading = false;
        follow();
        notify();
      },
      (error: unknown) => {
        if (providerId !== id) return;
        models = [];
        modelsLoading = false;
        catalogError = error instanceof Error ? error.message : String(error);
        notify();
      },
    );
  };

  /**
   * The model is asked to name the conversation once, after the first answer
   * lands and the loop is idle: the free providers meter requests by the minute,
   * so a title never competes with the turn it names. A failure leaves the
   * first-message title standing.
   */
  const maybeTitle = () => {
    const id = providerId;
    if (!preferences.generateTitle || !id || !ready() || runtime.agent.state.isStreaming) return;

    const { derived, seed } = titleRequest(store.snapshot().messages);
    if (!derived || !seed || asked === derived) return;
    asked = derived;

    void generateTitle({
      // A free provider needs no key, but the openai client wants a string.
      apiKey: keys[id] ?? (findProvider(id)?.free ? "unused" : undefined),
      model: model(),
      seed,
      streamFn: agentOptions.streamFn,
    }).then((title) => {
      if (!title) return;
      titled = { for: derived, title };
      notify();
    });
  };

  // Provider, model and key are all one picker, so this is the whole of what the
  // surface is told about a provider. The picker asks for a key before it hands a
  // keyed provider back, so `providerId` can always answer.
  const providerViews = (): ChatProvider[] =>
    available.map((entry) => ({
      hasKey: Boolean(keys[entry.id]),
      id: entry.id,
      keyed: !entry.free,
      keyPlaceholder: entry.keyPlaceholder,
      keyUrl: entry.keyUrl,
      label: entry.label,
      note: entry.free
        ? `Free — ${entry.note}`
        : entry.gateway
          ? "Gateway — one key, many vendors"
          : undefined,
    }));

  const agentView = (): ChatAgent => ({
    instructions: agentOptions.systemPrompt ?? SYSTEM_PROMPT,
    model: ready() ? model().name : undefined,
    name: runtime.name,
    tools: runtime.agent.state.tools.map((tool) => ({
      description: tool.description,
      inputSchema: tool.parameters,
      name: tool.name,
    })),
  });

  /** The model's own title, once it names the conversation it was asked about. */
  const generated = (derived?: string) =>
    titled && titled.for === derived ? titled.title : undefined;

  const build = (): ChatSnapshot => {
    const loop = store.snapshot();
    const live = ready();
    const { derived } = titleRequest(loop.messages);
    return {
      agent: agentView(),
      error: loop.error ?? catalogError,
      isStreaming: loop.isStreaming,
      messages: loop.messages,
      modelId: live ? model().id : undefined,
      models,
      modelsLoading,
      pickerOpen,
      providerId,
      providers: providerViews(),
      queued: loop.queued,
      thinkingLevel: live ? loop.thinkingLevel : undefined,
      thinkingLevels: live ? levels() : undefined,
      title: generated(derived) ?? derived,
      usage: live ? loop.usage : undefined,
    };
  };

  const offStore = store.subscribe(() => {
    maybeTitle();
    notify();
  });

  if (providerId) load(providerId);

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    snapshot() {
      cached ??= build();
      return cached;
    },

    send(text) {
      if (ready()) {
        store.send(text);
        return;
      }
      // The question is the menu itself: a first message with nothing chosen
      // opens the picker and waits, rather than answering from a provider
      // nobody picked.
      pending = text;
      pickerOpen = true;
      notify();
    },

    stop: () => store.stop(),

    reset() {
      titled = undefined;
      asked = undefined;
      pending = "";
      // A new conversation owes the stored one nothing, catalog landed or not.
      opening = undefined;
      store.reset();
    },

    respondToTool: (id, approved, reason) => store.respond(id, approved, reason),

    dequeue: (id) => store.dequeue(id),

    dismissError() {
      catalogError = undefined;
      store.clearError();
      notify();
    },

    /**
     * Whatever the shown error was, again. A catalog that would not load is the
     * one to load again; anything else is the loop's, and the failed turn runs
     * once more in place. So the button is never the dead one.
     */
    retry() {
      if (catalogError && providerId) {
        load(providerId);
        return;
      }
      store.retry();
    },

    selectProvider(id) {
      providerId = id;
      choices.storeProviderId(id);
      load(id);
    },

    selectModel(id) {
      const next = findModel(models, id);
      if (!next || !providerId) return;
      chooseModel(next);
      choices.storeModelId(providerId, id);
      flush();
    },

    /**
     * Kept per provider and model, because one provider carries reasoning
     * models beside models that take no level at all.
     */
    setThinkingLevel(level) {
      if (!ready() || !providerId) return;
      store.setThinkingLevel(level);
      choices.storeThinkingLevel(providerId, model().id, level);
    },

    saveKey(id, key) {
      keys = { ...keys, [id]: key };
      choices.storeApiKey(id, key);
      notify();
    },

    setPickerOpen(open) {
      pickerOpen = open;
      notify();
    },

    setOptions(next) {
      preferences = { ...preferences, ...next };
      maybeTitle();
      notify();
    },

    /**
     * A copy of the transcript, and the three choices it ran under. The array is
     * copied because the agent goes on mutating its own.
     *
     * `WholePiSnapshot` is what makes this the one place to edit: a field added
     * to `PiSnapshot` has to be written here, or the object below no longer
     * compiles.
     */
    save() {
      const whole: WholePiSnapshot = {
        messages: [...runtime.agent.state.messages],
        model: ready() ? model().id : undefined,
        provider: providerId,
        thinkingLevel: ready() ? runtime.agent.state.thinkingLevel : undefined,
        title: generated(titleRequest(store.snapshot().messages).derived),
        version: PI_SNAPSHOT_VERSION,
      };
      return whole;
    },

    dispose() {
      offStore();
      store.dispose();
      listeners.clear();
    },
  };
}
