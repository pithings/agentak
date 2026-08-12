// UI plus the agent loop. `AgentChat` still takes a `ViewMessage[]` from
// anything; `createWebAgent` + `useAgent` are what the element drives it with.
export { AgentChat, type AgentChatProps } from "@/components/agent-chat";
export { WebAgent, type WebAgentProps } from "@/web-agent";
export { defineWebAgent, WebAgentElement } from "@/element";
// Styles are inline on every element. The one thing a host must declare is the
// `--wa-*` tokens: put this text in a `<style>`, or copy the values.
export { tokens } from "@/styles/base";
export type { ViewMessage, ViewPart } from "@/types";

// The loop. A host that wants its own surface can drive these directly, or
// import the same set from the `web-agent/pi` subpath. The built-in
// components are `web-agent/components`; nothing here re-exports them.
export * from "@/agent/index";
