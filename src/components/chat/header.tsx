import type { ComponentChildren } from "preact";

import { Context } from "@/components/ai-elements/context";
import type { ChatUsage } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "@/lib/icons";
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
  /** The context meter. Omitted, the bar carries none. */
  usage?: ChatUsage;
  onReset: () => void;
  /** Host buttons for the end of the bar — one title bar, not two. */
  actions?: ComponentChildren;
}

/** The chat's title bar: the meter, the reset, and whatever the host adds. */
export function ChatHeader({ usage, onReset, actions }: ChatHeaderProps) {
  return (
    <header style={S.header}>
      {usage && (
        <Context
          costs={usage.costs}
          maxTokens={usage.maxTokens}
          modelId={usage.modelId}
          usage={usage.usage}
          usedTokens={usage.usedTokens}
        />
      )}

      <Button
        aria-label="New conversation"
        onClick={onReset}
        size="icon-sm"
        title="New conversation"
        variant="ghost"
      >
        <RotateCcwIcon />
      </Button>

      {actions}
    </header>
  );
}
