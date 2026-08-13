import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { AgentRuntime } from "@/agent/create-agent";
import { type AgentSnapshot, type AgentStore, createAgentStore } from "@/agent/store";
import type { AnyModel } from "@/agent/providers";

export type { QueuedMessage } from "@/agent/store";

export interface ChatState extends AgentSnapshot {
  /** Sends, or queues when the agent is already working. */
  send(text: string): void;
  stop(): void;
  reset(): void;
  /** Answer a tool confirmation, by tool call id. */
  respond(id: string, approved: boolean): void;
  dequeue(id: string): void;
  setModel(model: AnyModel): void;
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
    setModel: store.setModel,
  };
}
