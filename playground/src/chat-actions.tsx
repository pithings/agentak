import type { ComponentChildren } from "preact";

import { Button, buttonSx } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, ClockIcon, XIcon } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { u } from "@/styles/base";
import { sx, type Sx } from "@/styles/sx";
import {
  type ChatEntry,
  conversations,
  forgetConversation,
  openConversation,
  useConversations,
} from "./chat-history";

const S = {
  row: { display: "flex", alignItems: "center", gap: "0.125rem" },
  // The title takes the room and gives it back: one line, cut with an ellipsis.
  name: {
    flex: "1",
    minWidth: "0",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "left",
  },
  current: { fontWeight: "600" },
  // `width: auto` against the menu item's own `100%`: it does not shrink, so a
  // full-width X would take the row and leave the title nothing.
  drop: { width: "auto", flexShrink: "0", padding: "0.25rem" },
  icon: { width: "0.875rem", height: "0.875rem" },
  empty: { padding: "0.375rem 0.5rem", color: "var(--muted-foreground)", fontSize: "0.75rem" },
  // Wide enough for a title, and inside the rail: the chat clips the panel, and
  // the narrowest rail is 20rem. No `maxWidth` of its own — a percentage would
  // resolve against the trigger, which is one icon wide.
  panel: { width: "18rem", padding: "0.25rem" },
} satisfies Record<string, Sx>;

/** The header's own ghost button, on a trigger that cannot take `asChild`. */
function MenuTrigger({ children, label }: { children: ComponentChildren; label: string }) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>();

  return (
    <DropdownMenuTrigger
      aria-label={label}
      style={buttonSx({ focusVisible, hovered, size: "icon-sm", variant: "ghost" })}
      title={label}
      {...handlers}
    >
      {children}
    </DropdownMenuTrigger>
  );
}

function ConversationRow({ entry }: { entry: ChatEntry }) {
  const current = entry.id === conversations.currentId;

  return (
    <div style={S.row}>
      <DropdownMenuItem
        aria-current={current ? "true" : undefined}
        onClick={() => openConversation(entry.id)}
        style={sx(S.name, current && S.current)}
        title={entry.title}
      >
        {entry.title}
      </DropdownMenuItem>
      <DropdownMenuItem
        aria-label={`Forget ${entry.title}`}
        onClick={(event) => {
          // The menu stays open: forgetting one is rarely the only one.
          event.preventDefault();
          forgetConversation(entry.id);
        }}
        style={S.drop}
        title="Forget this conversation"
      >
        <XIcon style={S.icon} />
      </DropdownMenuItem>
    </div>
  );
}

/**
 * The conversations this browser has had.
 *
 * The transcripts are the page's own — `chat-history.ts` keeps them, because a
 * session holds one conversation and never a list. Picking one here only moves
 * `currentId`; the widget swaps the session on it, which is what makes the
 * chosen transcript the live one.
 */
export function ChatHistory() {
  const { items } = useConversations();

  return (
    <DropdownMenu>
      <MenuTrigger label="Conversations">
        {/* `Button` sizes an icon child for you; a hand-rolled trigger does not. */}
        <ClockIcon style={u.icon} />
      </MenuTrigger>
      <DropdownMenuContent align="end" style={S.panel}>
        <DropdownMenuLabel>Conversations</DropdownMenuLabel>
        {items.length === 0 ? (
          <div style={S.empty}>Nothing stored yet.</div>
        ) : (
          items.map((entry) => <ConversationRow entry={entry} key={entry.id} />)
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The host's own chrome for the chatbox — the stored conversations, back to the
 * live agent, and minimise.
 *
 * It goes on the agent's header, beside the key and the new conversation, so
 * the box has one title bar. The element projects it there through
 * `slot="actions"`; the demo island takes it as the `actions` prop.
 *
 * The library `Button` is what the buttons beside it use, so they match. The
 * demo keeps no transcript, so it carries no conversation list — `onLive` is
 * what tells the two apart.
 */
export function ChatActions({ onLive, onClose }: { onLive?: () => void; onClose: () => void }) {
  return (
    <>
      {!onLive && <ChatHistory />}
      {onLive && (
        <Button
          aria-label="Back to the live agent"
          onClick={onLive}
          size="icon-sm"
          title="Back to the live agent"
          variant="ghost"
        >
          <svg
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path d="m17 2 4 4-4 4" />
            <path d="M3 6h18" />
            <path d="m7 22-4-4 4-4" />
            <path d="M21 18H3" />
          </svg>
        </Button>
      )}
      <Button
        aria-label="Minimise the assistant"
        onClick={onClose}
        size="icon-sm"
        title="Minimise"
        variant="ghost"
      >
        <ChevronDownIcon />
      </Button>
    </>
  );
}

/**
 * The demo, offered from inside the live surface.
 *
 * The box opens on the real agent, so the canned turns are no longer a mode a
 * visitor lands on — they are one button under the greeting, which the element
 * projects through `slot="empty"`. It goes with the first message, so it never
 * sits over a running conversation.
 */
export function StartDemo({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Button onClick={onStart} size="sm" variant="outline">
        <svg
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          viewBox="0 0 24 24"
        >
          <path d="M6 4.5 19 12 6 19.5Z" />
        </svg>
        Play the demo
      </Button>
    </div>
  );
}
