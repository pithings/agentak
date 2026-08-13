import type { ComponentChildren } from "preact";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ChatComposer, type ChatComposerProps } from "@/components/chat/composer";
import { ChatEmpty } from "@/components/chat/empty";
import { ChatHeader } from "@/components/chat/header";
import { ChatMessage, type ChatRespond } from "@/components/chat/message";
import { ChatQueue } from "@/components/chat/queue";
import type { ChatAgent, ChatQueueItem } from "@/components/chat/types";
import type { ViewMessage } from "@/types";
import { sx, type Sx } from "@/styles/sx";

export type {
  ChatAgent,
  ChatModel,
  ChatProvider,
  ChatQueueItem,
  ChatUsage,
} from "@/components/chat/types";

const S = {
  // `minWidth` and `overflow` hold the surface to the box the host gives it —
  // as a grid or flex item it would otherwise grow to its widest content.
  chat: {
    display: "flex",
    minWidth: "0",
    minHeight: "0",
    overflow: "hidden",
    flexDirection: "column",
    background: "var(--background)",
    color: "var(--foreground)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    WebkitFontSmoothing: "antialiased",
  },
  error: {
    borderTop: "1px solid var(--border)",
    background: "var(--destructive-surface)",
    padding: "0.5rem 0.75rem",
    color: "var(--destructive)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

export interface ChatProps extends ChatComposerProps {
  messages: ViewMessage[];
  error?: string;
  onReset: () => void;
  className?: string;
  /** Merged over the chat's own box — how a host sizes the surface. */
  style?: Sx;
  /** Shown in the empty state, so the tools are visible before the first turn. */
  agent?: ChatAgent;
  /** Messages queued behind the current turn. */
  queued?: ChatQueueItem[];
  onDequeue?: (id: string) => void;
  /** Answer a tool confirmation, by tool call id. */
  onRespond?: ChatRespond;
  /**
   * Host buttons for the end of the header — minimise, switch, whatever chrome
   * the page around the chat owns. One title bar, not two.
   */
  actions?: ComponentChildren;
  /**
   * Host content for the empty state — a suggestion, a launcher. It goes under
   * the greeting, and only before the first message.
   */
  emptyActions?: ComponentChildren;
}

/**
 * Presentational chat surface. It knows nothing about any agent runtime — pass
 * it a transcript and callbacks, whatever produces them. Everything past the
 * transcript is optional, so a store that has no models, usage or queue still
 * renders the same surface.
 */
export function Chat({
  messages,
  isStreaming,
  error,
  onReset,
  className,
  style,
  agent,
  queued = [],
  onDequeue,
  onRespond,
  actions,
  emptyActions,
  ...composer
}: ChatProps) {
  const last = messages.at(-1);
  // Nothing has come back yet: the turn is still the user's, or it is empty.
  const waiting = isStreaming && (last?.role !== "assistant" || last.parts.length === 0);

  return (
    <div className={className} style={sx(S.chat, style)}>
      <ChatHeader actions={actions} onReset={onReset} />

      <Conversation pin={last?.id}>
        <ConversationContent>
          {messages.length === 0 ? (
            <ChatEmpty agent={agent}>{emptyActions}</ChatEmpty>
          ) : (
            messages.map((message) => (
              <ChatMessage
                isStreaming={isStreaming && message === last}
                key={message.id}
                message={message}
                onRespond={onRespond}
              />
            ))
          )}
          {waiting ? <Shimmer>Working…</Shimmer> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error ? <p style={S.error}>{error}</p> : null}

      <ChatQueue items={queued} onDequeue={onDequeue} />

      <ChatComposer isStreaming={isStreaming} {...composer} />
    </div>
  );
}
