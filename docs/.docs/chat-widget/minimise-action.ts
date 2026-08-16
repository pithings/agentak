import { computed, type Ref, type ShallowRef } from "vue";
import type { ChatUi } from "./use-chat-agent.ts";

/**
 * The minimise button, on the chat's own header.
 *
 * The surface heads itself, so the site adds no second title bar: `actions`
 * goes at the end of that header, beside the chat's own buttons. It is a preact
 * child, whatever renders the page around it — `Button` is the one the buttons
 * beside it use, so they match.
 *
 * The chevron points at where the chat goes: out to the right edge for the
 * rail, down to the button for the sheet.
 */
export function minimiseAction(
  ui: ShallowRef<ChatUi | undefined>,
  shell: { close: () => void; wide: Ref<boolean> },
) {
  return computed(() => {
    if (!ui.value) return undefined;
    const { Button, h } = ui.value;
    return h(
      Button as never,
      {
        "aria-label": "Minimise the assistant",
        onClick: shell.close,
        size: "icon-sm",
        title: "Minimise",
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
        h("path", { d: shell.wide.value ? "m9 18 6-6-6-6" : "m6 9 6 6 6-6" }),
      ),
    );
  });
}
