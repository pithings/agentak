// Docs: @docs/4.agents/2.pi-agent/9.advanced-api.md
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { AgentRuntime } from "../agent.ts";
import { type AgentSnapshot, type AgentStore, createAgentStore } from "../chat.ts";
import type { AnyModel } from "../providers.ts";

export type { QueuedMessage } from "../chat.ts";

export interface ChatState extends AgentSnapshot {
  /** Sends, or queues when the agent is already working. */
  send(text: string): void;
  stop(): void;
  reset(): void;
  /** Answer a tool confirmation, by tool call id. A denial can say why. */
  respond(id: string, approved: boolean, reason?: string): void;
  dequeue(id: string): void;
  /** Take the current error off the view. The transcript stays. */
  clearError(): void;
  /** Run the failed turn again, in place. */
  retry(): void;
  setModel(model: AnyModel): void;
  /** How hard the model thinks before it answers. */
  setThinkingLevel(level: ThinkingLevel): void;
}

/** Renders again whenever the store says so. See `useSession` for the same guard. */
function useStore(store: AgentStore): AgentSnapshot {
  const [, setTick] = useState(0);
  const snapshot = store.snapshot();
  const rendered = useRef(snapshot);
  rendered.current = snapshot;

  useEffect(() => {
    const bump = () => setTick((tick) => tick + 1);
    const off = store.subscribe(bump);
    if (store.snapshot() !== rendered.current) bump();
    return off;
  }, [store]);

  return snapshot;
}

/**
 * Preact state over a pi `Agent` — `createAgentStore` as a hook.
 *
 * For a host that wants its own surface but not its own loop. `AgentChat` uses
 * `createPiSession` instead, which is the same store with the provider picker
 * around it.
 */
export function useAgent(runtime: AgentRuntime): ChatState {
  const store = useMemo(() => createAgentStore(runtime), [runtime]);
  useEffect(() => () => store.dispose(), [store]);
  const snapshot = useStore(store);

  return {
    ...snapshot,
    send: store.send,
    stop: store.stop,
    reset: store.reset,
    respond: store.respond,
    dequeue: store.dequeue,
    clearError: store.clearError,
    retry: store.retry,
    setModel: store.setModel,
    setThinkingLevel: store.setThinkingLevel,
  };
}
