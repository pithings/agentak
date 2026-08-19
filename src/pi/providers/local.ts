// Docs: @docs/4.agents/2.pi/3.on-device-models.md
/**
 * llama.cpp in the browser, as far as the picker needs to know it.
 *
 * wllama compiles llama.cpp to WebAssembly and answers a turn on this machine.
 * The module and its wasm come from a CDN, the weights come from Hugging Face,
 * and the browser keeps both — so there is no endpoint to name, no key to ask
 * for and no catalog to fetch. The models are written here; `wllama.ts` is what
 * runs them, and is loaded only when one is picked.
 *
 * A model is a download of hundreds of MB, so the catalog is small models
 * alone, and every entry says what it weighs before the click.
 */

import { isPhone } from "../../lib/utils.ts";

/** Pinned: the module, the wasm and the model loader must be one build. */
const WLLAMA_VERSION = "3.5.1";

const CDN = `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}`;

/** The esm bundle, imported at the url. Nothing here is a dependency. */
export const WLLAMA_MODULE_URL = `${CDN}/esm/index.js`;

/** The one wasm build. It carries single thread, multi thread and WebGPU. */
export const WLLAMA_WASM_URL = `${CDN}/src/wasm/wllama.wasm`;

export const WLLAMA_PROVIDER_ID = "wllama";
export const WLLAMA_MODEL_ID = "qwen3.5-2b";

/** How the module arrives. The shape of it is `wllama.ts`'s to know. */
export type WllamaLoader = () => Promise<unknown>;

/** Where wllama comes from, for a host that does not take it from the CDN. */
export interface WllamaSource {
  /** The esm bundle. */
  module: WllamaLoader;
  /** The wasm the runtime is built from, where it is not the CDN's. */
  wasm?: string;
}

const fromCdn: WllamaSource = {
  module: () => import(/* @vite-ignore */ WLLAMA_MODULE_URL),
  wasm: WLLAMA_WASM_URL,
};

let source = fromCdn;

export const loadWllamaModule = (): Promise<unknown> => source.module();

/** The wasm `wllama.ts` builds the runtime from. */
export const wllamaWasmUrl = (): string => source.wasm ?? WLLAMA_WASM_URL;

/**
 * Where wllama comes from. The default imports the urls above, which are urls
 * and not packages so that no bundler follows them. A host that ships wllama
 * itself — an offline build, or a document whose policy allows no remote
 * module — passes its own here instead.
 */
export const useWllamaSource = (next: WllamaSource | undefined): void => {
  source = next ?? fromCdn;
};

/**
 * Whether this runtime can run the loop at all: wasm to run it in, a worker to
 * hold it, and a document that may load what the loop is made of. An MV3 page
 * may not — its content security policy allows neither a remote module nor a
 * worker built at runtime — so the CDN default is not offered there. A host
 * that passed a source of its own has already answered that question, and the
 * row is offered wherever it says: the side panel ships wllama, its wasm and
 * its worker, so it does. See `extension/wllama/`.
 *
 * A phone is left out whatever it can load. The smallest model here is a 229 MB
 * download over what is often a metered connection, the rest are hundreds of MB
 * more, and the weights then sit in a wasm heap a mobile browser is quick to
 * reclaim — a background tab is discarded and the download starts again. What a
 * phone does not reclaim it answers slowly, on the one core the page gets and
 * on a battery. The row would be a long wait for a turn the free providers
 * answer at once, so it is not offered; every other provider still is.
 */
export const wllamaSupported = (): boolean =>
  typeof WebAssembly === "object" &&
  typeof Worker === "function" &&
  !isPhone() &&
  (source !== fromCdn || globalThis.location?.protocol !== "chrome-extension:");

/** What one entry is written from. The rest is the same for every local model. */
interface Spec {
  id: string;
  name: string;
  /** The Hugging Face repo and the file in it. Public, so the fetch is plain. */
  repo: string;
  file: string;
  /** What the weights weigh, said before the download starts. */
  size: string;
  /** The window the model is loaded with, not the one it was trained for. */
  context: number;
  maxTokens: number;
  reasoning?: boolean;
  /** Whether the chat template of the model can call a tool. */
  tools?: boolean;
}

