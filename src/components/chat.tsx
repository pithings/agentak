import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./ai-elements/conversation.tsx";
import { Shimmer } from "./ai-elements/shimmer.tsx";
import { ChatComposer, type ChatComposerProps } from "./chat/composer.tsx";
import { ChatEmpty } from "./chat/empty.tsx";
import { ChatHeader } from "./chat/header.tsx";
import { ChatHistory, type ChatHistoryProps } from "./chat/history.tsx";
import { ChatMessage, type ChatRespond } from "./chat/message.tsx";
import { ChatQueue } from "./chat/queue.tsx";
import { ChatSettings } from "./chat/settings.tsx";
import type { ChatAgent, ChatQueueItem } from "./chat/types.ts";
import { Button } from "./ui/button.tsx";
import type { ViewMessage } from "../types.ts";
import { RotateCcwIcon, XIcon } from "../lib/icons.tsx";
import { useControllableState } from "../lib/use-controllable-state.ts";
import { useKeyboardInset } from "../lib/use-keyboard-inset.ts";
import { reset, u } from "../styles/base.ts";
import { sx, type Sx } from "../styles/sx.ts";

export type {
  ChatAgent,
  ChatHistoryEntry,
  ChatModel,
  ChatProvider,
  ChatQueueItem,
  ChatThinkingLevel,
  ChatUsage,
} from "./chat/types.ts";

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
    display: "flex",
    alignItems: "flex-start",
    gap: "0.25rem",
    borderTop: "1px solid var(--border)",
    background: "var(--destructive-surface)",
    padding: "0.5rem 0.75rem",
    color: "var(--destructive)",
    fontSize: "0.75rem",
  },
  // Takes the room the dismiss button leaves, and wraps rather than pushing it.
  errorText: {
    flex: "1",
    minWidth: "0",
  },
  // Short, so the message keeps the row. The border follows the row's colour
  // rather than the neutral one an outline button carries.
  errorRetry: {
    height: "1.75rem",
    flexShrink: "0",
    borderColor: "color-mix(in oklab, var(--destructive) 30%, transparent)",
    color: "inherit",
    fontSize: "0.75rem",
  },
  // The row paints the colour; the ghost button inherits it rather than the
  // foreground it would pick for itself.
  errorDismiss: {
    marginTop: "-0.125rem",
    marginRight: "-0.375rem",
    color: "inherit",
  },
} satisfies Record<string, Sx>;

// Said while the turn is still the user's and nothing has come back. One per
// turn, so the same word does not sit there through a whole conversation.
const working = [
  "Working…",
  "Thinking…",
  "Reading…",
  "Pondering…",
  "Musing…",
  "Puzzling…",
  "Mulling…",
  "Chewing…",
];

