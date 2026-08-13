import { useEffect, useRef, useState } from "preact/hooks";

import type { ChatProps, ChatThinkingLevel } from "@/components/chat";

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
  | "queued"
  | "providers"
  | "providerId"
  | "providerLabel"
  | "models"
  | "modelId"
  | "modelsLoading"
  | "thinkingLevel"
  | "thinkingLevels"
  | "pickerOpen"
>;

/** What the host mounts, rather than what a harness reports. */
type HostOwned = "className" | "style" | "actions" | "emptyActions";

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
 * One conversation: a host switches conversations by switching sessions, which
 * `useSession` keys on. Nothing here loads or lists a transcript.
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
   * Answer a tool confirmation, by tool call id. Without it, nothing is gated.
   *
   * `reason` rides along with a denial: it is what the harness tells the model
   * in place of the tool's output, so "not that one, use the other selector"
   * steers the next turn rather than only failing this one.
   */
  respondToTool?(toolCallId: string, approved: boolean, reason?: string): void;
  /** Drop a message that is still waiting its turn. Pairs with `queued`. */
  dequeue?(id: string): void;
  /** Clear `error` without dropping the transcript, which `reset()` would. */
  dismissError?(): void;
  /**
   * Run the failed turn again, in place — the other answer to an error, beside
   * dismissing it. Pairs with `error`, and the surface offers it nowhere else.
   */
  retry?(): void;

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
   * Only a session that opens the picker itself needs this — the built-in one
   * does, because a first message with no provider chosen asks. Implementing it
   * makes the session authoritative, and the surface then reads `pickerOpen`
   * from the snapshot alone. Otherwise the surface holds the flag.
   */
  setPickerOpen?(open: boolean): void;

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
