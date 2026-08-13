import type { ComponentChildren } from "preact";

import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/lib/icons";
import type { Sx } from "@/styles/sx";

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
} satisfies Record<string, Sx>;

export interface ChatHeaderProps {
  onReset: () => void;
  /** Host buttons for the end of the bar — one title bar, not two. */
  actions?: ComponentChildren;
}

/** The chat's title bar: the new conversation button, and whatever the host adds. */
export function ChatHeader({ onReset, actions }: ChatHeaderProps) {
  return (
    <header style={S.header}>
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
