import type { AgentMessage } from "@earendil-works/pi-agent-core";

import type { AgentRuntime } from "@/agent/create-agent";
import type { AnyModel } from "@/agent/providers";
import { type ContextUsageView, toContextUsage, toViewMessages } from "@/agent/transcript";
import type { ViewMessage } from "@/types";

/** A message typed while the agent was busy. pi holds it; this holds its text. */
export interface QueuedMessage {
  id: string;
  text: string;
  /** Transcript length when it was queued — where to look for it landing. */
  at: number;
}

/** What the loop shows, rebuilt from `agent.state` on every event. */
export interface AgentSnapshot {
  messages: ViewMessage[];
  isStreaming: boolean;
  error?: string;
  usage?: ContextUsageView;
  /** The model of the next turn, whichever provider it belongs to. */
  model: AnyModel;
  queued: QueuedMessage[];
}

export interface AgentStore {
  subscribe(listener: () => void): () => void;
  /** Identity-stable between notifications. */
  snapshot(): AgentSnapshot;
  /** Sends, or queues when the agent is already working. */
  send(text: string): void;
  stop(): void;
  reset(): void;
  /** Answer a tool confirmation, by tool call id. */
  respond(id: string, approved: boolean): void;
  dequeue(id: string): void;
  setModel(model: AnyModel): void;
  /** Stops listening to the agent. The agent itself is the caller's. */
  dispose(): void;
}

const userMessage = (text: string): AgentMessage => ({
  role: "user",
  content: [{ type: "text", text }],
  timestamp: Date.now(),
});

const isUserText = (message: AgentMessage, text: string) =>
  message.role === "user" &&
  (typeof message.content === "string"
    ? message.content
    : message.content.map((block) => (block.type === "text" ? block.text : "")).join("")) === text;

/**
 * A subscribable view of a pi `Agent`.
 *
 * Every event rebuilds the view from `agent.state`, so nothing is accumulated
 * here that the agent already holds. The rebuilt snapshot is cached until the
 * next event, because the agent mutates its own arrays and identity is the only
 * signal a renderer has.
 *
 * `useAgent` is this store as a hook, and `createPiSession` is this store with
 * the provider picker around it. Neither adds loop logic of its own.
 */
export function createAgentStore({ agent, approvals }: AgentRuntime): AgentStore {
  const listeners = new Set<() => void>();
  let cached: AgentSnapshot | undefined;
  let failure: string | undefined;
  let queued: QueuedMessage[] = [];
  let nextId = 0;

  const notify = () => {
    cached = undefined;
    for (const listener of listeners) listener();
  };

  // A queued message leaves the list when the loop injects it as a user turn.
  const reconcile = () => {
    if (queued.length === 0) return;
    const messages = agent.state.messages;
    const landed = new Set<number>();
    const remaining = queued.filter((item) => {
      const index = messages.findIndex(
        (message, at) => at >= item.at && !landed.has(at) && isUserText(message, item.text),
      );
      if (index === -1) return true;
      landed.add(index);
      return false;
    });
    if (remaining.length !== queued.length) queued = remaining;
  };

  const offAgent = agent.subscribe((event) => {
    reconcile();
    notify();
    // A run is still streaming inside its own `agent_end` listener — it settles
    // once every listener has. Nothing else would redraw the composer.
    if (event.type === "agent_end") void agent.waitForIdle().then(notify);
  });
  const offApprovals = approvals.subscribe(notify);

  const build = (): AgentSnapshot => {
    const messages = agent.state.messages;
    return {
      messages: toViewMessages(messages, agent.state.streamingMessage, {
        answers: approvals.answers(),
        pending: approvals.pending(),
      }),
      usage: toContextUsage(messages, agent.state.model),
      isStreaming: agent.state.isStreaming,
      model: agent.state.model as AnyModel,
      error: failure ?? agent.state.errorMessage,
      queued,
    };
  };

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
      const trimmed = text.trim();
      if (!trimmed) return;
      failure = undefined;

      if (agent.state.isStreaming) {
        nextId += 1;
        agent.steer(userMessage(trimmed));
        queued = [...queued, { id: `q${nextId}`, text: trimmed, at: agent.state.messages.length }];
        notify();
        return;
      }

      agent.prompt(trimmed).catch((error: unknown) => {
        failure = error instanceof Error ? error.message : String(error);
        notify();
      });
      notify();
    },

    dequeue(id) {
      const remaining = queued.filter((item) => item.id !== id);
      // pi's queue drains as a whole, so removing one means re-queuing the rest.
      agent.clearSteeringQueue();
      for (const item of remaining) agent.steer(userMessage(item.text));
      queued = remaining;
      notify();
    },

    stop() {
      agent.abort();
      notify();
    },

    reset() {
      agent.abort();
      agent.reset();
      approvals.clear();
      queued = [];
      failure = undefined;
      notify();
    },

    respond(id, approved) {
      approvals.respond(id, approved);
    },

    setModel(model) {
      agent.state.model = model;
      notify();
    },

    dispose() {
      offAgent();
      offApprovals();
      listeners.clear();
    },
  };
}