export interface ChatProps extends ChatComposerProps, ChatHistoryProps {
  messages: ViewMessage[];
  error?: string;
  /** Clear the error and keep the transcript. Without it, nothing dismisses one. */
  onDismissError?: () => void;
  /** Run the failed turn again. Shown in the error row, beside dismissing it. */
  onRetry?: () => void;
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
  onDismissError,
  onRetry,
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
  pickerOpen,
  onPickerOpenChange,
  history,
  conversationId,
  onOpenConversation,
  onForgetConversation,
  historyOpen: historyOpenProp,
  onHistoryOpenChange,
  ...composer
}: ChatProps) {
  const last = messages.at(-1);
  // Nothing has come back yet: the turn is still the user's, or it is empty.
  const waiting = isStreaming && (last?.role !== "assistant" || last.parts.length === 0);
  // The message waited on holds the word still — a re-render mid-wait keeps it.
  const workingLabel = useMemo(
    () => working[Math.floor(Math.random() * working.length)],
    [last?.id],
  );

  // The settings page takes the transcript's place, so the surface holds the
  // flag rather than the composer's trigger — the trigger only toggles it. A
  // session that owns the flag controls it from outside; see `agent-chat.tsx`.
  const [settingsOpen, setSettingsOpen] = useControllableState({
    defaultProp: false,
    onChange: onPickerOpenChange,
    prop: pickerOpen,
  });

  // The history page is the same deal, and the two share the one slot: opening
  // either puts the other away, so the transcript is never behind two pages.
  const [historyOpen, setHistoryOpen] = useControllableState({
    defaultProp: false,
    onChange: onHistoryOpenChange,
    prop: historyOpenProp,
  });

  const showSettings = (open: boolean) => {
    if (open) setHistoryOpen(false);
    setSettingsOpen(open);
  };

  const showHistory = (open: boolean) => {
    if (open) setSettingsOpen(false);
    setHistoryOpen(open);
  };

  const inset = useKeyboardInset();
  const [foot, footRef] = useFootHeight();
  // What the floating foot hides: its own height, plus the gap a keyboard opens
  // under it. The transcript ends above both, and so does the scroll button.
  const clear = `${foot + inset}px`;

  return (
    <div className={className} style={sx(S.chat, style)}>
      <ChatHeader
        actions={actions}
        onBack={
          settingsOpen || historyOpen
            ? () => {
                setSettingsOpen(false);
                setHistoryOpen(false);
              }
            : undefined
        }
        // Nothing stored is nothing to list: a harness that keeps no
        // conversations reports no `history`, and the bar grows no button.
        onHistory={history && !settingsOpen && !historyOpen ? () => showHistory(true) : undefined}
        onReset={onReset}
        // Nothing to choose is nothing to open — the same test the composer puts
        // its own trigger behind.
        onSettings={
          !settingsOpen && (composer.providers?.length || composer.models?.length)
            ? () => showSettings(true)
            : undefined
        }
        title={historyOpen ? "Conversations" : settingsOpen ? "Settings" : title}
      />

      {historyOpen ? (
        <ChatHistory
          conversationId={conversationId}
          history={history}
          onForgetConversation={onForgetConversation}
          // Opening one is what the page is for, so it is done: the chosen
          // transcript comes back in the session's own state, under this page.
          onOpenConversation={(id) => {
            onOpenConversation?.(id);
            setHistoryOpen(false);
          }}
          style={{ paddingBottom: `calc(1rem + ${clear})` }}
        />
      ) : settingsOpen ? (
        // The page ends above the floating foot, exactly as the transcript does.
        <ChatSettings
          {...composer}
          // The model is the last of the four choices and the only one nothing
          // follows, so choosing it is done: the page steps back out of the
          // transcript's way and the composer takes the focus — see its own
          // effect on this flag.
          onModelChange={(id) => {
            composer.onModelChange?.(id);
            showSettings(false);
          }}
          style={{ paddingBottom: `calc(1rem + ${clear})` }}
        />
      ) : (
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
            {waiting ? <Shimmer>{workingLabel}</Shimmer> : null}
          </ConversationContent>
          <ConversationScrollButton style={{ bottom: `calc(1rem + ${clear})` }} />
        </Conversation>
      )}

      <div ref={footRef} style={sx(S.foot, inset > 0 && S.footLifted, { bottom: `${inset}px` })}>
        {error ? (
          <div style={S.error}>
            <p style={sx(reset.text, S.errorText)}>{error}</p>
            {onRetry ? (
              <Button onClick={onRetry} size="sm" style={S.errorRetry} variant="outline">
                <RotateCcwIcon />
                Retry
              </Button>
            ) : null}
            {onDismissError ? (
              <Button
                aria-label="Dismiss error"
                onClick={onDismissError}
                size="icon-sm"
                style={S.errorDismiss}
                title="Dismiss error"
                variant="ghost"
              >
                <XIcon />
              </Button>
            ) : null}
          </div>
        ) : null}

        <ChatQueue items={queued} onDequeue={onDequeue} />

        <ChatComposer
          isStreaming={isStreaming}
          {...composer}
          // Saying something is done choosing: the answer is in the transcript,
          // which the page is standing in front of.
          onPickerOpenChange={showSettings}
          onSend={(text) => {
            setSettingsOpen(false);
            setHistoryOpen(false);
            composer.onSend(text);
          }}
          pickerOpen={settingsOpen}
        />
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
