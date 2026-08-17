// Docs: @docs/4.agents/2.pi-agent/3.on-device-models.md
/**
 * Chrome's built-in model, as far as the picker needs to know it.
 *
 * Gemini Nano runs inside the browser. The Prompt API (`LanguageModel`) is a
 * global on the page, Chrome downloads the weights once, and no request leaves
 * the device — so there is no endpoint to name, no key to ask for and no catalog
 * to fetch. The one model is written here; `chrome-prompt.ts` is what speaks to
 * it, and is loaded only when it is picked.
 *
 * The api is behind two flags until Chrome ships it: enable
 * `#optimization-guide-on-device-model` and `#prompt-api-for-gemini-nano`, then
 * relaunch. An extension page gets it without a trial token; a regular site
 * needs one. `promptApiSupported()` is what keeps the provider off a browser
 * that has neither.
 */

export type PromptAvailability = "unavailable" | "downloadable" | "downloading" | "available";

/** One turn of the history the api takes up front. `system` may only be first. */
export interface PromptTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PromptCreateOptions {
  initialPrompts?: PromptTurn[];
  /** Only honored as a pair, and only outside flags-only dev mode. */
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  /** Where the one-time download reports itself. */
  monitor?: (monitor: DownloadMonitor) => void;
}

export interface DownloadProgressEvent extends Event {
  /** 0 to 1. */
  loaded: number;
}

/** An `EventTarget`, narrowed to the one event Chrome fires on it. */
export interface DownloadMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface PromptSession {
  promptStreaming(
    input: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<string> | AsyncIterable<string>;
  destroy(): void;
  /** Chrome renamed both of these; whichever one this build has is read. */
  readonly inputUsage?: number;
  readonly contextUsage?: number;
  readonly inputQuota?: number;
  readonly contextWindow?: number;
}

export interface PromptApi {
  availability(): Promise<PromptAvailability>;
  create(options?: PromptCreateOptions): Promise<PromptSession>;
}

/** The global, where this Chrome exposes it. */
export const promptApi = (): PromptApi | undefined =>
  (globalThis as { LanguageModel?: PromptApi }).LanguageModel;

/** Whether this browser carries the api at all. Nothing else can be told from here. */
export const promptApiSupported = (): boolean => typeof promptApi()?.create === "function";

export const ON_DEVICE_PROVIDER_ID = "chrome-ai";
export const ON_DEVICE_MODEL_ID = "gemini-nano";

/** Written to the shape pi reads, the same way the free catalogs are. */
interface OnDeviceModel {
  id: string;
  name: string;
  api: "chrome-prompt";
  provider: string;
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
}

export const ON_DEVICE_MODELS: Record<string, OnDeviceModel> = {
  [ON_DEVICE_MODEL_ID]: {
    id: ON_DEVICE_MODEL_ID,
    name: "Gemini Nano",
    api: "chrome-prompt",
    provider: ON_DEVICE_PROVIDER_ID,
    // On the device: there is nothing to address.
    baseUrl: "",
    reasoning: false,
    input: ["text"],
    // Nothing is billed, so the usage panel prices a turn at nothing.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    // Measured rather than published, and shared between input and output.
    // Past it Chrome throws `QuotaExceededError` instead of truncating.
    contextWindow: 9_216,
    // The api caps no answer of its own; this is the share the meter assumes.
    maxTokens: 4_096,
  },
};
