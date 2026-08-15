import type { ContextCosts } from "../ai-elements/context.tsx";
import type { LanguageModelUsage, ToolDefinition } from "../../types.ts";

/** One entry of the model picker. */
export interface ChatModel {
  id: string;
  name: string;
  contextWindow: number;
}

/** One entry of the provider list, the first level of the same picker. */
export interface ChatProvider {
  id: string;
  label: string;
  /** Takes an API key. A free provider takes none, and is picked outright. */
  keyed?: boolean;
  /** A key for it is stored already. */
  hasKey?: boolean;
  /** Where a key comes from, and the shape of one. */
  keyUrl?: string;
  keyPlaceholder?: string;
  /** The row's title — what free costs, say. */
  note?: string;
}

/**
 * How hard a model thinks before it answers. pi's own scale, written out here
 * so the surface names it without reaching for a loop.
 */
export type ChatThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/** What the context meter shows. Produced by `pi/transcript.ts`. */
export interface ChatUsage {
  usedTokens: number;
  maxTokens: number;
  usage?: LanguageModelUsage;
  modelId?: string;
  costs?: ContextCosts;
  /**
   * The conversation is close enough to the window that the next turn may not
   * fit. The meter says so; a harness decides where the line is.
   */
  nearLimit?: boolean;
}

/** The agent behind the chat, shown before the first message. */
export interface ChatAgent {
  name: string;
  model?: string;
  instructions: string;
  tools: (ToolDefinition & { name: string })[];
}

/** A message typed while the agent was working, waiting its turn. */
export interface ChatQueueItem {
  id: string;
  text: string;
}
