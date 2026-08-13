import { reactive } from "vue";

/** `choose` is the box's opening state: neither surface is mounted yet. */
export type ChatMode = "choose" | "live" | "demo";

/**
 * The widget state, shared: the topbar and the catalog both open the chat, and
 * the widget itself keeps its transcript across a minimise.
 *
 * `mounted` is what does that — the panel hides with `v-show` once it has been
 * opened, so closing it never unmounts the agent.
 */
export const chat = reactive({
  // The box opens with the page: the widget is what this page exists to show.
  // It opens on the chooser, so nothing starts a loop the visitor did not ask
  // for — the live surface would go straight to the key gate.
  open: true,
  mounted: true,
  mode: "choose" as ChatMode,
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
 * Live runs the real loop and asks for a key; demo replays the canned turns;
 * `choose` goes back to the picker, which drops whichever was running.
 */
export function setChatMode(mode: ChatMode) {
  chat.mode = mode;
}
