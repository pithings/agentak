// Docs: @docs/3.widget.md
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
  /**
   * The stored key is behind the device lock and cannot be read yet. It is a
   * key the provider has, so `hasKey` is true with it — what changes is what
   * the page offers to do about it: unlock, rather than change or remove.
   */
  locked?: boolean;
  /**
   * There is a stored key and nothing will ever open it — the device lock it
   * was sealed under is gone. It is not a key, so `hasKey` is false with it and
   * the page asks for one; this only says why the old one is not being offered.
   */
  keyLost?: boolean;
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

/**
 * What stands in front of a tool call, as the bar reads it.
 *
 * `ask` is the harness's own gate, whatever it asks — every call, or the first
 * of each tool. `bypass` is that gate off: the model's calls run as they come.
 * Two words rather than the harness's three, because this is a switch and not a
 * scale, and the one thing a person decides here is whether they are asked.
 */
export type ChatToolPolicy = "ask" | "bypass";

/** What the context meter shows. Produced by `pi/chat/transcript.ts`. */
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

/**
 * A message the empty state offers, so a chat that has never been used has
 * something to say in it.
 *
 * A string is the whole of one: the words on the button are the words sent. The
 * object form is for a starter whose button is the short of what it sends — a
 * row of buttons is read at a glance, and what the model is asked is a sentence.
 */
export type ChatPrompt = string | { label: string; prompt?: string };

/** A message typed while the agent was working, waiting its turn. */
export interface ChatQueueItem {
  id: string;
  text: string;
}

/**
 * The lock over the stored keys, where the harness offers one.
 *
 * `off` is a key the browser keeps for itself; `locked` and `open` are the same
 * key held by the device's own authenticator — a fingerprint, a face, a PIN —
 * asked for once per visit. Absent, the settings page shows no such section:
 * a harness that stores nothing has nothing to lock.
 */
export interface ChatKeyLock {
  state: "off" | "locked" | "open";
  /** The dialog is up, or the browser is still being asked. */
  busy?: boolean;
  /** What the last attempt failed with, in words for the person reading it. */
  error?: string;
}

/** One stored conversation, as the history page lists it. */
export interface ChatHistoryEntry {
  id: string;
  /** What the list calls it — the model's title, or the first message. */
  title: string;
  /** When it was last written, in ms. The newest heads the list. */
  updated?: number;
}
