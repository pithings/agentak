import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { WebAgentRuntime } from "@/agent/create-agent";
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

export interface AgentChatState {
  messages: ViewMessage[];
  isStreaming: boolean;
  error?: string;
  usage?: ContextUsageView;
  /** The model of the next turn, whichever provider it belongs to. */
  model: AnyModel;
  queued: QueuedMessage[];
  /** Sends, or queues when the agent is already working. */
  send(text: string): void;
  stop(): void;
  reset(): void;
  /** Answer a tool confirmation, by tool call id. */
  respond(id: string, approved: boolean): void;
  dequeue(id: string): void;
  setModel(model: AnyModel): void;
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
 * Preact state over a pi `Agent`.
 *
 * Every event rebuilds the view from `agent.state`, so nothing is accumulated
 * here that the agent already holds. A counter drives the rebuild because the
 * agent mutates its own arrays.
 */
export function useAgent({ agent, approvals }: WebAgentRuntime): AgentChatState {
  const [tick, setTick] = useState(0);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [queued, setQueued] = useState<QueuedMessage[]>([]);
  const queuedRef = useRef<QueuedMessage[]>([]);
  const nextId = useRef(0);

  const bump = useCallback(() => setTick((current) => current + 1), []);

  const setQueue = useCallback((next: QueuedMessage[]) => {
    queuedRef.current = next;
    setQueued(next);
  }, []);

  useEffect(() => {
    const offAgent = agent.subscribe((event) => {
      bump();
      // A run is still streaming inside its own `agent_end` listener — it
      // settles once every listener has. Nothing else would redraw the composer.
      if (event.type === "agent_end") void agent.waitForIdle().then(bump);
    });
    const offApprovals = approvals.subscribe(bump);
    return () => {
      offAgent();
      offApprovals();
    };
  }, [agent, approvals, bump]);

  // A queued message leaves the list when the loop injects it as a user turn.
  useEffect(() => {
    if (queuedRef.current.length === 0) return;
    const messages = agent.state.messages;
    const landed = new Set<number>();
    const remaining = queuedRef.current.filter((item) => {
      const index = messages.findIndex(
        (message, at) => at >= item.at && !landed.has(at) && isUserText(message, item.text),
      );
      if (index === -1) return true;
      landed.add(index);
      return false;
    });
    if (remaining.length !== queuedRef.current.length) setQueue(remaining);
  }, [agent, setQueue, tick]);

  const snapshot = useMemo(() => {
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
    };
    // `tick` is the whole dependency: the agent mutates in place.
  }, [agent, approvals, failure, tick]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setFailure(undefined);

      if (agent.state.isStreaming) {
        nextId.current += 1;
        agent.steer(userMessage(trimmed));
        setQueue([
          ...queuedRef.current,
          { id: `q${nextId.current}`, text: trimmed, at: agent.state.messages.length },
        ]);
        return;
      }

      agent.prompt(trimmed).catch((error: unknown) => {
        setFailure(error instanceof Error ? error.message : String(error));
      });
      bump();
    },
    [agent, bump, setQueue],
  );

  const dequeue = useCallback(
    (id: string) => {
      const remaining = queuedRef.current.filter((item) => item.id !== id);
      // pi's queue drains as a whole, so removing one means re-queuing the rest.
      agent.clearSteeringQueue();
      for (const item of remaining) agent.steer(userMessage(item.text));
      setQueue(remaining);
    },
    [agent, setQueue],
  );

  return {
    ...snapshot,
    queued,
    send,
    dequeue,
    stop: useCallback(() => {
      agent.abort();
      bump();
    }, [agent, bump]),
    reset: useCallback(() => {
      agent.abort();
      agent.reset();
      approvals.clear();
      setQueue([]);
      setFailure(undefined);
      bump();
    }, [agent, approvals, bump, setQueue]),
    respond: useCallback(
      (id: string, approved: boolean) => approvals.respond(id, approved),
      [approvals],
    ),
    setModel: useCallback(
      (model: AnyModel) => {
        agent.state.model = model;
        bump();
      },
      [agent, bump],
    ),
  };
}
