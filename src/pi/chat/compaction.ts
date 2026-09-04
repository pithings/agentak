// Docs: @docs/4.agents/2.pi/8.runtime-behavior.md
import {
  type AgentMessage,
  compact,
  createCompactionSummaryMessage,
  type MessageEntry,
  prepareCompaction,
  type StreamFn,
  type ThinkingLevel,
} from "@earendil-works/pi-agent-core";
import type { Models } from "@earendil-works/pi-ai";

import { compactionSettings } from "./transcript.ts";
import { type AnyModel, streamFor } from "../providers.ts";

/**
 * The transcript as pi's compaction helpers read it: a session's entries.
 *
 * They were written for the harness, which keeps a tree of entries rather than
 * a list of messages, and this loop has the list. The tree is one straight line
 * here — each message the child of the one before it — so it costs a map, and
 * the cut-point rules come with it: a cut never lands between a tool call and
 * its result, and a turn is summarized whole or split at its own start.
 */
const entriesOf = (messages: AgentMessage[]): MessageEntry[] =>
  messages.map((message, index) => ({
    type: "message",
    id: `m${index}`,
    parentId: index === 0 ? null : `m${index - 1}`,
    seq: index,
    timestamp: message.timestamp,
    message,
  }));

/**
 * The one call a summary is: pi's helpers take the model registry a node
 * harness holds, and this loop has a stream function per model instead.
 *
 * `completeSimple` is the whole of what they ask of it, the same way
 * `streamFor()` is the whole of an api module here. The summary is not the
 * conversation, so it carries its own request options — pi sets a session id of
 * its own and turns cache writes off, and they are passed on untouched.
 */
const summarizer = (streamFn: StreamFn, apiKey?: string): Models => {
  const completeSimple: Models["completeSimple"] = async (model, context, options) => {
    const stream = await streamFn(model, context, { ...options, apiKey });
    return stream.result();
  };
  return { completeSimple } as unknown as Models;
};

export interface CompactionRequest {
  /** The transcript to compact, as pi holds it. */
  messages: AgentMessage[];
  /** The model that writes the summary — the one the conversation runs on. */
  model: AnyModel;
  apiKey?: string;
  /**
   * How hard the model thinks before it writes the summary. `off`, and not the
   * level the conversation runs at: a summary is a rewrite of what is already
   * there, and on a provider that budgets thinking out of the same allowance
   * the summary is written from, a high level is a summary cut off halfway.
   */
  thinkingLevel?: ThinkingLevel;
  signal?: AbortSignal;
  /** A scripted provider under test. Default: the api the model names. */
  streamFn?: StreamFn;
}

/**
 * The transcript a compaction leaves behind: one summary of the turns that came
 * before, and the recent ones kept whole.
 *
 * It is one extra request, made outside the agent loop — the conversation never
 * carries the question, only the summary it answered with. The old messages are
 * gone from what the model reads next; what the reader sees is a checkpoint in
 * their place, drawn from the summary message itself.
 *
 * `undefined` where there is nothing to compact: a conversation short enough
 * that the recent turns are the whole of it. A failed summary throws, because a
 * person asked for this one — unlike a title, which nobody did.
 */
export async function compactMessages({
  messages,
  model,
  apiKey,
  thinkingLevel = "off",
  signal,
  streamFn = streamFor,
}: CompactionRequest): Promise<AgentMessage[] | undefined> {
  const settings = compactionSettings(model.contextWindow);
  const prepared = prepareCompaction(entriesOf(messages), settings);
  if (!prepared.ok) throw prepared.error;
  const preparation = prepared.value;
  // Nothing before the cut point: every turn is a recent one.
  if (
    !preparation ||
    preparation.messagesToSummarize.length + preparation.turnPrefixMessages.length === 0
  ) {
    return undefined;
  }

  const result = await compact(
    preparation,
    summarizer(streamFn, apiKey),
    model,
    undefined,
    signal,
    thinkingLevel,
  );
  if (!result.ok) throw result.error;

  const { summary, tokensBefore, retainedTail } = result.value;
  return [createCompactionSummaryMessage(summary, tokensBefore, Date.now()), ...retainedTail];
}
