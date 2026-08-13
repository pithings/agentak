import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";

import type { AgentRuntime } from "@/pi/create-agent";
import type { AnyModel } from "@/pi/providers";
import { type ContextUsageView, toContextUsage, toViewMessages } from "@/pi/transcript";
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
  /** How hard that model is asked to think. `off` unless somebody raised it. */
  thinkingLevel: ThinkingLevel;
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
  /**
   * Answer a tool confirmation, by tool call id. A denial's `reason` is what the
   * model is told instead of the tool's output, so it can take another way.
   */
  respond(id: string, approved: boolean, reason?: string): void;
  dequeue(id: string): void;
  /** Take the current error off the view. The transcript stays. */
  clearError(): void;
  /** Run the failed turn again, in place. No-op when there is nothing to retry. */
  retry(): void;
  setModel(model: AnyModel): void;
  /**
   * Raise or drop the reasoning effort of the next turn. The caller checks the
   * model offers the level — pi sends whatever it is given.
   */
  setThinkingLevel(level: ThinkingLevel): void;
  /** Stops listening to the agent. The agent itself is the caller's. */
  dispose(): void;
}

const userMessage = (text: string): AgentMessage => ({
  role: "user",
  content: [{ type: "text", text }],
  timestamp: Date.now(),
});

/**
 * A turn that ended in an error. pi records one as an empty assistant message
 * carrying `errorMessage`, so this is what stands between the transcript and a
 * `continue()`, which reads an assistant message as a turn already answered.
 */
const isFailedTurn = (message: AgentMessage) =>
  message.role === "assistant" && Boolean(message.errorMessage);

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
  /**
   * What was dismissed. `agent.state.errorMessage` is the agent's and read-only,
   * so a dismissed one is masked rather than cleared — and the mask goes with
   * the next send, so the same error twice over is still shown twice.
   */
  let dismissed: string | undefined;
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
    const error = failure ?? agent.state.errorMessage;
    return {
      messages: toViewMessages(messages, agent.state.streamingMessage, {
        answers: approvals.answers(),
        pending: approvals.pending(),
      }),
      usage: toContextUsage(messages, agent.state.model),
      isStreaming: agent.state.isStreaming,
      model: agent.state.model as AnyModel,
      thinkingLevel: agent.state.thinkingLevel,
      error: error === dismissed ? undefined : error,
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
      dismissed = undefined;

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
      dismissed = undefined;
      notify();
    },

    clearError() {
      dismissed = failure ?? agent.state.errorMessage;
      failure = undefined;
      notify();
    },

    /**
     * The failed turn is dropped before the loop runs on: a retry replaces it
     * rather than following it, and `continue()` refuses a transcript that ends
     * on an assistant message anyway. What is left must end on the user or a
     * tool result — anything else is a turn that already answered, and there is
     * nothing to run again.
     */
    retry() {
      if (agent.state.isStreaming) return;

      const messages = agent.state.messages;
      let end = messages.length;
      while (end > 0 && isFailedTurn(messages[end - 1])) end--;

      const last = messages[end - 1];
      if (!last || (last.role !== "user" && last.role !== "toolResult")) return;

      if (end !== messages.length) agent.state.messages = messages.slice(0, end);
      failure = undefined;
      dismissed = undefined;

      agent.continue().catch((error: unknown) => {
        failure = error instanceof Error ? error.message : String(error);
        notify();
      });
      notify();
    },

    respond(id, approved, reason) {
      approvals.respond(id, approved, reason);
    },

    setModel(model) {
      agent.state.model = model;
      notify();
    },

    setThinkingLevel(level) {
      agent.state.thinkingLevel = level;
      notify();
    },

    dispose() {
      offAgent();
      offApprovals();
      listeners.clear();
    },
  };
}
