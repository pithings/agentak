import { computed, type ShallowRef } from "vue";
import type { ChatUi } from "./use-chat-agent.ts";

/**
 * The collapse button, on the chat's own status bar.
 *
 * The surface heads itself, so the site adds no second title bar: `actions`
 * goes at the end of the bar under the composer, after what that bar says is
 * running. It is a preact child, whatever renders the page around it — `Button`
 * is the one the buttons beside it use, so they match.
 *
 * A workspace folding into its edge, not a cross: nothing is closed here and
 * nothing is lost — the chat is hidden and not unmounted, so the transcript is
 * there again on the way back. The geometry is lucide's `panel-right-close`,
 * drawn inline because the site loads the library for `Button` and `h` alone.
 */
export function closeAction(ui: ShallowRef<ChatUi | undefined>, shell: { close: () => void }) {
  return computed(() => {
    if (!ui.value) return undefined;
    const { Button, h } = ui.value;
    return h(
      Button as never,
      {
        "aria-label": "Collapse the assistant",
        onClick: shell.close,
        size: "icon-sm",
        title: "Collapse",
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
        h("rect", { height: "18", rx: "2", width: "18", x: "3", y: "3" }),
        h("path", { d: "M15 3v18" }),
        h("path", { d: "m8 9 3 3-3 3" }),
      ),
    );
  });
}
