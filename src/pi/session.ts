// Docs: @docs/4.agents/2.pi-agent/1.index.md
// Docs: @docs/4.agents/2.pi-agent/7.conversations.md
// Docs: @docs/4.agents/2.pi-agent/8.runtime-behavior.md
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { clampThinkingLevel, getSupportedThinkingLevels } from "@earendil-works/pi-ai";

import { cachedCatalog, loadCatalog } from "./providers/catalog.ts";
import { type AgentOptions, createAgent, SYSTEM_PROMPT } from "./agent.ts";
import { createHistory, mintConversationId, type PiHistory } from "./storage/history.ts";
import { findModel } from "./providers/models.ts";
import { createPageToolset, type PageTools } from "./tools.ts";
import { type AnyModel, availableProviders, findProvider, type Provider } from "./providers.ts";
import {
  PI_SNAPSHOT_VERSION,
  type PiSnapshot,
  usablePiMessages,
  type WholePiSnapshot,
} from "./snapshot.ts";
import { passkeyFailure } from "./storage/passkey.ts";
import { isSecretStorage, type SealedState, type SecretStorage } from "./storage/secret.ts";
import { createChoices, type PiChoices, type PiStorage } from "./storage.ts";
import { createAgentStore } from "./chat.ts";
import { generateTitle, titleRequest, toTitle } from "./chat/title.ts";
import { piMessageIndex, piUserText, toViewMessages } from "./chat/transcript.ts";
import { documentTools } from "./tools/webmcp.ts";
import type { ApprovalPolicy } from "./tools/approvals.ts";
import type {
  ChatAgent,
  ChatKeyLock,
  ChatProvider,
  ChatToolPolicy,
} from "../components/chat/types.ts";
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
  /**
   * Keep the conversations this session has, and list them in the chat's own
   * history page — the clock in the header. `true` keeps them in `storage`,
   * which is memory unless a host asks for more; a `PiHistory` of your own
   * keeps them wherever you like.
   *
   * Off by default: nothing is stored unasked, and a host that keeps its own
   * with `save()` grows no second list. A session opens on a new conversation
   * either way — the stored ones are reached from the history page — unless
   * `snapshot` names one, which wins.
   */
  history?: boolean | PiHistory;
  /** Name the conversation with the model rather than the first message. */
  generateTitle?: boolean;
  /**
   * Offer the model whatever tools the current page publishes — WebMCP, on
   * `document.modelContext`. `true` reads this document, which is the whole of
   * what a page needs; a `PageTools` of your own reads somewhere else, which is
   * how the extension panel reaches the active tab.
   *
   * Off by default: the model is offered nothing nobody asked for. A page that
   * carries no tools, and a browser without the api, both come to none — see
   * `.agents/webmcp.md`.
   *
   * These arrive beside `tools`, never over them: a name a host tool already
   * holds is given a suffix. A tool the page marked read-only runs unasked;
   * anything else is confirmed on every call.
   */
  page?: boolean | PageTools;
  /**
   * How often a tool call is confirmed. Default: `never` — this surface carries
   * the switch, in the bar under the composer, so it opens on the model's calls
   * running as they come and a person puts the gate up when they want it.
   *
   * `once` or `always` opens on the gate instead, and the switch still takes it
   * away. A host that names one of those is also naming what "ask" restores;
   * without one, that is `once`. See `tools/approvals.ts`.
   */
  approvals?: ApprovalPolicy;
}

/**
 * One thing asked of the agent: a message to send, or a tool to run. What is
 * held while nothing can answer yet, and what `flush()` then hands the store.
 */
type PendingAsk = { text: string } | { tool: string };

/**
 * A session this module made, and so one its caller ends.
 *
 * `dispose` lives here rather than on `ChatSession` because nothing in the
 * surface calls it: it is this factory's contract with whoever called it, not
 * what the chat asks of a harness.
 */
export interface PiSession extends ChatSession {
  /**
   * Resolved once the stored choices are in hand: the keys, the provider, the
   * model, the level, and the conversations where the session keeps its own.
   *
   * A `PiStorage` answers later, so a session opens on nothing and takes what
   * the store held a beat after. Nothing has to wait for it — the surface
   * redraws when the choices land — but a host that would rather not show a
   * chat that has forgotten everything, and then change it under the reader,
   * mounts on this. The extension panel does.
   */
  ready: Promise<void>;
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
  /**
   * Replace the whole state with a stored conversation, or with nothing, which
   * is a new one — the other half of `save()`, and what the history page runs
   * on. The transcript, the provider, the model and the level all follow it, in
   * the session that is already mounted: nothing is swapped around the chat.
   *
   * A conversation this session keeps is stored first, so moving off one never
   * loses it. A turn in flight is stopped.
   */
  restore(snapshot?: PiSnapshot): void;
}

