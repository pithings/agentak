import { useEffect, useRef, useState } from "preact/hooks";

import type { ChatProps } from "@/components/chat";

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
 * single list; a harness with no token accounting carries no `usage`, and the
 * composer shows no meter.
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
  | "models"
  | "modelId"
  | "modelsLoading"
  | "pickerOpen"
>;

/**
 * Preferences the host declares rather than the session decides.
 * `<agent-chat>` reads these off its attributes and passes them down, so an
 * attribute can change without a new session and a lost transcript.
 */
export interface ChatSessionOptions {
  /** Ask the model to name the conversation. It costs one request. */
  generateTitle?: boolean;
}

/**
 * A live chat, whatever runs it.
 *
 * `createPiSession` from `agentak/pi` is the built-in one — the pi loop over the
 * page tools, with the provider picker in front of it. A host with its own
 * harness implements this instead and keeps the whole surface.
 *
 * Subscribe and snapshot rather than a hook, so a session can be written in any
 * framework, or none: the chat is a custom element, and its host is usually not
 * preact. Only the first six members are needed; the rest turn on the parts of
 * the surface that answer back.
 */
export interface ChatSession {
  /** Called on every change. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /**
   * The current view. Must be identity-stable between notifications — the
   * surface re-reads it on every render, and a fresh object each time redraws
   * the whole transcript.
   */
  snapshot(): ChatSnapshot;
  send(text: string): void;
  stop(): void;
  reset(): void;
  /** Answer a tool confirmation, by tool call id. Without it, nothing is gated. */
  respond?(toolCallId: string, approved: boolean): void;
  /** Drop a message that is still waiting its turn. */
  dequeue?(id: string): void;
  selectProvider?(id: string): void;
  selectModel?(id: string): void;
  saveKey?(providerId: string, key: string): void;
  /**
   * Only a session that opens the picker itself needs this — the built-in one
   * does, because a first message with no provider chosen asks. Otherwise the
   * surface holds the flag.
   */
  setPickerOpen?(open: boolean): void;
  setOptions?(options: ChatSessionOptions): void;
  /** Called by whoever created the session — `<agent-chat>` on disconnect. */
  dispose?(): void;
}

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

  useEffect(() => {
    const bump = () => setTick((tick) => tick + 1);
    const off = session.subscribe(bump);
    if (session.snapshot() !== rendered.current) bump();
    return off;
  }, [session]);

  return snapshot;
}
