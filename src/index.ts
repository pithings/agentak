// The surface and nothing behind it. This entry loads no agent runtime: `Chat`
// takes a `ViewMessage[]` from anything, and `AgentChat` takes a `ChatSession`
// from anything. The built-in loop is `agentak/pi` — `createPiSession()` — and
// `agentak/element` is the entry that binds it to `<agent-chat>`.
export { Chat, type ChatProps } from "@/components/chat";
export { AgentChat, type AgentChatProps } from "@/agent-chat";
export { AgentChatElement, defineAgentChat, type DefineAgentChatOptions } from "@/element";
export {
  type ChatSession,
  type ChatSessionOptions,
  type ChatSnapshot,
  useSession,
} from "@/session";
// Styles are inline on every element. The one thing a host must declare is the
// `--*` tokens: put this text in a `<style>`, or copy the values.
export { tokens } from "@/styles/base";
export type { ViewMessage, ViewPart } from "@/types";
