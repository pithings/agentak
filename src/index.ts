// UI plus the agent loop. `Chat` still takes a `ViewMessage[]` from
// anything; `createAgent` + `useAgent` are what the element drives it with.
export { Chat, type ChatProps } from "@/components/chat";
export { AgentChat, type AgentChatProps } from "@/agent-chat";
export { defineAgentChat, AgentChatElement } from "@/element";
// Styles are inline on every element. The one thing a host must declare is the
// `--*` tokens: put this text in a `<style>`, or copy the values.
export { tokens } from "@/styles/base";
export type { ViewMessage, ViewPart } from "@/types";

// The loop. A host that wants its own surface can drive these directly, or
// import the same set from the `agentak/pi` subpath. The built-in
// components are `agentak/components`; nothing here re-exports them.
export * from "@/agent/index";
