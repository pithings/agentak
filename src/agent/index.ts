// The pi-agent-core loop, under the `web-agent/pi` subpath. A host that
// wants its own surface drives these directly; the root export re-exports the
// same set.
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
