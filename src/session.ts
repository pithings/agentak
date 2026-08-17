// Docs: @docs/4.agents/3.custom-agents.md
import { useEffect, useRef, useState } from "preact/hooks";

import type { ChatProps, ChatThinkingLevel, ChatToolPolicy } from "./components/chat.tsx";

/**
 * What a harness owns of the chat surface.
 *
 * A `Pick` of `ChatProps` rather than a shape of its own, so a session cannot
 * drift from what `Chat` renders — the surface's props are the contract. What is
 * left out belongs to whoever mounts the chat: the size, the class, the host's
 * own chrome in the header and the empty state.
 *
 * Everything past the transcript is optional. A harness with one fixed model
 * carries no `providers` and no `models`, and the picker then heads its own
 * single list under `providerLabel`; a harness with no token accounting carries
 * no `usage`, and the composer shows no meter.
 */
export type ChatSnapshot = Pick<
  ChatProps,
  | "messages"
  | "isStreaming"
  | "error"
  | "title"
  | "agent"
  | "usage"
  | "toolPolicy"
  | "queued"
  | "providers"
  | "providerId"
  | "providerLabel"
  | "models"
  | "modelId"
  | "modelsLoading"
  | "thinkingLevel"
  | "thinkingLevels"
  | "keyLock"
  | "pickerOpen"
  | "history"
  | "conversationId"
  | "historyOpen"
>;

/** What the host mounts, rather than what a harness reports. */
type HostOwned =
  | "className"
  | "style"
  | "actions"
  | "autoFocus"
  | "emptyActions"
  | "prompts"
  | "linkBase";

/** What the surface calls back on. `AgentChat` routes every one to the session. */
type Callbacks = Extract<keyof ChatProps, `on${string}`>;

/** Errors on anything but `never`, which is what makes the two lists below bite. */
type Exhausted<T extends never> = T;

/**
 * Every `ChatProps` key belongs to the snapshot, the host, or a callback. One
 * that joins none of the three fails to compile here rather than going
 * unreachable in silence — `Pick` catches a rename, never an addition.
 */
export type ChatPropsAccountedFor = Exhausted<
  Exclude<keyof ChatProps, keyof ChatSnapshot | HostOwned | Callbacks>
>;

/**
 * Preferences the host declares rather than the session decides. They travel as
 * props on `AgentChat`, so one can change without a new session and a lost
 * transcript. Merged, never cleared: an absent prop keeps what the session has.
 */
export interface ChatSessionOptions {
  /** Ask the model to name the conversation. It costs one request. */
  generateTitle?: boolean;
}

/** The same keys at runtime, so `AgentChat` forwards by list, not by hand. */
export const CHAT_SESSION_OPTIONS = [
  "generateTitle",
] as const satisfies readonly (keyof ChatSessionOptions)[];

/** A new option that never joined the list would never be forwarded. */
export type ChatSessionOptionsListed = Exhausted<
  Exclude<keyof ChatSessionOptions, (typeof CHAT_SESSION_OPTIONS)[number]>
>;

/**
 * A live chat, whatever runs it.
 *
 * `createPiSession` from `agentak/pi` is the built-in one — the pi loop with the
 * provider picker in front of it. A host with its own
 * harness implements this instead and keeps the whole surface.
 *
 * One conversation at a time, and the session is what moves between them:
 * `history` lists what it has stored and `openConversation` replaces its own
 * state with one, so the chat stays mounted. A harness that stores nothing
 * reports no `history`, and the surface then shows no list at all. A host can
 * still switch conversations by switching sessions, which `useSession` keys on.
 *
 * Subscribe and snapshot rather than a hook, so a session can be written in any
 * framework, or none: the surface is preact, but the app around it is usually
 * not. Only the first five members are needed; the rest turn on the parts of the
 * surface that answer back, and absent means gone rather than broken.
 */
export interface ChatSession {
  /** Called after every change. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /**
   * The current view. Cheap, and identity-stable between notifications — the
   * surface reads it more than once per render, and a fresh object each time
   * redraws the whole transcript. Cache it, and drop the cache in `notify()`.
   */
  snapshot(): ChatSnapshot;
  send(text: string): void;
  stop(): void;
  reset(): void;

  /**
   * Run one of the agent's tools now, by the name `agent.tools` lists it under —
   * the person picked it from the composer's slash list rather than the model
   * asking for it.
   *
   * A harness runs the tool, puts the call and its result in the transcript, and
   * carries on so the model reads what came back. No arguments are passed: the
   * surface types none. Without it the list still names the tools, but picking
   * one only writes the name into the message.
   */
  callTool?(name: string): void;

  /**
   * Answer a tool confirmation, by tool call id. Without it, nothing is gated.
   *
   * `reason` rides along with a denial: it is what the harness tells the model
   * in place of the tool's output, so "not that one, use the other selector"
   * steers the next turn rather than only failing this one.
   */
  respondToTool?(toolCallId: string, approved: boolean, reason?: string): void;
  /**
   * Ask before a tool runs, or let them run. Pairs with `toolPolicy`, and the
   * bar under the composer is the one control for both halves.
   *
   * `ask` is whatever gate the harness has — every call, or the first of each
   * tool. `bypass` is that gate off, for as long as this session lives: it is a
   * thing a person decides about the conversation in front of them, so nothing
   * here stores it, and the next session opens asking again.
   */
  setToolPolicy?(policy: ChatToolPolicy): void;
  /** Drop a message that is still waiting its turn. Pairs with `queued`. */
  dequeue?(id: string): void;
  /** Clear `error` without dropping the transcript, which `reset()` would. */
  dismissError?(): void;
  /**
   * Run the failed turn again, in place — the other answer to an error, beside
   * dismissing it. Pairs with `error`, and the surface offers it nowhere else.
   */
  retry?(): void;

