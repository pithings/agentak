// Docs: @docs/4.agents/2.pi-agent/1.index.md
// Docs: @docs/4.agents/2.pi-agent/9.advanced-api.md
// The pi-agent-core loop, under the `agentak/pi` subpath — the one entry that
// pulls pi in. `createPiSession` is what `AgentChat` runs on; the rest is for a
// host that wants the loop under a surface of its own.
export { createPiSession, type PiSession, type PiSessionOptions } from "./session.ts";
export {
  AGENT_NAME,
  createAgent,
  SYSTEM_PROMPT,
  type AgentOptions,
  type AgentRuntime,
} from "./create-agent.ts";
export {
  PI_SNAPSHOT_FIELDS,
  PI_SNAPSHOT_VERSION,
  type PiSnapshot,
  readPiSnapshot,
  usablePiMessages,
  type WholePiSnapshot,
} from "./snapshot.ts";
export {
  type ApprovalGate,
  type ApprovalPolicy,
  type ApprovalRequest,
  createApprovalGate,
} from "./approvals.ts";
export {
  catalogModels,
  DEFAULT_MODEL,
  DEFAULT_MODEL_ID,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER_ID,
  findModel,
} from "./models.ts";
export { cachedCatalog, loadCatalog } from "./catalog.ts";
export {
  browserStorage,
  createChoices,
  memoryStorage,
  pageStorage,
  type PiChoices,
  type PiStorage,
} from "./storage.ts";
export {
  encryptedStorage,
  isSecret,
  isSecretStorage,
  type SecretStorage,
  type SecretStorageOptions,
} from "./secret.ts";
export {
  createVault,
  type SecretLock,
  type SecretLockState,
  type SecretVault,
  type VaultOptions,
} from "./vault.ts";
export {
  createPasskey,
  derivePasskey,
  type PasskeyOptions,
  passkeyFailure,
  type PasskeyRecord,
  passkeySupported,
} from "./passkey.ts";
export {
  createHistory,
  mintConversationId,
  type PiHistory,
  type PiHistoryEntry,
} from "./history.ts";
export { describeFailure, failureStatus } from "./errors.ts";
export {
  createPageToolset,
  type PageTool,
  type PageToolDetails,
  type PageTools,
  type PageToolset,
  type PageToolsetOptions,
  pageToolName,
  toToolContent,
} from "./page-tools.ts";
export {
  documentTools,
  type DocumentToolsOptions,
  type ExecuteToolOptions,
  type GetToolsOptions,
  type ModelContext,
  modelContext,
  type RegisteredTool,
  toPageTool,
  type WebmcpAnnotations,
  webmcpSupported,
} from "./webmcp.ts";
export {
  type AnyModel,
  availableProviders,
  type CatalogSource,
  corsFree,
  findProvider,
  type Provider,
  PROVIDERS,
  streamFor,
  SUPPORTED_APIS,
  useCatalogSource,
} from "./providers.ts";
export {
  findLocalModel,
  type LocalModel,
  loadWllamaModule,
  useWllamaSource,
  WLLAMA_MODEL_ID,
  WLLAMA_MODELS,
  WLLAMA_MODULE_URL,
  WLLAMA_PROVIDER_ID,
  WLLAMA_WASM_URL,
  type WllamaLoader,
  type WllamaSource,
  wllamaSupported,
  wllamaWasmUrl,
} from "./local.ts";
export {
  ON_DEVICE_MODEL_ID,
  ON_DEVICE_MODELS,
  ON_DEVICE_PROVIDER_ID,
  type PromptApi,
  type PromptAvailability,
  promptApi,
  promptApiSupported,
} from "./on-device.ts";
export { type CatalogState, useCatalog } from "./use-catalog.ts";
export {
  generateTitle,
  type GenerateTitleOptions,
  titleRequest,
  type TitleOptions,
  type TitleRequest,
  toTitle,
  useTitle,
} from "./title.ts";
export { type ContextUsageView, toContextUsage, toViewMessages } from "./transcript.ts";
export {
  type AgentSnapshot,
  type AgentStore,
  createAgentStore,
  type QueuedMessage,
} from "./store.ts";
export { type ChatState, useAgent } from "./use-agent.ts";
