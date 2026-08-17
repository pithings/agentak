// Docs: @docs/4.agents/2.pi-agent/2.providers-and-models.md
/**
 * The catalogs of the keyless providers.
 *
 * pi-ai ships a json catalog per provider it knows; these four it does not, so
 * the entries are written here. Only chat models that stream and take tools are
 * listed — the loop needs both — and every rate is zero, so the usage panel
 * prices a free turn at nothing.
 *
 * The types are this file's own. Nothing here needs pi's `Model<Api>` beyond
 * being usable as one, and `PROVIDERS` is where the two meet and the compiler
 * checks that they still agree.
 */

/** What one entry says, written to the shape pi reads. */
interface FreeModel {
  id: string;
  name: string;
  api: "openai-completions";
  provider: string;
  baseUrl: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  headers?: Record<string, string>;
}

/** What one entry is written from — the rest is the same for every free model. */
interface Spec {
  id: string;
  name: string;
  context: number;
  maxTokens: number;
  reasoning?: boolean;
  vision?: boolean;
}

function catalog(
  provider: string,
  baseUrl: string,
  specs: Spec[],
  /** `null` drops a header the openai client always sets; the model shape says string. */
  headers?: Record<string, string | null>,
): Record<string, FreeModel> {
  return Object.fromEntries(
    specs.map((spec): [string, FreeModel] => [
      spec.id,
      {
        id: spec.id,
        name: spec.name,
        api: "openai-completions",
        provider,
        baseUrl,
        reasoning: spec.reasoning ?? false,
        input: spec.vision ? ["text", "image"] : ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: spec.context,
        maxTokens: spec.maxTokens,
        headers: headers as Record<string, string> | undefined,
      },
    ]),
  );
}

/** `default` routes to whichever free model is up, so its window is the smallest. */
export const LLM7_MODELS = catalog("llm7", "https://api.llm7.io/v1", [
  { id: "default", name: "Auto", context: 32_000, maxTokens: 8_192 },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    context: 256_000,
    maxTokens: 32_768,
    vision: true,
  },
  { id: "gpt-oss:20b", name: "GPT OSS 20B", context: 128_000, maxTokens: 32_768 },
  { id: "codestral-latest", name: "Codestral", context: 32_000, maxTokens: 8_192 },
]);

export const KILO_MODELS = catalog("kilo", "https://api.kilo.ai/api/gateway", [
  { id: "kilo-auto/free", name: "Auto Free", context: 256_000, maxTokens: 10_000, reasoning: true },
  {
    id: "openrouter/free",
    name: "OpenRouter Free Router",
    context: 200_000,
    maxTokens: 32_768,
    reasoning: true,
    vision: true,
  },
  {
    id: "stepfun/step-3.7-flash:free",
    name: "Step 3.7 Flash",
    context: 262_144,
    maxTokens: 32_768,
    reasoning: true,
    vision: true,
  },
  { id: "tencent/hy3:free", name: "Hy3", context: 262_144, maxTokens: 32_768, reasoning: true },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    context: 1_000_000,
    maxTokens: 65_536,
    reasoning: true,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra",
    context: 1_000_000,
    maxTokens: 65_536,
    reasoning: true,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Laguna S 2.1",
    context: 262_144,
    maxTokens: 32_768,
    reasoning: true,
  },
  {
    id: "cohere/north-mini-code:free",
    name: "North Mini Code",
    context: 256_000,
    maxTokens: 64_000,
    reasoning: true,
  },
]);

export const OVHCLOUD_MODELS = catalog(
  "ovhcloud",
  "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
  [
    {
      id: "gpt-oss-20b",
      name: "GPT OSS 20B",
      context: 131_072,
      maxTokens: 32_768,
      reasoning: true,
    },
    {
      id: "gpt-oss-120b",
      name: "GPT OSS 120B",
      context: 131_072,
      maxTokens: 32_768,
      reasoning: true,
    },
    {
      id: "Qwen3.5-397B-A17B",
      name: "Qwen3.5 397B",
      context: 262_144,
      maxTokens: 32_768,
      reasoning: true,
    },
    {
      id: "Qwen3.6-27B",
      name: "Qwen3.6 27B",
      context: 262_144,
      maxTokens: 32_768,
      reasoning: true,
    },
    {
      id: "Qwen3-Coder-30B-A3B-Instruct",
      name: "Qwen3 Coder 30B",
      context: 262_144,
      maxTokens: 32_768,
    },
    { id: "Qwen3.5-9B", name: "Qwen3.5 9B", context: 262_144, maxTokens: 32_768, reasoning: true },
    {
      id: "Mistral-Nemo-Instruct-2407",
      name: "Mistral Nemo",
      context: 65_536,
      maxTokens: 16_384,
    },
    {
      id: "Mistral-Small-3.2-24B-Instruct-2506",
      name: "Mistral Small 3.2 24B",
      context: 131_072,
      maxTokens: 32_768,
    },
    {
      id: "Meta-Llama-3_3-70B-Instruct",
      name: "Llama 3.3 70B",
      context: 131_072,
      maxTokens: 32_768,
    },
  ],
  // OVHcloud answers an anonymous request, and rejects a bearer token with 403.
  { Authorization: null },
);

/** Zen names every free model `…-free`; here the provider says that already. */
export const OPENCODE_ZEN_MODELS = catalog(
  "opencode-zen",
  "https://opencode.ai/zen/v1",
  [
    {
      id: "deepseek-v4-flash-free",
      name: "DeepSeek V4 Flash",
      context: 1_000_000,
      maxTokens: 32_768,
      reasoning: true,
    },
    {
      id: "mimo-v2.5-free",
      name: "MiMo V2.5",
      context: 256_000,
      maxTokens: 32_768,
      reasoning: true,
    },
    {
      id: "nemotron-3.5-lightning-free",
      name: "Nemotron 3.5 Lightning",
      context: 1_000_000,
      maxTokens: 65_536,
      reasoning: true,
    },
    {
      id: "laguna-s-2.1-free",
      name: "Laguna S 2.1",
      context: 262_144,
      maxTokens: 32_768,
      reasoning: true,
    },
  ],
  // Zen answers an anonymous request, and rejects a bearer token with 401.
  { Authorization: null },
);
