import { Button } from "@/components/ui/button.tsx";
import { PanelRightCloseIcon } from "@/lib/icons.tsx";

/**
 * The host's own chrome for the chatbox — back to the live agent, and close.
 *
 * It goes at the end of the agent's status bar, under the composer, so the box
 * has one row of chrome. The element projects it there through
 * `slot="actions"`; the demo island takes it as the `actions` prop.
 *
 * The conversation list is not here any more: the session keeps its own and the
 * chat lists them from its title bar — `history: true` in `chat-widget.vue` is
 * the whole of what this page writes for it.
 *
 * The library `Button` is what the buttons beside it use, so they match.
 */
export function ChatActions({ onLive, onClose }: { onLive?: () => void; onClose: () => void }) {
  return (
    <>
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
      {/* A panel folding into its edge, not a cross: nothing is closed here and
          nothing is lost — the box goes away and keeps its transcript, and the
          launcher brings the same conversation back. */}
      <Button
        aria-label="Collapse the assistant"
        onClick={onClose}
        size="icon-sm"
        title="Collapse"
        variant="ghost"
      >
        <PanelRightCloseIcon />
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
