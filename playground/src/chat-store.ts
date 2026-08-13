import { reactive } from "vue";

/** The surface in the box: the real loop, or the canned turns. */
export type ChatMode = "live" | "demo";

/**
 * The widget state, shared: the topbar and the catalog both open the chat, and
 * the widget itself keeps its transcript across a minimise.
 *
 * `mounted` is what does that — the panel hides with `v-show` once it has been
 * opened, so closing it never unmounts the agent.
 */
export const chat = reactive({
  // The box opens with the page: the widget is what this page exists to show.
  // It opens on the live agent, which starts on no provider at all — the first
  // message opens its picker. The demo is one button inside it.
  open: true,
  mounted: true,
  mode: "live" as ChatMode,
});

export function openChat(mode?: ChatMode) {
  if (mode) chat.mode = mode;
  chat.open = true;
  chat.mounted = true;
}

export function closeChat() {
  chat.open = false;
}

/**
 * Live runs the real loop; demo replays the canned turns. Switching drops
 * whichever surface was up, transcript and all.
 */
export function setChatMode(mode: ChatMode) {
  chat.mode = mode;
}
