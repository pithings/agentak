import { defineAgentChat } from "@/element";

/**
 * `agentak/element` — import it for the effect, then write `<agent-chat>`.
 *
 * The call lives here rather than in `element.tsx` so that the one module with
 * a side effect is the one the `exports` map points at, and `sideEffects` in
 * `package.json` can name it. A bundler drops a bare import of a module it is
 * told is pure, which leaves the tag undefined and the element unpainted.
 *
 * Importing the class from the package root registers nothing. Call
 * `defineAgentChat()` yourself there — under another tag, if you want one.
 */
defineAgentChat();

export { AgentChatElement, defineAgentChat } from "@/element";
