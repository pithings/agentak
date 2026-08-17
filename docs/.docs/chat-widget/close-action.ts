import { computed, type ShallowRef } from "vue";
import type { ChatUi } from "./use-chat-agent.ts";

/**
 * The close button, on the chat's own header.
 *
 * The surface heads itself, so the site adds no second title bar: `actions`
 * goes at the end of that header, after the chat's own buttons. It is a preact
 * child, whatever renders the page around it — `Button` is the one the buttons
 * beside it use, so they match.
 *
 * A cross, not a chevron: the button sits where a panel's close sits, and it
 * reads the same in the rail and in the sheet. The chat is hidden and not
 * unmounted, so the transcript is there again on the way back.
 */
export function closeAction(ui: ShallowRef<ChatUi | undefined>, shell: { close: () => void }) {
  return computed(() => {
    if (!ui.value) return undefined;
    const { Button, h } = ui.value;
    return h(
      Button as never,
      {
        "aria-label": "Close the assistant",
        onClick: shell.close,
        size: "icon-sm",
        title: "Close",
        variant: "ghost",
      },
      h(
        "svg",
        {
          fill: "none",
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": "2",
          viewBox: "0 0 24 24",
        },
        h("path", { d: "M18 6 6 18M6 6l12 12" }),
      ),
    );
  });
}
