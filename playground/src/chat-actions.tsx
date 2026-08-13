import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "@/lib/icons";

/**
 * The host's own chrome for the chatbox — back to the live agent, and minimise.
 *
 * It goes on the agent's header, beside the key and the new conversation, so
 * the box has one title bar. The element projects it there through
 * `slot="actions"`; the demo island takes it as the `actions` prop.
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
