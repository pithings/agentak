// Docs: @docs/4.agents/2.pi/8.runtime-behavior.md
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import {
  type CompactionSettings,
  DEFAULT_COMPACTION_SETTINGS,
  estimateTokens,
  shouldCompact,
} from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent, Usage } from "@earendil-works/pi-ai";

import type { ApprovalRequest } from "../tools/approvals.ts";
import { describeFailure } from "./errors.ts";
import { splitProgress } from "../../lib/progress.ts";
import type { PageToolDetails } from "../tools.ts";
import type { AnyModel } from "../providers.ts";
import type { ContextCosts } from "../../components/ai-elements/context.tsx";
import type {
  LanguageModelUsage,
  ToolApproval,
  ViewMessage,
  ViewPart,
  ViewToolPart,
} from "../../types.ts";

/** Thinking the provider withheld. The signature travels; the text does not. */
const REDACTED = "_Thinking was redacted by the provider._";

export interface TranscriptApprovals {
  pending: ApprovalRequest[];
  answers: Record<string, ToolApproval>;
}

const NO_APPROVALS: TranscriptApprovals = { pending: [], answers: {} };

const textOf = (content: string | (TextContent | ImageContent)[]): string =>
  typeof content === "string"
    ? content
    : content
        .filter((block): block is TextContent => block.type === "text")
        .map((block) => block.text)
        .join("\n");

/** A tool may answer with an image; it renders beside the call that asked. */
const imageParts = (content: string | (TextContent | ImageContent)[]): ViewPart[] =>
  typeof content === "string"
    ? []
    : content
        .filter((block): block is ImageContent => block.type === "image")
        .map((block) => ({
          kind: "element" as const,
          name: "image",
          props: { base64: block.data, mediaType: block.mimeType, alt: "Tool output" },
        }));

/**
 * The words of one block, with any `::progress{…}` marker in them drawn as a
 * bar instead — see `lib/progress.ts`. A block without a marker, which is
 * almost every block, keeps the one part it always had.
 */
const wordParts = (kind: "text" | "thinking", text: string): ViewPart[] => {
  const segments = splitProgress(text);
  if (!segments) return text ? [{ kind, text }] : [];

  return segments.map((segment) =>
    segment.kind === "text"
      ? { kind, text: segment.text }
      : { kind: "element" as const, name: "progress", props: { ...segment.props } },
  );
};

const userParts = (content: string | (TextContent | ImageContent)[]): ViewPart[] => {
  const text = textOf(content);
  return [...(text ? [{ kind: "text" as const, text }] : []), ...imageParts(content)];
};

/**
 * `AgentMessage[]` to what the chat renders.
 *
 * Rebuilt from the whole transcript on every event rather than accumulated:
 * every pi event carries the full message, so a rebuild cannot drift, and the
 * ids stay stable because they come from the index.
 *
 * A tool result carries the id of the call it answers, so it fills in the part
 * that call already produced instead of adding one of its own.
 */
