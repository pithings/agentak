// Docs: @docs/4.agents/2.pi/9.advanced-api.md
// Docs: @docs/4.agents/2.pi/8.runtime-behavior.md
import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent, Usage } from "@earendil-works/pi-ai";

import type { AgentRuntime } from "./agent.ts";
import { describeFailure, failureStatus } from "./chat/errors.ts";
import type { AnyModel } from "./providers.ts";
import { isFailedTurn } from "./snapshot.ts";
import { type ContextUsageView, toContextUsage, toViewMessages } from "./chat/transcript.ts";
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
  /**
   * Run one of the agent's tools now, because a person asked for it rather than
   * the model.
   *
   * The call is written into the transcript as though the model had asked — a
   * provider takes a tool result only after the call it answers — and the loop
   * then carries on from that result, so the model reads what came back and says
   * something about it. That is the whole point of running one this way: a tool
   * result nobody reads is a person reading raw output.
   *
   * No arguments are passed, because nothing on the surface types any. A tool
   * that wants some fails, the failure is the result, and the model can call it
   * again properly — which is a better answer than refusing to run it here.
   *
   * The approval gate is not asked. It stands in front of the model, and this
   * call has the one thing the model's never has: the person choosing it.
   *
   * No-op while a turn or another such call is running, and while the tool is
   * running the store reports `isStreaming` — the transcript holds a call with
   * no result yet, which is exactly what nothing else may be sent into.
   */
  callTool(name: string): void;
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

/** Nothing was spent: the call was made here and not by a provider. */
const noUsage = (): Usage => ({
  cacheRead: 0,
  cacheWrite: 0,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
  input: 0,
  output: 0,
  totalTokens: 0,
});

/**
 * The call a person asked for, written the way a model's own is.
 *
 * It carries the current model's name because that is what the transcript is
 * about to be sent to: a tool result belongs to the conversation, and the
 * conversation is with this model.
 */
const handCall = (id: string, name: string, model: AnyModel): AgentMessage => ({
  role: "assistant",
  api: model.api,
  content: [{ type: "toolCall", arguments: {}, id, name }],
  model: model.id,
  provider: model.provider,
  stopReason: "toolUse",
  timestamp: Date.now(),
  usage: noUsage(),
});

const toolResult = (
  id: string,
  name: string,
  content: (TextContent | ImageContent)[],
  isError: boolean,
  details?: unknown,
): AgentMessage => ({
  role: "toolResult",
  content,
  details,
  isError,
  timestamp: Date.now(),
  toolCallId: id,
  toolName: name,
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
  /**
   * A tool a person asked for, running outside any turn. pi knows nothing about
   * it, so the store carries the three things a run has: that it is happening,
   * the way to stop it, and which transcript it belongs to — a conversation
   * swapped mid-call must not take the result of the one before it.
   */
  let calling: AbortController | undefined;
  let generation = 0;

  /** Nothing may be sent while either kind of run holds the transcript. */
  const busy = () => agent.state.isStreaming || calling !== undefined;

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
    // A hand-run tool is a run of this store's own, and a swap ends it like any
    // other: the generation is what its own continuation reads to find that the
    // transcript it was called from is gone.
    generation += 1;
    calling?.abort();
    calling = undefined;

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

  /**
   * The loop, run on from a transcript that ends on something it can answer — a
   * failed turn dropped, or a tool result nobody has read yet. `prompt()` is for
   * what a person says; this is for what is already there.
   */
  const carryOn = () => {
    agent.continue().catch((error: unknown) => {
      failure = error instanceof Error ? error.message : String(error);
      notify();
    });
    notify();
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
      // A tool running by hand is the surface's turn as much as the model's: the
      // transcript holds a call with no result yet, and the stop button is what
      // ends it.
      isStreaming: busy(),
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

      // Queued behind a hand-run tool as well: pi drains its steering queue at
      // the first chance the continuation gives it, which is the turn that reads
      // the tool's result.
      if (busy()) {
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
      // The other kind of run this store can be in the middle of. A tool given
      // no signal of its own ignores it, and the result still lands — what stops
      // either way is the turn that would have read it.
      calling?.abort();
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
      if (busy()) return;

      const messages = agent.state.messages;
      let end = messages.length;
      while (end > 0 && isFailedTurn(messages[end - 1])) end--;

      const last = messages[end - 1];
      if (!last || (last.role !== "user" && last.role !== "toolResult")) return;

      if (end !== messages.length) agent.state.messages = messages.slice(0, end);
      failure = undefined;
      dismissed = undefined;

      carryOn();
    },

    callTool(name) {
      if (busy()) return;
      const tool = agent.state.tools.find((entry) => entry.name === name);
      if (!tool) return;

      failure = undefined;
      dismissed = undefined;
      nextId += 1;
      // The id is the seam between the call and its result, and both are written
      // here, so the only thing it has to be is unlike every other id in this
      // transcript — a restored one included.
      const id = `hand-${Date.now()}-${nextId}`;
      agent.state.messages = [...agent.state.messages, handCall(id, name, agent.state.model)];

      const run = new AbortController();
      calling = run;
      const mine = generation;
      // The call is drawn as running while the tool works, exactly as the
      // model's own is.
      notify();

      void (async () => {
        let result: AgentMessage;
        try {
          const output = await tool.execute(id, {}, run.signal);
          result = toolResult(id, name, output.content, false, output.details);
        } catch (error: unknown) {
          // A tool that wanted arguments, or one that failed: either way the
          // model reads what went wrong and can ask for it properly.
          const said = error instanceof Error ? error.message : String(error);
          result = toolResult(id, name, [{ type: "text", text: said }], true);
        }
        // The conversation this was called from is gone — a new one, or a stored
        // one opened while the tool worked. Its result belongs to neither.
        if (mine !== generation) return;

        calling = undefined;
        agent.state.messages = [...agent.state.messages, result];
        // Stopped: the result is written all the same, because a call with none
        // is a transcript no provider accepts. Nothing reads it until the next
        // thing said.
        if (run.signal.aborted) {
          notify();
          return;
        }
        carryOn();
      })();
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
      generation += 1;
      calling?.abort();
      offAgent();
      offApprovals();
      listeners.clear();
    },
  };
}
