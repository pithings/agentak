// Docs: @docs/4.agents/2.pi-agent/9.advanced-api.md
// Docs: @docs/4.agents/2.pi-agent/8.runtime-behavior.md
import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";

import type { AgentRuntime } from "./create-agent.ts";
import { describeFailure, failureStatus } from "./errors.ts";
import type { AnyModel } from "./providers.ts";
import { isFailedTurn } from "./snapshot.ts";
import { type ContextUsageView, toContextUsage, toViewMessages } from "./transcript.ts";
import type { ViewMessage } from "../types.ts";

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
  /**
   * The status behind `error`, when the provider named one. The message is
   * already worded for the person reading it, so this is for whoever acts on a
   * failure rather than shows it.
   */
  errorStatus?: number;
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
   * Replace the transcript in place — a stored conversation, or nothing, which
   * is `reset()`. The messages are the caller's to cut: pi is handed whatever
   * this is given. See `usablePiMessages()`.
   *
   * `after` runs once the swap has landed, which is not this call where a turn
   * was streaming through it. A caller that sends into the new transcript —
   * rewind and run it again — has to say so here, or it sends into the old one.
   */
  load(messages: AgentMessage[], after?: () => void): void;
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

  /**
   * The transcript, replaced in place. pi refuses to reset while a run is
   * active, and `abort()` only asks — the run ends once its listeners have. So
   * a swap over a streaming turn waits on `waitForIdle()`, and an idle one,
   * which is every swap a person makes, lands at once.
   */
  const load = (messages: AgentMessage[], after?: () => void) => {
    const swap = () => {
      agent.reset();
      if (messages.length > 0) agent.state.messages = [...messages];
      approvals.clear();
      queued = [];
      failure = undefined;
      dismissed = undefined;
      notify();
      after?.();
    };

    if (!agent.state.isStreaming) {
      swap();
      return;
    }
    agent.abort();
    void agent.waitForIdle().then(swap);
  };

  const build = (): AgentSnapshot => {
    const messages = agent.state.messages;
    const raw = failure ?? agent.state.errorMessage;
    const error = raw === dismissed ? undefined : raw;
    return {
      messages: toViewMessages(messages, agent.state.streamingMessage, {
        answers: approvals.answers(),
        pending: approvals.pending(),
      }),
      usage: toContextUsage(messages, agent.state.model),
      isStreaming: agent.state.isStreaming,
      model: agent.state.model as AnyModel,
      thinkingLevel: agent.state.thinkingLevel,
      error: describeFailure(error),
      errorStatus: failureStatus(error),
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

    reset: () => load([]),

    load,

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