export function toViewMessages(
  messages: AgentMessage[],
  streaming?: AgentMessage,
  approvals: TranscriptApprovals = NO_APPROVALS,
): ViewMessage[] {
  const pending = new Set(approvals.pending.map((request) => request.id));
  const calls = new Map<string, { part: ViewToolPart; owner: ViewMessage }>();
  const view: ViewMessage[] = [];
  const all = streaming ? [...messages, streaming] : messages;

  all.forEach((message, index) => {
    switch (message.role) {
      case "user": {
        const parts = userParts(message.content);
        if (parts.length > 0) view.push({ id: `u${index}`, role: "user", parts });
        break;
      }

      case "assistant": {
        const parts: ViewPart[] = [];
        const owner: ViewMessage = {
          id: `a${index}`,
          role: "assistant",
          parts,
          error: describeFailure(message.errorMessage),
        };

        for (const block of message.content) {
          if (block.type === "text") {
            parts.push(...wordParts("text", block.text));
          } else if (block.type === "thinking") {
            parts.push(...wordParts("thinking", block.redacted ? REDACTED : block.thinking));
          } else {
            const part: ViewToolPart = {
              kind: "tool",
              toolCallId: block.id,
              name: block.name,
              args: block.arguments,
              status: pending.has(block.id) ? "pending" : "running",
              approval: approvals.answers[block.id],
            };
            calls.set(block.id, { owner, part });
            parts.push(part);
          }
        }

        // An aborted or failed turn can carry an error and nothing else.
        if (parts.length > 0 || owner.error) view.push(owner);
        break;
      }

      case "toolResult": {
        const call = calls.get(message.toolCallId);
        if (!call) break;
        const { owner, part } = call;
        part.status = message.isError
          ? part.approval?.approved === false
            ? "denied"
            : "error"
          : "done";
        part.output = textOf(message.content);
        // A page tool the site flagged: the model is warned in the content
        // itself, and the reader is warned here.
        const details = message.details as PageToolDetails | undefined;
        if (details?.untrusted) part.untrustedFrom = details.origin;
        owner.parts.splice(owner.parts.indexOf(part) + 1, 0, ...imageParts(message.content));
        break;
      }

      // A summary standing where turns used to be: `compact()` writes the
      // first, and a host that branches the transcript writes the second.
      case "compactionSummary":
      case "branchSummary": {
        view.push({
          id: `c${index}`,
          role: "assistant",
          parts: [
            {
              kind: "element",
              name: "checkpoint",
              props: {
                label:
                  message.role === "compactionSummary"
                    ? `Compacted · ${message.tokensBefore.toLocaleString()} tokens before`
                    : "Returned from a branch",
                tooltip: message.summary,
              },
            },
          ],
        });
        break;
      }

      // `bashExecution` and `custom` belong to hosts that add them.
      default:
        break;
    }
  });

  return view;
}

/**
 * The transcript index a view id was built from — `u12` is `messages[12]`.
 *
 * The ids above come from the index, so this is the way back for a caller
 * holding one: the fork button, which rewinds to a user message. `undefined`
 * for anything else, including an id another harness wrote.
 */
export function piMessageIndex(id: string): number | undefined {
  return /^[uac]\d+$/.test(id) ? Number(id.slice(1)) : undefined;
}

/**
 * The words of a user message, without the images beside them — what a rewind
 * sends again, and the same text the view carries for that turn.
 */
export const piUserText = (message: AgentMessage): string =>
  message.role === "user" ? textOf(message.content) : "";

/** What the context meter reads. */
export interface ContextUsageView {
  usedTokens: number;
  maxTokens: number;
  usage: LanguageModelUsage;
  modelId: string;
  costs: ContextCosts;
  /**
   * The window is nearly spent. pi's own threshold — what it would compact at,
   * which is the window less the room a summary needs.
   */
  nearLimit: boolean;
  /**
   * A compaction is running: the summary that replaces the turns so far is
   * being written. Nothing else may be asked of the loop while it is.
   */
  compacting?: boolean;
  /**
   * There are turns behind what a compaction would keep, so one would leave a
   * shorter conversation than it read.
   *
   * False is a conversation whose every turn is a recent one — a compaction
   * would summarize nothing and change nothing. The button reads this rather
   * than running a request to find out, because the answer is arithmetic.
   */
  canCompact: boolean;
}

const EMPTY_COSTS = { input: 0, output: 0, cache: 0, total: 0 };

/**
 * What a compaction keeps and what it leaves room for, for a window this size.
 *
 * pi's own numbers are written for a coding harness on a large model: 16k held
 * back for the summary, 20k of recent turns kept. A browser runs on whatever the
 * visitor picked, and Gemini Nano's whole window is 9k — the plain reserve sits
 * below zero there, so every turn reads as near the limit, and the recent turns
 * alone would fill the window again. Both are capped against the window: half of
 * it for the summary, a quarter of it kept.
 *
 * It lives here rather than in `compaction.ts` because the meter warns on the
 * same numbers, and warning is what a chat does long before it compacts.
 */
export const compactionSettings = (contextWindow: number): CompactionSettings => ({
  ...DEFAULT_COMPACTION_SETTINGS,
  keepRecentTokens: Math.min(
    DEFAULT_COMPACTION_SETTINGS.keepRecentTokens,
    Math.floor(contextWindow / 4),
  ),
  reserveTokens: Math.min(DEFAULT_COMPACTION_SETTINGS.reserveTokens, Math.floor(contextWindow / 2)),
});

/** The last compaction in a transcript, and where it sits. */
const lastCompaction = (messages: AgentMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === "compactionSummary") return { at: index, message };
  }
  return undefined;
};

