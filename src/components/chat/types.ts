// Docs: @docs/3.widget.md
import type { ContextCosts } from "../ai-elements/context.tsx";
import type { ChatIconName } from "../../lib/icons.tsx";
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
  /**
   * A compaction is running: the harness is writing the summary that replaces
   * the turns so far. The meter's own button waits while it does.
   */
  compacting?: boolean;
  /**
   * A compaction would shorten this conversation. `false` says every turn is
   * one a compaction would keep, so the button says so and waits rather than
   * running a request that changes nothing. Absent, the button is offered.
   */
  canCompact?: boolean;
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

/**
 * The picture on a host's own button: the name of one this library ships, or
 * the path data of one it does not.
 *
 * `CHAT_ICONS` in `lib/icons.tsx` is the list of names. The path form is the
 * `d` of each `<path>` of a 24x24 lucide-style glyph, drawn in the same frame
 * as the built-in ones — geometry, never markup.
 */
export type ChatIcon = ChatIconName | { paths: string[] };

/**
 * One control a host adds to the surface, as data.
 *
 * The surface is preact and a host is often not, so a host describes its button
 * rather than building one: the same object works from vue, react, plain
 * javascript and preact alike, and no host ever holds a node this library has
 * to render. The chat draws it in its own chrome, so a host's button matches
 * the buttons beside it.
 */
export interface ChatAction {
  /** Distinguishes one action from the next. Not shown. */
  id: string;
  /** The name the button answers to, and its tooltip. Always required. */
  label: string;
  /** What a click does. */
  onClick: () => void;
  /** The picture on it. Without one the button carries its words instead. */
  icon?: ChatIcon;
  /** Words on the button. With an icon, the icon leads and these follow. */
  text?: string;
  variant?: "ghost" | "outline" | "secondary" | "default" | "destructive";
  disabled?: boolean;
  /** A switch rather than a button: the state is `aria-pressed`. */
  pressed?: boolean;
}

/**
 * One thing a host puts in the empty state, under the greeting, as data.
 *
 * `text` is a line of prose, `actions` a row of the same buttons the bar takes,
 * and `element` a renderer registered by name through `registerElements()` from
 * `agentak/components` — the one door left for a host that renders its own
 * content, and the same registry a transcript `{ kind: "element" }` part goes
 * through.
 */
export type ChatEmptyItem =
  | { kind: "text"; text: string }
  | { kind: "actions"; actions: ChatAction[] }
  | { kind: "element"; name: string; props?: Record<string, unknown> };

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
