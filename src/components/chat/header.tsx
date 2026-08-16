import type { ComponentChildren } from "preact";

import { Button } from "../ui/button.tsx";
import { ArrowLeftIcon, ClockIcon, PlusIcon, SlidersIcon } from "../../lib/icons.tsx";
import { reset } from "../../styles/base.ts";
import { sx, type Sx } from "../../styles/sx.ts";

const S = {
  header: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: "0",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "0.125rem",
    borderBottom: "1px solid var(--border)",
    padding: "0.375rem 0.5rem",
  },
  // Takes the room the buttons leave, and gives it back rather than pushing
  // them off: one line, cut with an ellipsis.
  title: {
    flex: "1",
    minWidth: "0",
    overflow: "hidden",
    padding: "0 0.25rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
    fontWeight: "500",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // The title is what holds the two ends of the bar apart, so a conversation
  // with no name yet needs the room it would have taken — without it the row
  // packs to the right and the leading button travels with it.
  gap: { flex: "1" },
} satisfies Record<string, Sx>;

export interface ChatHeaderProps {
  onReset: () => void;
  /** What this conversation is about. Nothing shows before the first message. */
  title?: string;
  /** Host buttons for the end of the bar — one title bar, not two. */
  actions?: ComponentChildren;
  /**
   * The way out of the settings page. With it the bar leads with a back arrow
   * and drops the new-conversation button — the page is not a conversation, and
   * one title bar serves both.
   */
  onBack?: () => void;
  /**
   * The way in. Absent where there is nothing to choose — a session with one
   * fixed model — and while the page is already up, where `onBack` is the pair
   * of this.
   */
  onSettings?: () => void;
  /**
   * The way to the stored conversations. It leads the bar, because the list is
   * where a conversation comes from and the settings are where it is set up.
   * Absent where a harness stores none, and while a page is up.
   */
  onHistory?: () => void;
}

/** The chat's title bar: the title, the chat's own buttons, and the host's. */
export function ChatHeader({
  onReset,
  title,
  actions,
  onBack,
  onSettings,
  onHistory,
}: ChatHeaderProps) {
  return (
    <header style={S.header}>
      {onBack ? (
        <Button aria-label="Back" onClick={onBack} size="icon-sm" title="Back" variant="ghost">
          <ArrowLeftIcon />
        </Button>
      ) : onHistory ? (
        <Button
          aria-label="Conversations"
          onClick={onHistory}
          size="icon-sm"
          title="Conversations"
          variant="ghost"
        >
          <ClockIcon />
        </Button>
      ) : null}

      {title ? (
        // The full text is the tooltip, because the bar is narrow and cuts it.
        <h2 style={sx(reset.text, S.title)} title={title}>
          {title}
        </h2>
      ) : (
        <div style={S.gap} />
      )}

      {onBack ? null : (
        <Button
          aria-label="New conversation"
          onClick={onReset}
          size="icon-sm"
          title="New conversation"
          variant="ghost"
        >
          <PlusIcon />
        </Button>
      )}

      {/* After the chat's own buttons and before the host's: the page belongs to
          the chat, and whatever chrome the host owns stays at the end. */}
      {onSettings ? (
        <Button
          aria-label="Settings"
          onClick={onSettings}
          size="icon-sm"
          title="Settings"
          variant="ghost"
        >
          <SlidersIcon />
        </Button>
      ) : null}

      {actions}
    </header>
  );
}