/**
 * Where a model that can reason starts, before a stored choice says otherwise.
 * Clamped to what the model offers, so a model without it takes the nearest.
 */
const DEFAULT_THINKING: ThinkingLevel = "medium";

/**
 * What the store holds per provider: the keys it handed over, the ones it has
 * and will not hand over yet, and the ones it has and never will.
 *
 * A store that answers a key with nothing reads, on its own, as a browser that
 * has none — so the provider it was set up on would look unset and the chat
 * would ask for a key it is already holding. `sealed()` is the difference, and
 * it makes three answers rather than two, because a value nothing can open must
 * not be offered an unlock that would do nothing: `sealed` is a ceremony away,
 * and `lost` is a key to type again.
 */
interface StoredKeys {
  keys: Record<string, string>;
  sealed: Set<string>;
  lost: Set<string>;
}

/** Keys already in hand: what a host passed, over what the store holds. */
async function seedKeys(
  choices: PiChoices,
  providers: Provider[],
  apiKey: PiSessionOptions["apiKey"],
  providerId?: string,
  secrets?: SecretStorage,
): Promise<StoredKeys> {
  const keys: Record<string, string> = {};
  const sealed = new Set<string>();
  const lost = new Set<string>();
  // Asked for at once rather than one after another: a store that answers later
  // would otherwise cost a round trip per provider.
  const stored = await Promise.all(providers.map((provider) => choices.storedApiKey(provider.id)));
  const shut = secrets
    ? await Promise.all(
        providers.map((provider) =>
          secrets.sealed(`api-key:${provider.id}`).catch((): SealedState => "open"),
        ),
      )
    : undefined;
  providers.forEach((provider, index) => {
    const key = stored[index];
    if (key) keys[provider.id] = key;
    else if (shut?.[index] === "locked") sealed.add(provider.id);
    else if (shut?.[index] === "stale") lost.add(provider.id);
  });
  if (typeof apiKey === "string" && providerId) keys[providerId] = apiKey;
  else if (apiKey) Object.assign(keys, apiKey);
  return { keys, lost, sealed };
}

/** The same set without one id. A key that is in hand is neither of these. */
const without = (set: Set<string>, id: string): Set<string> =>
  new Set([...set].filter((entry) => entry !== id));

/**
 * Whether this provider can answer as things stand: one that asks for no key, or
 * one whose key is in hand. A key that is only locked counts — it is a key, and
 * the click that sends the first message is what unlocks it. The alternative is
 * a chat that opens on nothing every visit and asks for a key it is holding.
 */
const canAnswer = (
  provider: Provider,
  // A key that is lost is no key, so this is the two that count.
  { keys, sealed }: Pick<StoredKeys, "keys" | "sealed">,
): boolean => Boolean(provider.free || keys[provider.id] || sealed.has(provider.id));

/**
 * The provider to open on. The one asked for, where it can answer — a stored key
 * may have been dropped, a host may name a provider it passed no key for, and
 * one stored in the panel is out of reach on a page — and otherwise the head of
 * the list, whether or not it holds a key.
 *
 * The head is the recommendation and not a fallback: the picker leads with the
 * choice worth making, so a chat with nothing stored opens on it and the
 * settings page asks for its key. Nothing at all is chosen only where this
 * runtime carries no provider.
 */
const openingProvider = (
  providers: Provider[],
  held: Pick<StoredKeys, "keys" | "sealed">,
  wanted?: string,
): string | undefined => {
  const entry = providers.find((provider) => provider.id === wanted);
  return (entry && canAnswer(entry, held) ? entry : providers[0])?.id;
};

/**
 * The statuses the settings page is the answer to: a refused key, an account
 * out of credit or without the rights, and a model the provider does not serve.
 * Every other failure leaves the transcript where it is.
 */
