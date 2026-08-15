// The surface and nothing behind it. This entry loads no agent runtime: `Chat`
// takes a `ViewMessage[]` from anything, and `AgentChat` takes a `ChatSession`
// from anything. The built-in loop is `agentak/pi` — `createPiSession()` — and a
// host mounts the surface with `mountChat()`, or with preact's `render` itself.
export { Chat, type ChatProps } from "./components/chat.tsx";
export { AgentChat, type AgentChatProps } from "./agent-chat.tsx";
// One call for a page with no framework: the tokens, the box, the surface.
export { type ChatMount, mountChat, type MountChatOptions } from "./wrap.ts";
export {
  type ChatSession,
  type ChatSessionOptions,
  type ChatSnapshot,
  useSession,
} from "./session.ts";
// Styles are inline on every element. The one thing a host must declare is the
// `--*` tokens: put this text in a `<style>`, or copy the values —
// `injectTokens()` is that line, for a host with nothing to say about it.
export { tokens } from "./styles/base.ts";
export { injectTokens } from "./styles/inject.ts";
export type { ViewMessage, ViewPart } from "./types.ts";
