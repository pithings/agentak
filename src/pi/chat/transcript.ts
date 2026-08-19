// Docs: @docs/4.agents/2.pi/8.runtime-behavior.md
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { DEFAULT_COMPACTION_SETTINGS, shouldCompact } from "@earendil-works/pi-agent-core";
import type { ImageContent, TextContent, Usage } from "@earendil-works/pi-ai";

import type { ApprovalRequest } from "../tools/approvals.ts";
import { describeFailure } from "./errors.ts";
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
            if (block.text) parts.push({ kind: "text", text: block.text });
          } else if (block.type === "thinking") {
            parts.push({ kind: "thinking", text: block.redacted ? REDACTED : block.thinking });
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

      // Written by a host that compacts or branches the transcript. The loop
      // here does neither yet, so these arrive only from outside.
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
}

const EMPTY_COSTS = { input: 0, output: 0, cache: 0, total: 0 };

/**
 * pi keeps a fixed 16k for a summary — more than a small window holds. Gemini
 * Nano has 9k, so the plain threshold sits below zero and every turn reads as
 * near the limit. The reserve is capped at half the window instead.
 */
const compactionSettings = (contextWindow: number) => ({
  ...DEFAULT_COMPACTION_SETTINGS,
  reserveTokens: Math.min(DEFAULT_COMPACTION_SETTINGS.reserveTokens, Math.floor(contextWindow / 2)),
});

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
 */
export function toContextUsage(
  messages: AgentMessage[],
  model: AnyModel,
): ContextUsageView | undefined {
  const turns = messages.filter((message) => message.role === "assistant" && message.usage);
  const last = turns.at(-1);
  if (!last || last.role !== "assistant") return undefined;

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

  const usedTokens = contextTokens(last.usage) + last.usage.output;

  return {
    usedTokens,
    maxTokens: model.contextWindow,
    modelId: model.id,
    // The same call the harness compacts on, so the warning stands exactly
    // where a compaction would run — see `.agents/session.md`.
    nearLimit: shouldCompact(
      usedTokens,
      model.contextWindow,
      compactionSettings(model.contextWindow),
    ),
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
