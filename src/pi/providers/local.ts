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

/** Pinned: the module, the wasm and the model loader must be one build. */
const WLLAMA_VERSION = "3.6.1";

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
 * A phone is offered the row on the same terms as any other device. It costs
 * more there — the smallest model is a 219 MB download over what is often a
 * metered connection, the weights then sit in a wasm heap a mobile browser is
 * quick to reclaim, and what it does not reclaim it answers slowly on the one
 * core the page gets — but the size is said in the row before the click, and a
 * turn that stays on the device is a choice a phone may want to make. So the
 * cost is written, not decided here.
 */
export const wllamaSupported = (): boolean =>
  typeof WebAssembly === "object" &&
  typeof Worker === "function" &&
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
  // The download is the first thing a visitor gives up, so the picker says it
  // in the row rather than after the click.
  name: `${spec.name} (${spec.size})`,
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
 *
 * The LFM2.5 rows are the exception, and the better bargain: a QAD Q4_0 is
 * distilled while quantized rather than cut down afterwards, so it answers at
 * about 97% of what the full weights do while weighing what a Q4 weighs. Where
 * one exists it is taken, and the row costs a quarter of the download.
 *
 * The window is the other half of the heap, and it is not the same price for
 * every row. A hybrid keeps attention in a few of its layers and a cheap state
 * in the rest — LFM2.5 puts a convolution there, Qwen3.5 a linear attention —
 * so a token of its KV cache costs 12 to 32 KiB. Granite has attention in all
 * forty of its layers and pays 80. Each window below is the largest that
 * leaves the weights and the cache inside about 2.6 GiB together.
 */
export const WLLAMA_MODELS: Record<string, LocalModel> = Object.fromEntries(
  (
    [
      {
        id: "lfm2.5-350m",
        name: "LFM2.5 350M",
        repo: "LiquidAI/LFM2.5-350M-GGUF",
        file: "LFM2.5-350M-QAD-Q4_0.gguf",
        size: "219 MB",
        context: 32_768,
        maxTokens: 1_024,
        // Tool use and structured output are what it is for. Not programming.
        tools: true,
      },
      {
        id: "minicpm5-1b",
        name: "MiniCPM5 1B",
        repo: "openbmb/MiniCPM5-1B-GGUF",
        file: "MiniCPM5-1B-Q4_K_M.gguf",
        size: "688 MB",
        context: 16_384,
        maxTokens: 2_048,
        reasoning: true,
        // Its calls are xml, and its arguments are wrapped in CDATA where they
        // carry a `<` or a newline, so llama.cpp reads them only with the
        // parser it gained in June 2026. The pinned wllama is later than that.
        tools: true,
      },
      {
        id: "lfm2.5-1.2b",
        name: "LFM2.5 1.2B",
        repo: "LiquidAI/LFM2.5-1.2B-Instruct-GGUF",
        file: "LFM2.5-1.2B-Instruct-QAD-Q4_0.gguf",
        size: "696 MB",
        context: 32_768,
        maxTokens: 2_048,
        // It calls a tool better than models twice its weight, and under 1 GB.
        // It does not think: the turn is the answer alone.
        tools: true,
      },
      {
        id: "lfm2.5-2.6b",
        name: "LFM2.5 2.6B",
        repo: "LiquidAI/LFM2.5-2.6B-GGUF",
        file: "LFM2.5-2.6B-QAD-Q4_0.gguf",
        size: "1.6 GB",
        context: 32_768,
        maxTokens: 2_048,
        // The best tool caller here, and a Q4 rather than the Q2 the 4B is cut
        // to. It does not think, which is what makes the call arrive at once.
        tools: true,
      },
      {
        id: WLLAMA_MODEL_ID,
        name: "Qwen3.5 2B",
        repo: "unsloth/Qwen3.5-2B-GGUF",
        file: "Qwen3.5-2B-Q6_K.gguf",
        size: "1.6 GB",
        context: 32_768,
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
        // Its KV cache costs 32 KiB a token against the 2B's 12, and shares
        // the heap with 1.9 GB of weights, so the window is the shorter one.
        context: 16_384,
        maxTokens: 2_048,
        reasoning: true,
        tools: true,
      },
      {
        id: "granite4.1-3b",
        name: "Granite 4.1 3B",
        repo: "ibm-granite/granite-4.1-3b-GGUF",
        file: "granite-4.1-3b-Q4_K_S.gguf",
        size: "2.0 GB",
        // The only row with attention in every layer, so its KV cache costs
        // 80 KiB a token — five times what the hybrids ask — and the window is
        // the shortest here. A plain transformer that answers a tool in json,
        // and does not think.
        context: 8_192,
        maxTokens: 2_048,
        tools: true,
      },
    ] satisfies Spec[]
  ).map((spec) => [spec.id, local(spec)]),
);

export const findLocalModel = (id: string): LocalModel | undefined => WLLAMA_MODELS[id];
