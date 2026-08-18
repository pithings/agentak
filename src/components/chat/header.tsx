// Docs: @docs/3.widget.md
import { ChatActions } from "./actions.tsx";
import type { ChatAction } from "./types.ts";
import { Button } from "../ui/button.tsx";
import { ArrowLeftIcon, ClockIcon, PlusIcon } from "../../lib/icons.tsx";
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
    // The name is written by whoever sent the first message, so it arrives in
    // whatever case they typed. The bar heads it the way a heading is headed —
    // the drawing only, so what is stored and what the tooltip says are the
    // words themselves. `capitalize` heads each word and lowers none, so a name
    // that already carries "API" keeps it.
    textTransform: "capitalize",
    // A label of the bar rather than part of the conversation: a drag across it
    // is a drag on chrome, and it must not carry a cut-off title away.
    userSelect: "none",
  },
  // A conversation with no name yet takes the room the title would have taken,
  // so a leading back arrow stays at the leading edge and the buttons at the
  // other one — the row is the same row, named or not.
  gap: { flex: "1" },
} satisfies Record<string, Sx>;

export interface ChatHeaderProps {
  onReset: () => void;
  /** What this conversation is about. Nothing shows before the first message. */
  title?: string;
  /**
   * The way out of a page. With it the bar leads with a back arrow and drops
   * the buttons the page replaces — the page is not a conversation, and one
   * title bar serves both.
   */
  onBack?: () => void;
  /**
   * The way to the stored conversations. Absent where a harness stores none,
   * and while a page is up.
   */
  onHistory?: () => void;
  /**
   * Host buttons for the trailing end of the bar — collapse, minimise, whatever
   * chrome the page around the chat owns. They come after the chat's own two,
   * and they stay there on every page: what a page replaces are the controls of
   * the conversation, and these are not the chat's to drop.
   *
   * Definitions and not nodes: the host says what each button is and does, and
   * the header draws it as it draws its own — see `ChatAction`.
   */
  actions?: ChatAction[];
}

/**
 * The chat's title bar: what the surface is about, and the two buttons that
 * change which conversation it is about.
 *
 * What is *running* — the model, the context it has spent — reads under the
 * composer instead; see `bar.tsx`. What is left here is the conversation
 * itself: the name leads, and starting a new one and opening a stored one
 * follow it, in the order they are reached for. The back arrow is the one thing
 * before the name, because on a page it is not a control of the chat but the
 * way out of the page the name states.
 *
 * The host's own chrome ends the row, past the corner the chat's buttons stop
 * at: a collapse or a minimise is about the surface and not about the
 * conversation, so it is read where a window's own controls are read.
 */
export function ChatHeader({ actions, onReset, title, onBack, onHistory }: ChatHeaderProps) {
  return (
    <header style={S.header}>
      {onBack ? (
        <Button aria-label="Back" onClick={onBack} size="icon-sm" title="Back" variant="ghost">
          <ArrowLeftIcon />
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

      {onHistory ? (
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

      {/* Last, at the corner: the page's own chrome is outside the
          conversation, so it sits outside the buttons that change which
          conversation this is. */}
      <ChatActions actions={actions} />
    </header>
  );
}