/**
 * The last turn this window was answered by, if there is one.
 *
 * A compaction keeps the recent turns, and those carry the usage of the
 * requests they were part of — requests over a context that no longer exists.
 * So a turn counts as this window's own only where it was written after the
 * summary was: everything kept predates it, and the next answer is the first
 * number a provider gives about the context that is now being sent.
 */
const answeredTurn = (messages: AgentMessage[]) => {
  const compaction = lastCompaction(messages);
  for (let index = messages.length - 1; index > (compaction?.at ?? -1); index--) {
    const message = messages[index];
    if (message.role !== "assistant" || !message.usage) continue;
    if (compaction && message.timestamp <= compaction.message.timestamp) continue;
    return message;
  }
  return undefined;
};

/**
 * Whether this window has been answered — a turn since the last compaction.
 *
 * What an automatic compaction waits for: one summary per answer, so a
 * compaction that freed less than it hoped is not written a second time over
 * the same conversation, and a turn that failed on the way back is not answered
 * by summarizing it again.
 */
export const answeredSinceCompaction = (messages: AgentMessage[]): boolean =>
  answeredTurn(messages) !== undefined;

/** pi reports cache writes as their own bucket; the panel has one cache row. */
const contextTokens = (usage: Usage) => usage.input + usage.cacheRead + usage.cacheWrite;

/**
 * The window from the last assistant turn, and the cost of every turn so far.
 *
 * The meter shows what the next request will carry — the context does not grow
 * by the sum of the turns, each one already includes the ones before it. The
 * costs do add up, so they are summed.
 *
 * pi prices reasoning tokens as output, so the reasoning row carries no cost of
 * its own; its tokens are already inside `outputTokens`.
 *
 * A compaction leaves a window no provider has counted yet: the turns it kept
 * carry the numbers of the context they were part of, and that context is gone.
 * The meter estimates it until the next answer arrives with a real one, so a
 * compaction shows as the drop it is rather than as nothing at all.
 */
export function toContextUsage(
  messages: AgentMessage[],
  model: AnyModel,
): ContextUsageView | undefined {
  const turns = messages.filter((message) => message.role === "assistant" && message.usage);
  if (turns.length === 0) return undefined;
  const answered = answeredTurn(messages);

  const totals = turns.reduce(
    (sum, message) => {
      if (message.role !== "assistant") return sum;
      const { usage } = message;
      return {
        input: sum.input + usage.input,
        output: sum.output + usage.output,
        cacheRead: sum.cacheRead + usage.cacheRead,
        cacheWrite: sum.cacheWrite + usage.cacheWrite,
        reasoning: sum.reasoning + (usage.reasoning ?? 0),
        cost: {
          input: sum.cost.input + usage.cost.input,
          output: sum.cost.output + usage.cost.output,
          cache: sum.cost.cache + usage.cost.cacheRead + usage.cost.cacheWrite,
          total: sum.cost.total + usage.cost.total,
        },
      };
    },
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, cost: EMPTY_COSTS },
  );

  const compaction = lastCompaction(messages);
  const usedTokens = answered
    ? contextTokens(answered.usage) + answered.usage.output
    : // Just compacted: the summary and what it kept, by pi's own character
      // estimate. Nothing has been sent since, so there is no better number.
      messages
        .slice(compaction?.at ?? 0)
        .reduce((sum, message) => sum + estimateTokens(message), 0);
  const settings = compactionSettings(model.contextWindow);

  return {
    usedTokens,
    // Against what a compaction keeps, not against the window: the cut leaves
    // the recent turns whole, so a conversation smaller than that budget is one
    // where every turn is recent and there is nothing behind the cut to
    // summarize. See `compaction.ts`.
    canCompact: usedTokens > settings.keepRecentTokens,
    maxTokens: model.contextWindow,
    modelId: model.id,
    // The same call a compaction is decided on, and the same settings, so the
    // warning stands exactly where `compact()` would run — see `compaction.ts`.
    nearLimit: shouldCompact(usedTokens, model.contextWindow, settings),
    usage: {
      inputTokens: totals.input,
      outputTokens: totals.output,
      cachedInputTokens: totals.cacheRead + totals.cacheWrite,
      reasoningTokens: totals.reasoning,
      totalTokens: totals.input + totals.output + totals.cacheRead + totals.cacheWrite,
    },
    costs: totals.cost,
  };
}