const ANSWERED_ON_SETTINGS = new Set([401, 402, 403, 404]);

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
    history: keeping,
    page: reading,
    snapshot: stored,
    storage,
    ...agentOptions
  } = options;

  const choices = createChoices(storage);

  /** The host's own tools. The page's stand beside them, never over them. */
  const hostTools = agentOptions.tools ?? [];

  /**
   * The page's tools, where a host asked for them. The source is read at
   * construction and again whenever it says its list changed, so a site that
   * registers per screen is followed without a turn.
   */
  const toolset = reading
    ? createPageToolset(reading === true ? documentTools() : reading, {
        reserved: hostTools.map((tool) => tool.name),
      })
    : undefined;

  /** Where this session's own conversations go, if it keeps any. */
  const kept = keeping ? (keeping === true ? createHistory(storage) : keeping) : undefined;

  /**
   * What to open on: the conversation a host passed, and nothing else. A
   * session that keeps its own still opens on a new one — a chat that was just
   * opened is a chat to start, and what was said before is one click away on
   * the history page. A host that passes one keeps it, under an id of this
   * session's own.
   */
  const opened = stored;
  let conversationId = mintConversationId();

  // Where the surface runs decides the list: a page drops the providers that
  // answer no preflight. Fixed for the life of the session.
  const available = availableProviders();

  /**
   * The store's own lock, where it has one — `browserStorage()` does. It is what
   * turns the settings page's device-lock section on, and what the first message
   * asks before it is sent with a key that is still shut.
   */
  const secrets = storage && isSecretStorage(storage) ? storage : undefined;

  // Both come out of the store, so both open empty and fill in below.
  let keys: Record<string, string> = {};
  /** Providers whose stored key is there and shut. Empty with no lock, or none. */
  let sealed = new Set<string>();
  /** Providers whose stored key is there and unreadable for good. */
  let lost = new Set<string>();
  /** Whether this browser could hold a key of its own, if anyone asked it to. */
  let lockable = false;
  /** A dialog is up. One at a time, and the buttons say so while it is. */
  let lockBusy = false;
  /** What the last ask came back with, where it was not a key. */
  let lockError: string | undefined;
  let providerId: string | undefined;
  let preferences: ChatSessionOptions = { generateTitle: named };
  /**
   * The stored choices, until they land: the model waits for its catalog, and
   * the level for the model. Spent once, because a pick after that is the
   * visitor's and must not be overruled by the file it came from.
   */
  let opening = opened;

  // Keys are read through the closure, so adding one does not rebuild the agent
  // and lose the transcript. pi asks per provider, which is the id it passes.
  const runtime = createAgent({
    ...agentOptions,
    // The gate is down unless a host asked for it. The bar's switch is why: a
    // surface that carries the way to put it up can open without it, where the
    // bare loop — which carries no switch at all — still opens asking.
    approvals: agentOptions.approvals ?? "never",
    // A page tool is gated on the site's own word: read-only changes nothing,
    // so it runs unasked, and anything else is confirmed every time — it is not
    // the host's tool, and it acts on a site the visitor is signed in to.
    approvalFor: (name) => toolset?.approvalFor(name) ?? agentOptions.approvalFor?.(name),
    apiKey: (provider) => keys[provider],
    messages: opened ? usablePiMessages(opened.messages) : [],
  });
  const store = createAgentStore(runtime);

  /**
   * What "ask" puts back, once somebody has turned the gate off: the policy the
   * session was built with. A host that built it off is a host that asked for no
   * gate, and the switch still offers one — a person may be more careful than
   * the page they are on, and `once` is the gate this loop has by default.
   */
  const asking: ApprovalPolicy =
    agentOptions.approvals && agentOptions.approvals !== "never" ? agentOptions.approvals : "once";

  const listeners = new Set<() => void>();
  let cached: ChatSnapshot | undefined;
  let models: AnyModel[] = [];
  let modelsLoading = false;
  let catalogError: string | undefined;
  /**
   * The level chosen by hand, or the one a host opened the session on. It
   * carries to a model this browser has not run yet, where the model offers it.
   */
  let lastThinking = agentOptions.thinkingLevel;
  /**
   * Which pick is the current one. A stored choice is read while the person is
   * looking at the picker, so one made by hand in the meantime must not be
   * overruled by the store answering after it.
   */
  let picked = 0;
  /**
   * Asked before a provider was chosen, or before the keys were unlocked. It
   * goes as soon as something can answer.
   *
   * Either of the two ways of asking: a message, or a tool a person picked. A
   * tool waits for the same thing a message does, because running one is only
   * half of it — the model is what reads the result, and there is no model yet.
   */
  let pending: PendingAsk | undefined;
  let pickerOpen = false;
  let historyOpen = false;
  let titled: { for: string; title: string } | undefined;
  /** What was asked already, so a second event does not ask twice. */
  let asked: string | undefined;
  /** The failure the page was opened for, so closing it again stands. */
  let acted: string | undefined;

  /**
   * A restored title is the model's own from last time, kept against the same
   * first message it named — and `asked` with it, so bringing a conversation
   * back does not buy its title a second time. Read from the snapshot rather
   * than the loop, because a restore hands the loop its messages a beat later.
   */
  const adoptTitle = (from?: PiSnapshot) => {
    const derived = from?.title
      ? toTitle(toViewMessages(usablePiMessages(from.messages)))
      : undefined;
    titled = derived && from?.title ? { for: derived, title: from.title } : undefined;
    asked = derived;
  };

  adoptTitle(opened);

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
   *
   * A model nothing here has an answer for thinks at `DEFAULT_THINKING`, near
   * the middle of what it offers: a reasoning model is chosen to reason, so it
   * is only off where somebody said off. A model that cannot reason clamps to
   * `off`, which is the whole of what it has.
   */
  const followThinking = async () => {
    if (!providerId) return;
    const mine = picked;
    const restore = restoring();
    const kept =
      restore?.thinkingLevel ?? (await choices.storedThinkingLevel(providerId, model().id));
    // A level chosen by hand while the store was answering is the one that stands.
    if (mine !== picked) return;
    const offered = levels();
    const wanted =
      offered.find((level) => level === kept) ?? offered.find((level) => level === lastThinking);
    store.setThinkingLevel(wanted ?? clampThinkingLevel(model(), DEFAULT_THINKING));
    // The last thing a restore owed, so the snapshot is spent here.
    if (restore) opening = undefined;
  };

  const chooseModel = async (next: AnyModel) => {
    store.setModel(next);
    // Clamped at once, and only then read from the store: the level and the
    // model land together, so nothing ever shows a level this model refuses
    // while the store is still being asked what it held for this one.
    store.setThinkingLevel(clampThinkingLevel(next, runtime.agent.state.thinkingLevel));
    await followThinking();
  };

  const flush = () => {
    if (!pending || !ready() || shut()) return;
    const held = pending;
    pending = undefined;
    perform(held);
  };

  /** The provider on screen holds a key, and the lock is between here and it. */
  const shut = () => Boolean(providerId && sealed.has(providerId) && !keys[providerId]);

  /** What the store holds now: the keys it hands over, and the ones it will not. */
  const readKeys = async () => {
    const stored = await seedKeys(choices, available, apiKey, providerId, secrets);
    // What this session was given in the meantime is the newer, exactly as it is
    // at construction: a key typed while the store answered stands over it.
    keys = { ...stored.keys, ...keys };
    sealed = stored.sealed;
    lost = stored.lost;
  };

  /**
   * Ask the device for the key.
   *
   * Called from a click and from nowhere else — the composer's send, or the
   * settings page's own button — because the browser wants a gesture in front of
   * the dialog. A refusal is not a failure of the chat: the message stays where
   * it was typed and the settings page opens on the reason, which is the same
   * answer a provider refusing a key gets.
   */
  const unlock = () => {
    if (!secrets || lockBusy) return;
    lockBusy = true;
    lockError = undefined;
    notify();
    void (async () => {
      try {
        await secrets.lock.unlock();
        await readKeys();
      } catch (failure: unknown) {
        lockError = passkeyFailure(failure);
        if (pending) pickerOpen = true;
      } finally {
        lockBusy = false;
        flush();
        notify();
      }
    })();
  };

  /**
   * The lock, as the settings page reads it. Absent where there is nothing to
   * show: a store that seals nothing, and a browser that could not hold a key of
   * its own even if the person asked — the section would then be a control that
   * only ever fails.
   */
  const keyLockView = (): ChatKeyLock | undefined => {
    if (!secrets) return undefined;
    const state = secrets.lock.state();
    if (state === "off" && !lockable) return undefined;
    return { busy: lockBusy || undefined, error: lockError, state };
  };

  /** What the store does with an ask, once something can answer it. */
  const perform = (ask: PendingAsk) =>
    "text" in ask ? store.send(ask.text) : store.callTool(ask.tool);

  /**
   * Ask, or hold it until something can answer. The question is the menu
   * itself: a message with nothing chosen opens the settings page and waits,
   * rather than answering from a provider nobody picked.
   *
   * Every way of asking goes through here — the composer, a rewind running a
   * message again, and a tool picked from the composer's own list — so a chat
   * that lost its key mid-conversation holds any of them the same way.
   */
  const ask = (request: PendingAsk) => {
    // A key that is only locked is a key: the click behind this ask is the
    // gesture the device wants, so it is spent here rather than sending the
    // person to a page to click again.
    if (shut()) {
      pending = request;
      notify();
      unlock();
      return;
    }
    if (ready()) {
      perform(request);
      return;
    }
    pending = request;
    pickerOpen = true;
    notify();
  };

  const submit = (text: string) => ask({ text });

  /**
   * Follow the provider, but only as far as this browser has been: the model it
   * last used with it. A provider chosen for the first time ends on its model
   * list, because nothing here picks a model for anyone.
   */
  const follow = async () => {
    if (!providerId || models.length === 0) return;
    const mine = picked;
    const restore = restoring();
    // Already on this provider's model: only the level is left to restore. A
    // stored conversation is not on it yet, whatever the agent happens to
    // hold — the default model belongs to a provider too, so the shortcut is
    // not taken while a snapshot is still owed.
    if (!restore && model().provider === providerId) {
      await followThinking();
      return;
    }
    const next = findModel(models, restore?.model ?? (await choices.storedModelId(providerId)));
    if (mine !== picked) return; // a model was picked while the store answered
    // Its model may be gone from the catalog. The level is still the
    // conversation's, and the snapshot is spent either way.
    if (next) await chooseModel(next);
    else if (restore) await followThinking();
    flush();
  };

  const load = (id: string) => {
    catalogError = undefined;
    const have = cachedCatalog(id);
    if (have) {
      models = have;
      modelsLoading = false;
      void follow().then(notify);
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
        void follow().then(notify);
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
      // The stored conversation is listed under the same name the header shows.
      keep();
      notify();
    });
  };

  /**
   * A turn that failed on the key, the account behind it or the model is the
   * provider answering about a choice the transcript cannot fix. The settings
   * page opens on those, where all three are made, with the error row still
   * above the composer.
   *
   * Once per failure: the page is theirs to close again, and only a new error
   * opens it a second time. Every other failure only says so and offers the
   * retry button — a 5xx and a network failure are the provider's own to
   * recover from, and a rate limit, a timeout or a full context window are
   * answered by waiting rather than by anything on that page. Taking the
   * transcript away for those would answer nothing and lose their place.
   */
  const askOnFailure = () => {
    const { error, errorStatus } = store.snapshot();
    if (!error) {
      acted = undefined;
      return;
    }
    if (error === acted) return;
    acted = error;
    if (!errorStatus || !ANSWERED_ON_SETTINGS.has(errorStatus)) return;
    pickerOpen = true;
    historyOpen = false;
  };

  // Provider, model and key are all one picker, so this is the whole of what the
  // surface is told about a provider. The picker asks for a key before it hands a
  // keyed provider back, so `providerId` can always answer.
  const providerViews = (): ChatProvider[] =>
    available.map((entry) => ({
      hasKey: Boolean(keys[entry.id]) || sealed.has(entry.id),
      // A key it has and cannot read yet. The page then offers to unlock it
      // rather than to change or remove a key nothing here is holding.
      locked: sealed.has(entry.id) && !keys[entry.id],
      // And one it has that no key here opens: a passkey that was deleted, or a
      // store carried over from a browser this is not. The page asks for
      // another one and says why rather than showing an empty field.
      keyLost: lost.has(entry.id) && !keys[entry.id],
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

  /**
   * What stands in front of a tool call, in the two words the bar reads it in.
   * A loop carrying no tools reports none of it: there is nothing to gate, so
   * the bar grows no switch for it.
   */
  const toolPolicyView = (): ChatToolPolicy | undefined =>
    runtime.agent.state.tools.length === 0
      ? undefined
      : runtime.approvals.policy() === "never"
        ? "bypass"
        : "ask";

  /** The model's own title, once it names the conversation it was asked about. */
  const generated = (derived?: string) =>
    titled && titled.for === derived ? titled.title : undefined;

  /**
   * A copy of the transcript, and the three choices it ran under. The array is
   * copied because the agent goes on mutating its own.
   *
   * `WholePiSnapshot` is what makes this the one place to edit: a field added to
   * `PiSnapshot` has to be written here, or the object below no longer compiles.
   */
  const capture = (): PiSnapshot => {
    const whole: WholePiSnapshot = {
      messages: [...runtime.agent.state.messages],
      model: ready() ? model().id : undefined,
      provider: providerId,
      thinkingLevel: ready() ? runtime.agent.state.thinkingLevel : undefined,
      title: generated(titleRequest(store.snapshot().messages).derived),
      version: PI_SNAPSHOT_VERSION,
    };
    return whole;
  };

  /** What the history page calls this one: the model's title, or the first message. */
  const listTitle = () => {
    const { derived } = titleRequest(store.snapshot().messages);
    return generated(derived) ?? derived ?? "New conversation";
  };

  /**
   * Write this conversation where the session keeps its own. An empty one is
   * not written — there is nothing to come back to.
   */
  const keep = () => kept?.keep(conversationId, capture(), listTitle());

  /**
   * The whole state, replaced in place: the transcript, and the choices the
   * conversation ran under. What a fresh session does at construction, done to
   * one that is already mounted — so the chat above it never unmounts and the
   * host swaps nothing.
   *
   * The provider is taken the same way it is taken on the first build: the
   * conversation's own, then this browser's, then the first row that can answer.
   * `opening` holds the model and the level until the catalog lands, exactly as
   * before.
   */
  const restore = async (next?: PiSnapshot) => {
    pending = undefined;
    opening = next;
    adoptTitle(next);
    // Before the store is asked anything: the transcript on screen is the one
    // thing that must not wait for a provider to be looked up.
    store.load(next ? usablePiMessages(next.messages) : []);

    const open = openingProvider(
      available,
      { keys, sealed },
      next?.provider ?? (await choices.storedProviderId()),
    );
    if (open && open !== providerId) {
      providerId = open;
      load(open); // notifies, and follows the choices once the catalog is in
      return;
    }
    // The catalog is already in hand, so only the conversation's own model and
    // level are left to follow.
    await follow();
    notify();
  };

  const build = (): ChatSnapshot => {
    const loop = store.snapshot();
    const live = ready();
    const { derived } = titleRequest(loop.messages);
    return {
      agent: agentView(),
      error: loop.error ?? catalogError,
      isStreaming: loop.isStreaming,
      keyLock: keyLockView(),
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
      toolPolicy: toolPolicyView(),
      usage: live ? loop.usage : undefined,
      // A session that keeps no conversations reports none, and the chat then
      // shows no history button at all.
      conversationId: kept ? conversationId : undefined,
      history: kept?.list(),
      historyOpen,
    };
  };

  /**
   * The page's tools, beside the host's. Reassigned rather than pushed into:
   * the list belongs to the page, so a screen that dropped a tool drops it here.
   * The empty state reads `agent.state.tools`, so it follows on its own.
   */
  const offTools = toolset?.subscribe(() => {
    runtime.agent.state.tools = [...hostTools, ...toolset.tools()];
    notify();
  });
  void toolset?.refresh();

  // The store owns the lock, so it is what says the state changed — including
  // the read at construction that finds a lock this session never turned on,
  // and a second session on the same store unlocking it.
  const offLock = secrets?.lock.subscribe(notify);

  const offStore = store.subscribe(() => {
    maybeTitle();
    askOnFailure();
    // Written when the loop settles rather than on every event: a streamed
    // answer notifies per token, and each write is the whole transcript.
    if (!runtime.agent.state.isStreaming) keep();
    notify();
  });

  /**
   * What the store held, once it answers: the keys, and the provider to open
   * on. Everything below it — the catalog, the model, the level — follows from
   * the provider, exactly as it does when one is picked by hand.
   *
   * The conversations are waited on too, so a host that mounts on `ready` gets
   * a history page with its rows already in it.
   */
  const hydrated = (async () => {
    const mine = picked;
    // Which key the store seals with is read before anything is asked of it, so
    // a locked key is never taken for a key this browser does not have.
    await secrets?.lock.ready;
    const wanted = openOn ?? opened?.provider ?? (await choices.storedProviderId());
    const stored = await seedKeys(choices, available, apiKey, wanted, secrets);
    // What this session was given in the meantime is the newer, so it sits over
    // what the store held: a key typed into the settings page before the store
    // answered must not be replaced by the one it used to hold.
    keys = { ...stored.keys, ...keys };
    sealed = stored.sealed;
    lost = stored.lost;
    // Asked once, and asked whatever the lock is doing now: a person who turns
    // it off is left looking at the control that turns it back on.
    if (secrets) lockable = await secrets.lock.supported().catch(() => false);
    // And a provider picked in that same window is the one to open on, so the
    // stored one is dropped rather than loaded over it.
    if (mine === picked) {
      providerId = openingProvider(available, { keys, sealed }, wanted);
      if (providerId) load(providerId);
    }
    // A history of the host's own that cannot read its list is a chat with no
    // rows, not a chat that never mounts: whoever waits on `ready` is waiting
    // to show something.
    await kept?.ready?.catch(() => {});
    notify();
  })();

  return {
    ready: hydrated,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    snapshot() {
      cached ??= build();
      return cached;
    },

    send: submit,

    /**
     * Run a tool because a person picked it, and let the model read what came
     * back. It waits for a provider and for the keys exactly as a message does:
     * the tool would run without either, but nothing would then say anything
     * about the result, which is the half that makes it worth running here.
     */
    callTool: (name) => ask({ tool: name }),

    stop: () => store.stop(),

    /**
     * A new conversation. The one it replaces is kept where the session keeps
     * its own, under the id it had, so the header's plus button files a
     * conversation away rather than losing it.
     */
    reset() {
      keep();
      conversationId = mintConversationId();
      titled = undefined;
      asked = undefined;
      pending = undefined;
      // A new conversation owes the stored one nothing, catalog landed or not.
      opening = undefined;
      store.reset();
    },

    /**
     * Rewind to a user message: a new conversation carrying the turns before
     * it, under the same provider, model and level. The message itself is left
     * out — the surface hands its words back to the composer, and the reader
     * sends them again with or without a change.
     *
     * The conversation being left is kept whole, under the id it had, exactly
     * as the header's plus button keeps it: a fork is a branch and never an
     * edit of what was already said. A turn in flight is stopped, as it is on
     * any other move between conversations.
     *
     * An id that names no user message is no rewind, so nothing happens: the
     * transcript is rebuilt on every event and a click can land a beat after
     * one that changed it.
     */
    fork(messageId) {
      const at = piMessageIndex(messageId);
      const messages = runtime.agent.state.messages;
      if (at === undefined || messages[at]?.role !== "user") return;

      keep();
      conversationId = mintConversationId();
      // The fork names itself: its first message may be one this conversation's
      // title never spoke for.
      void restore({ ...capture(), messages: messages.slice(0, at), title: undefined });
    },

    /**
     * The same rewind, in the conversation on screen: the turns before that
     * message, and then the message itself, sent again. The answer it got is
     * replaced rather than joined, and what was said after it goes with it —
     * this is the branch nobody keeps, which is the whole of the difference
     * from `fork`.
     *
     * The send waits on the swap: a rewind over a streaming answer aborts the
     * turn first, and pi settles a beat later, so a message sent at once would
     * be sent into the transcript being replaced.
     */
    retryFrom(messageId) {
      const at = piMessageIndex(messageId);
      if (at === undefined) return;
      const messages = runtime.agent.state.messages;
      const message = messages[at];
      // Nothing to run again: an answer, a turn that is gone, or a message that
      // was only an image.
      const said = message ? piUserText(message) : "";
      if (!said) return;

      store.load(messages.slice(0, at), () => submit(said));
    },

    respondToTool: (id, approved, reason) => store.respond(id, approved, reason),

    /**
     * Take the gate away, or put it back — the bar's own switch, and the one
     * thing on this surface that answers a tool call before it is made.
     *
     * `bypass` is the gate off for every tool, the page's own included: a page
     * tool is confirmed on every call because the site said it acts, and the
     * session-wide off outranks that, exactly as a host's `approvals: "never"`
     * does. Nothing stores it, so a new session opens asking again. The gate
     * itself answers what was already waiting; see `tools/approvals.ts`.
     */
    setToolPolicy(policy) {
      runtime.approvals.setPolicy(policy === "bypass" ? "never" : asking);
    },

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
      picked += 1;
      providerId = id;
      void choices.storeProviderId(id);
      load(id);
    },

    selectModel(id) {
      const next = findModel(models, id);
      if (!next || !providerId) return;
      // The model itself lands at once; only the level it runs at waits for the
      // store, and the count is what keeps that answer from arriving too late.
      picked += 1;
      void choices.storeModelId(providerId, id);
      void chooseModel(next).then(flush);
    },

    /**
     * Kept per provider and model, because one provider carries reasoning
     * models beside models that take no level at all.
     */
    setThinkingLevel(level) {
      if (!ready() || !providerId) return;
      picked += 1;
      lastThinking = level;
      store.setThinkingLevel(level);
      void choices.storeThinkingLevel(providerId, model().id, level);
    },

    saveKey(id, key) {
      keys = { ...keys, [id]: key };
      // A key typed by hand is one this session can read, whatever the store was
      // holding under that name before it.
      sealed = without(sealed, id);
      lost = without(lost, id);
      void choices.storeApiKey(id, key);
      notify();
    },

    /**
     * Put the keys behind this device's own authenticator, or take them back
     * out. Both open a dialog, so both are called from a click.
     *
     * The store seals with another key afterwards, and nothing there can re-seal
     * what it already holds — only this session has the keys in the clear. So
     * every key it holds is written again under the new one, which is what makes
     * turning the lock on a thing that keeps working rather than a thing that
     * loses a key.
     */
    setKeyLock(on) {
      if (!secrets || lockBusy) return;
      lockBusy = true;
      lockError = undefined;
      notify();
      void (async () => {
        try {
          // The keys are what gets written again, so they have to be in hand.
          await hydrated;
          if (on) await secrets.lock.enable();
          else await secrets.lock.disable();
          await Promise.all(
            Object.entries(keys).map(([provider, key]) => choices.storeApiKey(provider, key)),
          );
          sealed = new Set();
          lost = new Set();
        } catch (failure: unknown) {
          lockError = passkeyFailure(failure);
        } finally {
          lockBusy = false;
          notify();
        }
      })();
    },

    unlockKeys: unlock,

    /**
     * Take a key back out, of the store and of this session. The provider it
     * belongs to can no longer answer, so one that is running is stepped off
     * rather than left to fail the next turn: the settings page then asks for a
     * key again, exactly as it does for a provider that never had one.
     *
     * A key a host passed through `apiKey` goes the same way, for this session.
     * The host holds that one, so a new session is given it again.
     */
    forgetKey(id) {
      keys = Object.fromEntries(Object.entries(keys).filter(([provider]) => provider !== id));
      // A locked key that is dropped is dropped: the store no longer holds it,
      // so there is nothing left to unlock for.
      sealed = without(sealed, id);
      lost = without(lost, id);
      void choices.forgetApiKey(id);
      if (id === providerId) {
        providerId = undefined;
        models = [];
        modelsLoading = false;
        catalogError = undefined;
      }
      notify();
    },

    setPickerOpen(open) {
      pickerOpen = open;
      notify();
    },

    setHistoryOpen(open) {
      historyOpen = open;
      notify();
    },

    /**
     * Move to a stored conversation. The one being left is written first, so
     * nothing is lost by looking at another; one that is gone from the store —
     * dropped to make room, or forgotten in another tab — leaves this one where
     * it is.
     */
    openConversation(id) {
      if (!kept || id === conversationId) return;
      void (async () => {
        // One the store will not hand over leaves this conversation where it
        // is, exactly as one it no longer holds does.
        const next = await kept.read(id).catch(() => undefined);
        // The store answers a beat later, so the conversation asked for may no
        // longer be the one wanted — a second row picked, or a new chat started.
        if (!next || id === conversationId) return;
        keep();
        conversationId = id;
        await restore(next);
      })();
    },

    /**
     * Drop one for good. Dropping the live conversation leaves an empty chat on
     * a new id rather than a transcript nothing stores.
     */
    forgetConversation(id) {
      if (!kept) return;
      kept.forget(id);
      if (id !== conversationId) {
        notify();
        return;
      }
      conversationId = mintConversationId();
      void restore();
    },

    setOptions(next) {
      preferences = { ...preferences, ...next };
      maybeTitle();
      notify();
    },

    save: capture,

    /** The conversation being left is kept, exactly as the history page keeps it. */
    restore(next) {
      keep();
      conversationId = mintConversationId();
      void restore(next);
    },

    dispose() {
      // The last word: a tab that closes mid-conversation still stored it.
      keep();
      offStore();
      offLock?.();
      offTools?.();
      toolset?.dispose();
      store.dispose();
      listeners.clear();
    },
  };
}