  /**
   * Rewind to a user message, by the id it carries in `messages`.
   *
   * A new conversation carrying everything before that message, and nothing of
   * the turn it started. The surface puts what it said back in the composer, so
   * the reader can change a word and go again — a branch, not an edit: the
   * conversation being left is untouched, and a harness that keeps its own
   * stores it exactly as `reset()` does.
   *
   * Without it, no message carries a fork button. One that keeps no
   * conversations still forks, and the transcript it rewinds from goes the way
   * `reset()` sends it.
   */
  fork?(messageId: string): void;
  /**
   * The same rewind, in the conversation on screen: cut back to just before
   * that user message and run it again, so the answer it got is replaced rather
   * than joined. What was said after it goes with it — this is the branch
   * nobody keeps, which is the whole of the difference from `fork`.
   *
   * Not `retry`, which is the error row's button and runs a turn that failed.
   * This one runs a turn that answered.
   */
  retryFrom?(messageId: string): void;

  /** Pairs with `providers`. */
  selectProvider?(id: string): void;
  /** Pairs with `models`. */
  selectModel?(id: string): void;
  /**
   * How hard the chosen model thinks before it answers. Pairs with
   * `thinkingLevels`, which is what that model offers — a model with no
   * reasoning offers `off` alone, and the picker then shows no level at all.
   */
  setThinkingLevel?(level: ChatThinkingLevel): void;
  saveKey?(providerId: string, key: string): void;
  /**
   * Drop the key a provider is set up with. Pairs with `saveKey`: without it the
   * settings page offers no way to take one back out, and a key typed once is
   * kept for as long as the harness keeps it.
   *
   * The provider then has no key, so the harness reports it as one to set up
   * again — and steps off it if it was the one running.
   */
  forgetKey?(providerId: string): void;
  /**
   * Put the stored keys behind the device's own authenticator, or take them
   * back out from behind it. Pairs with `keyLock`; without both, the settings
   * page shows no such section.
   *
   * Called from a click, because that is what the browser wants before it opens
   * the dialog either one leads to.
   */
  setKeyLock?(on: boolean): void;
  /**
   * Ask the device for the key, for this visit. The other half of a `locked`
   * state, and the one thing that reads a key back out of a locked store.
   *
   * The surface calls it from the settings page. A harness may also call it
   * itself where a message is sent with the keys locked — the built-in one
   * does, since the send is a click and so carries what the dialog needs.
   */
  unlockKeys?(): void;

  /**
   * Only a session that opens the picker itself needs this — the built-in one
   * does, because a first message with no provider chosen asks. Implementing it
   * makes the session authoritative, and the surface then reads `pickerOpen`
   * from the snapshot alone. Otherwise the surface holds the flag.
   */
  setPickerOpen?(open: boolean): void;

  /**
   * Open a stored conversation, by the id `history` lists it under.
   *
   * The session replaces its own state with it — the transcript and whatever
   * the conversation ran under — rather than the host swapping sessions around
   * a mounted chat. Pairs with `history`; without it the page lists rows that
   * nothing opens.
   */
  openConversation?(id: string): void;
  /** Drop a stored conversation. Without it a row carries no forget button. */
  forgetConversation?(id: string): void;
  /**
   * The history page's flag, the same deal as `setPickerOpen`: a session that
   * answers this owns both halves, and the surface then reads
   * `snapshot.historyOpen` alone. Otherwise the surface holds it.
   */
  setHistoryOpen?(open: boolean): void;

  setOptions?(options: ChatSessionOptions): void;
}

/** Vite sets it; a bundler that does not leaves the check off. */
const DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

/** Warned once per session — the rule is broken for the life of one, or never. */
const scolded = new WeakSet<ChatSession>();

/**
 * Subscribes a preact tree to a session.
 *
 * The snapshot is read during the render, and the subscription is checked once
 * it lands: an event between the two would otherwise leave the surface showing
 * a view the session has already replaced.
 */
export function useSession(session: ChatSession): ChatSnapshot {
  const [, setTick] = useState(0);
  const snapshot = session.snapshot();
  const rendered = useRef(snapshot);
  rendered.current = snapshot;

  // The one rule the surface cannot hold up itself. Breaking it costs no error,
  // only a transcript that redraws whole, so say so where it is cheapest to fix.
  if (DEV && !scolded.has(session) && session.snapshot() !== snapshot) {
    scolded.add(session);
    console.warn(
      "[agentak] snapshot() is not identity-stable between notifications — cache it, and drop the cache in notify().",
    );
  }

  useEffect(() => {
    const bump = () => setTick((tick) => tick + 1);
    const off = session.subscribe(bump);
    if (session.snapshot() !== rendered.current) bump();
    return off;
  }, [session]);

  return snapshot;
}
