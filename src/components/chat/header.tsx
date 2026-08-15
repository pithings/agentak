import type { ComponentChildren } from "preact";

import { Button } from "../ui/button.tsx";
import { PlusIcon } from "../../lib/icons.tsx";
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
} satisfies Record<string, Sx>;

export interface ChatHeaderProps {
  onReset: () => void;
  /** What this conversation is about. Nothing shows before the first message. */
  title?: string;
  /** Host buttons for the end of the bar — one title bar, not two. */
  actions?: ComponentChildren;
}

/** The chat's title bar: the title, the new conversation button, and the host's. */
export function ChatHeader({ onReset, title, actions }: ChatHeaderProps) {
  return (
    <header style={S.header}>
      {title ? (
        // The full text is the tooltip, because the bar is narrow and cuts it.
        <h2 style={sx(reset.text, S.title)} title={title}>
          {title}
        </h2>
      ) : null}

      <Button
        aria-label="New conversation"
        onClick={onReset}
        size="icon-sm"
        title="New conversation"
        variant="ghost"
      >
        <PlusIcon />
      </Button>

      {actions}
    </header>
  );
}
