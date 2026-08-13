import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

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
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { u } from "@/styles/base";
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
  // `u.noZoomSurface` takes the zoom gestures off it — a chat is chrome, not a
  // document, so a stray pinch on a phone only leaves it scaled and scrolled.
  // `overscrollBehavior` ends the scroll chain here: `overflow: hidden` makes
  // this a scroll container, so a drag that starts on the header, the composer
  // or any inner scroller at its end stops at the surface and never reaches the
  // page behind it.
  chat: {
    ...u.noZoomSurface,
    position: "relative", // The foot is absolute over the transcript.
    display: "flex",
    minWidth: "0",
    minHeight: "0",
    overflow: "hidden",
    overscrollBehavior: "contain",
    flexDirection: "column",
    background: "var(--background)",
    color: "var(--foreground)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    WebkitFontSmoothing: "antialiased",
  },
  // Error, queue and composer, over the foot of the transcript rather than
  // under it. Opaque, because the transcript scrolls beneath — and lifted off
  // the bottom edge by whatever a virtual keyboard covers, so the keyboard
  // takes only this row up the screen and leaves the header and the transcript
  // where they were.
  foot: {
    position: "absolute",
    right: "0",
    bottom: "0",
    left: "0",
    background: "var(--background)",
  },
  // The keyboard is where the home bar was: the safe area is already clear.
  footLifted: {
    "--chat-safe-bottom": "0px",
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
  /** What this conversation is about, shown in the header. `toTitle` derives one. */
  title?: string;
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
  title,
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

  const inset = useKeyboardInset();
  const [foot, footRef] = useFootHeight();
  // What the floating foot hides: its own height, plus the gap a keyboard opens
  // under it. The transcript ends above both, and so does the scroll button.
  const clear = `${foot + inset}px`;

  return (
    <div className={className} style={sx(S.chat, style)}>
      <ChatHeader actions={actions} onReset={onReset} title={title} />

      <Conversation pin={last?.id}>
        <ConversationContent style={{ paddingBottom: `calc(1rem + ${clear})` }}>
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
        <ConversationScrollButton style={{ bottom: `calc(1rem + ${clear})` }} />
      </Conversation>

      <div ref={footRef} style={sx(S.foot, inset > 0 && S.footLifted, { bottom: `${inset}px` })}>
        {error ? <p style={S.error}>{error}</p> : null}

        <ChatQueue items={queued} onDequeue={onDequeue} />

        <ChatComposer isStreaming={isStreaming} {...composer} />
      </div>
    </div>
  );
}

/** The floating foot's height, so the transcript can end above it. */
function useFootHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [height, ref] as const;
}
