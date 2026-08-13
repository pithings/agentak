import { cachedCatalog, loadCatalog } from "@/pi/catalog";
import { type AgentOptions, createAgent, SYSTEM_PROMPT } from "@/pi/create-agent";
import { findModel } from "@/pi/models";
import { type AnyModel, availableProviders, findProvider, type Provider } from "@/pi/providers";
import {
  storeApiKey,
  storedApiKey,
  storedModelId,
  storedProviderId,
  storeModelId,
  storeProviderId,
} from "@/pi/storage";
import { createAgentStore } from "@/pi/store";
import { generateTitle, titleRequest } from "@/pi/title";
import type { ChatAgent, ChatProvider } from "@/components/chat/types";
import type { ChatSession, ChatSessionOptions, ChatSnapshot } from "@/session";

/** `AgentOptions`, minus what the picker decides for itself. */
export interface PiSessionOptions extends Omit<AgentOptions, "apiKey" | "model"> {
  /**
   * A key for the provider named by `provider`, or one per provider id. Without
   * one the picker asks, and keeps what it is given in `localStorage`; the
   * extension passes one from `chrome.storage` instead. A free provider asks for
   * none.
   */
  apiKey?: string | Record<string, string>;
  /**
   * Which provider to open on. Default: the one this browser stored, or none —
   * a fresh session chooses nothing, and the picker asks with the first message.
   */
  provider?: string;
  /** Name the conversation with the model rather than the first message. */
  generateTitle?: boolean;
}

/** Keys already in hand: what a host passed, over what the browser stored. */
function seedKeys(
  providers: Provider[],
  apiKey: PiSessionOptions["apiKey"],
  providerId?: string,
): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const provider of providers) {
    const stored = storedApiKey(provider.id);
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
 * The built-in session: pi's `Agent` over the page tools, with the provider,
 * model and key picker in front of it.
 *
 * This is the whole of what `agentak` knows about providers — the surface itself
 * knows none of it, so a host with its own harness implements `ChatSession` and
 * never loads this module. There is no key screen either: the picker in the
 * composer is the one place anything is chosen.
 */
export function createPiSession(options: PiSessionOptions = {}): ChatSession {
  const { apiKey, provider: openOn, generateTitle: named, ...agentOptions } = options;

  // Where the surface runs decides the list: a page drops the providers that
  // answer no preflight. Fixed for the life of the session.
  const available = availableProviders();
  const wanted = openOn ?? storedProviderId();

  let keys = seedKeys(available, apiKey, wanted);
  let providerId = openingProvider(available, keys, wanted);
  let preferences: ChatSessionOptions = { generateTitle: named };

  // Keys are read through the closure, so adding one does not rebuild the agent
  // and lose the transcript. pi asks per provider, which is the id it passes.
  const runtime = createAgent({ ...agentOptions, apiKey: (provider) => keys[provider] });
  const store = createAgentStore(runtime);

  const listeners = new Set<() => void>();
  let cached: ChatSnapshot | undefined;
  let models: AnyModel[] = [];
  let modelsLoading = false;
  let catalogError: string | undefined;
  /** Typed before a provider was chosen. It goes as soon as one can answer. */
  let pending = "";
  let pickerOpen = false;
  let titled: { for: string; title: string } | undefined;
  /** What was asked already, so a second event does not ask twice. */
  let asked: string | undefined;

  const notify = () => {
    cached = undefined;
    for (const listener of listeners) listener();
  };

  const model = () => runtime.agent.state.model as AnyModel;
  // The loop is built on a model of its own, so "chosen" is the provider's own
  // model in hand — not whatever the agent happens to hold.
  const ready = () => Boolean(providerId) && model().provider === providerId;

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
    if (!providerId || models.length === 0 || model().provider === providerId) return;
    const next = findModel(models, storedModelId(providerId));
    if (next) store.setModel(next);
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
      title: titled && titled.for === derived ? titled.title : derived,
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
      store.reset();
    },

    respond: (id, approved) => store.respond(id, approved),

    dequeue: (id) => store.dequeue(id),

    selectProvider(id) {
      providerId = id;
      storeProviderId(id);
      load(id);
    },

    selectModel(id) {
      const next = findModel(models, id);
      if (!next || !providerId) return;
      store.setModel(next);
      storeModelId(providerId, id);
      flush();
    },

    saveKey(id, key) {
      keys = { ...keys, [id]: key };
      storeApiKey(id, key);
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

    dispose() {
      offStore();
      store.dispose();
      listeners.clear();
    },
  };
}