/** Written to the shape pi reads, the same way the free catalogs are. */
export interface LocalModel {
  id: string;
  name: string;
  api: "wllama";
  provider: string;
  /** Where the weights come from. This api loads them rather than posting to it. */
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  size: string;
  tools: boolean;
}

const local = (spec: Spec): LocalModel => ({
  id: spec.id,
  name: spec.name,
  api: "wllama",
  provider: WLLAMA_PROVIDER_ID,
  baseUrl: `https://huggingface.co/${spec.repo}/resolve/main/${spec.file}`,
  reasoning: spec.reasoning ?? false,
  // A vision model needs a second file, the projector, so the catalog has none.
  input: ["text"],
  // Nothing is billed, so the usage panel prices a turn at nothing.
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: spec.context,
  maxTokens: spec.maxTokens,
  size: spec.size,
  tools: spec.tools ?? false,
});

/**
 * Small instruction models, quantized, that a laptop answers with.
 *
 * The quant is part of the choice, not a detail: one file may not pass 2 GB —
 * past that wllama wants the model split — and the weights share a 4 GiB wasm
 * heap with the KV cache. So the 2B is a Q6_K rather than a Q4, which is the
 * same model with less of it thrown away, and the 4B is a dynamic Q2_K_XL,
 * which keeps the tensors that matter at a higher precision. K-quants
 * throughout: wllama's own guidance is that IQ quants answer slowly.
 */
export const WLLAMA_MODELS: Record<string, LocalModel> = Object.fromEntries(
  (
    [
      {
        id: "lfm2.5-350m",
        name: "LFM2.5 350M",
        repo: "LiquidAI/LFM2.5-350M-GGUF",
        file: "LFM2.5-350M-Q4_K_M.gguf",
        size: "229 MB",
        context: 4_096,
        maxTokens: 1_024,
        // Tool use and structured output are what it is for. Not programming.
        tools: true,
      },
      {
        id: "qwen3.5-0.8b",
        name: "Qwen3.5 0.8B",
        repo: "unsloth/Qwen3.5-0.8B-GGUF",
        file: "Qwen3.5-0.8B-Q4_K_M.gguf",
        size: "533 MB",
        context: 8_192,
        maxTokens: 2_048,
        reasoning: true,
        tools: true,
      },
      {
        id: "minicpm5-1b",
        name: "MiniCPM5 1B",
        repo: "openbmb/MiniCPM5-1B-GGUF",
        file: "MiniCPM5-1B-Q4_K_M.gguf",
        size: "688 MB",
        context: 8_192,
        maxTokens: 2_048,
        reasoning: true,
        tools: true,
      },
      {
        id: "qwen2.5-coder-1.5b",
        name: "Qwen2.5 Coder 1.5B",
        repo: "Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF",
        file: "qwen2.5-coder-1.5b-instruct-q6_k.gguf",
        size: "1.5 GB",
        context: 8_192,
        maxTokens: 2_048,
        // Written for code, and small, so it is a Q6_K like the 2B. It does not
        // think: the turn is the answer alone.
        tools: true,
      },
      {
        id: WLLAMA_MODEL_ID,
        name: "Qwen3.5 2B",
        repo: "unsloth/Qwen3.5-2B-GGUF",
        file: "Qwen3.5-2B-Q6_K.gguf",
        size: "1.6 GB",
        context: 8_192,
        maxTokens: 2_048,
        reasoning: true,
        tools: true,
      },
      {
        id: "qwen3.5-4b",
        name: "Qwen3.5 4B",
        repo: "unsloth/Qwen3.5-4B-GGUF",
        file: "Qwen3.5-4B-UD-Q2_K_XL.gguf",
        size: "1.9 GB",
        // The largest that fits. Its KV cache shares the heap with 1.9 GB of
        // weights, so the window is half of what the 2B is loaded with.
        context: 4_096,
        maxTokens: 2_048,
        reasoning: true,
        tools: true,
      },
    ] satisfies Spec[]
  ).map((spec) => [spec.id, local(spec)]),
);

export const findLocalModel = (id: string): LocalModel | undefined => WLLAMA_MODELS[id];
