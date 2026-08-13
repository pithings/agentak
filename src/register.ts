import { createPiSession } from "@/agent/session";
import { defineAgentChat } from "@/element";

/**
 * `agentak/element` — import it for the effect, then write `<agent-chat>`.
 *
 * The call lives here rather than in `element.tsx` so that the one module with
 * a side effect is the one the `exports` map points at, and `sideEffects` in
 * `package.json` can name it. A bundler drops a bare import of a module it is
 * told is pure, which leaves the tag undefined and the element unpainted.
 *
 * This is also the one module that binds the tag to a loop: `<agent-chat>` runs
 * pi over the page tools because this entry says so. Nothing else in the library
 * chooses a harness — a host that brings its own calls `defineAgentChat` with it
 * and never loads this file, and so never loads pi.
 *
 * Importing the class from the package root registers nothing. Call
 * `defineAgentChat()` yourself there — under another tag, if you want one.
 */
defineAgentChat({ session: () => createPiSession() });

export { AgentChatElement, defineAgentChat, type DefineAgentChatOptions } from "@/element";
