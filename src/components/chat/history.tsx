import type { ChatHistoryEntry } from "./types.ts";
import { Button } from "../ui/button.tsx";
import { XIcon } from "../../lib/icons.tsx";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset } from "../../styles/base.ts";
import { sx, type Sx } from "../../styles/sx.ts";

const S = {
  // The settings page's own box: a column of sections, shown where the
  // transcript was, scrolling as one.
  page: {
    boxSizing: "border-box",
    display: "flex",
    flex: "1",
    minHeight: "0",
    flexDirection: "column",
    gap: "0.75rem",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "1rem",
  },
  note: {
    margin: "0",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // One frame around the rows, and the rows carry the seams between them.
  list: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    background: "var(--surface)",
  },
  // The row is two controls, so it is a box around them rather than a button:
  // opening a conversation and forgetting it are not the same click.
  row: {
    display: "flex",
    minWidth: "0",
    alignItems: "center",
    paddingRight: "0.25rem",
  },
  rowLine: { borderTop: "1px solid var(--border)" },
  // Takes the room the forget button leaves. `minHeight` rather than `height`:
  // a long title still ends on one line, but the row grows with the font.
  open: {
    boxSizing: "border-box",
    display: "flex",
    flex: "1",
    minWidth: "0",
    minHeight: "2.5rem",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0.625rem",
    outline: "none",
    textAlign: "left",
    fontSize: "0.8125rem",
    transition: "background-color var(--transition), color var(--transition)",
  },
  openHover: { background: "var(--hover)", color: "var(--hover-foreground)" },
  // Inset, because the row is flush with the frame — an outset ring would be
  // clipped by the list's own `overflow: hidden`.
  openFocus: { outline: "2px solid var(--ring)", outlineOffset: "-2px" },
  // The one that is live reads as live. Weight alone: a colour would make the
  // list look like a set of choices, and only one of them is open.
  openCurrent: { fontWeight: "600" },
  name: {
    flex: "0 1 auto",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Keeps the far side to itself, whatever the title does.
  meta: {
    marginLeft: "auto",
    flexShrink: "0",
    paddingLeft: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.6875rem",
  },
  forget: { flexShrink: "0", color: "var(--muted-foreground)" },
} satisfies Record<string, Sx>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Older than a week is a date; anything newer is how long ago it was said. */
const calendar = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

function when(updated?: number): string | undefined {
  if (!updated) return undefined;
  const since = Date.now() - updated;
  if (since < MINUTE) return "now";
  if (since < HOUR) return `${Math.round(since / MINUTE)}m`;
  if (since < DAY) return `${Math.round(since / HOUR)}h`;
  if (since < 7 * DAY) return `${Math.round(since / DAY)}d`;
  return calendar.format(updated);
}

export interface ChatHistoryProps {
  /**
   * The conversations kept, newest first. Without it the chat lists none and
   * shows no way in — a harness that stores nothing grows no history button.
   */
  history?: ChatHistoryEntry[];
  /** Which one is live, so the list says where you are. */
  conversationId?: string;
  /**
   * Open one in place. The harness replaces its own transcript with it, so the
   * chat stays mounted and nothing is swapped around it.
   */
  onOpenConversation?: (id: string) => void;
  /** Drop one for good. Without it a row carries no forget button. */
  onForgetConversation?: (id: string) => void;
  /**
   * The page, controlled — the same pair as `pickerOpen`. `Chat` holds the flag
   * and shows the page in place of the transcript; a harness that answers
   * `setHistoryOpen` owns it instead.
   */
  historyOpen?: boolean;
  onHistoryOpenChange?: (open: boolean) => void;
}

export type ChatHistoryPageProps = ChatHistoryProps & {
  /** Merged over the page's own box — `Chat` clears the floating composer with it. */
  style?: Sx;
};

/**
 * The conversations this browser has had, as a page rather than a menu.
 *
 * It stands where the transcript is, exactly as the settings page does — see
 * `chat.tsx` — because the list is read, and a dropdown the height of a phone
 * keyboard is not where a page of titles belongs. Picking one is the last thing
 * this page is for, so it closes again on the click.
 */
export function ChatHistory({
  history,
  conversationId,
  onOpenConversation,
  onForgetConversation,
  style,
}: ChatHistoryPageProps) {
  return (
    <div data-slot="chat-history" style={sx(S.page, style)}>
      {!history || history.length === 0 ? (
        <p style={S.note}>Nothing stored yet. A conversation is kept once it is spoken to.</p>
      ) : (
        <div aria-label="Conversations" role="group" style={S.list}>
          {history.map((entry, index) => (
            <HistoryRow
              current={entry.id === conversationId}
              entry={entry}
              first={index === 0}
              key={entry.id}
              onForget={onForgetConversation && (() => onForgetConversation(entry.id))}
              onOpen={() => onOpenConversation?.(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface HistoryRowProps {
  entry: ChatHistoryEntry;
  /** The conversation the chat is on. */
  current?: boolean;
  /** The first row carries no seam — the list's own frame is the line above it. */
  first?: boolean;
  onOpen: () => void;
  onForget?: () => void;
}

/** One conversation. A hook cannot run inside `.map()`, so a row is a component. */
function HistoryRow({ entry, current, first, onOpen, onForget }: HistoryRowProps) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>();
  const ago = when(entry.updated);

  return (
    <div style={sx(S.row, !first && S.rowLine)}>
      <button
        aria-current={current ? "true" : undefined}
        onClick={onOpen}
        style={sx(
          reset.button,
          S.open,
          hovered && S.openHover,
          focusVisible && S.openFocus,
          current && S.openCurrent,
        )}
        // The full text is the tooltip, because the row is narrow and cuts it.
        title={entry.title}
        type="button"
        {...handlers}
      >
        <span style={S.name}>{entry.title}</span>
        {ago ? <span style={S.meta}>{ago}</span> : null}
      </button>

      {onForget ? (
        <Button
          aria-label={`Forget ${entry.title}`}
          onClick={onForget}
          size="icon-sm"
          style={S.forget}
          title="Forget this conversation"
          variant="ghost"
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
