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
/**
 * A phone is the one screen the widget does not open on.
 *
 * Everywhere else the surface sits beside the page — a rail on a desktop, a box
 * in the corner on a tablet — so opening with the page costs the visitor
 * nothing. Under `sm` it is a sheet over the whole screen, and auto-showing it
 * would hand a visitor the chat instead of the page they came for. The launcher
 * waits in the corner, and nothing mounts until it is taken.
 *
 * Read once, at load: this is the state the page starts in, not a layout that
 * follows a resize — the widget itself owns that.
 */
const phone = globalThis.matchMedia?.("(max-width: 39.999rem)").matches ?? false;

export const chat = reactive({
  // The box opens with the page: the widget is what this page exists to show.
  // It opens on the live agent, which starts on no provider at all — the first
  // message opens its picker. The demo is one button inside it.
  open: !phone,
  mounted: !phone,
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

/** The one control that both opens and minimises — the topbar button. */
export function toggleChat() {
  if (chat.open) closeChat();
  else openChat();
}

/**
 * Live runs the real loop; demo replays the canned turns. Switching drops
 * whichever surface was up, transcript and all.
 */
export function setChatMode(mode: ChatMode) {
  chat.mode = mode;
}
