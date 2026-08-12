// UI plus the agent loop. `AgentChat` still takes a `ViewMessage[]` from
// anything; `createWebAgent` + `useAgent` are what the element drives it with.
export { AgentChat, type AgentChatProps } from "@/components/agent-chat";
export { WebAgent, type WebAgentProps } from "@/web-agent";
export { defineWebAgent, WebAgentElement } from "@/element";
// Styles are inline on every element. The one thing a host must declare is the
// `--wa-*` tokens: put this text in a `<style>`, or copy the values.
export { tokens } from "@/styles/base";
export type { ViewMessage, ViewPart } from "@/types";

// The loop. A host that wants its own surface can drive these directly.
export {
  AGENT_NAME,
  createWebAgent,
  SYSTEM_PROMPT,
  type WebAgentOptions,
  type WebAgentRuntime,
} from "@/agent/create-agent";
export {
  type ApprovalGate,
  type ApprovalPolicy,
  type ApprovalRequest,
  createApprovalGate,
} from "@/agent/approvals";
export {
  catalogModels,
  DEFAULT_MODEL,
  DEFAULT_MODEL_ID,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER_ID,
  findModel,
} from "@/agent/models";
export {
  type AnyModel,
  findProvider,
  type Provider,
  PROVIDERS,
  streamFor,
  SUPPORTED_APIS,
} from "@/agent/providers";
export { type CatalogState, useCatalog } from "@/agent/use-catalog";
export {
  documentBridge,
  type PageBridge,
  type PageElement,
  type PageSnapshot,
} from "@/agent/page-bridge";
export { createPageTools } from "@/agent/tools";
export { type ContextUsageView, toContextUsage, toViewMessages } from "@/agent/transcript";
export { type AgentChatState, type QueuedMessage, useAgent } from "@/agent/use-agent";
