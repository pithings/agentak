import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { Api, AssistantMessageEventStream, Model } from "@earendil-works/pi-ai";

import { KILO_MODELS, LLM7_MODELS, OPENCODE_ZEN_MODELS, OVHCLOUD_MODELS } from "@/pi/free-models";

/** A model from any provider. The api it speaks is on the model itself. */
export type AnyModel = Model<Api>;

type Catalog = Record<string, AnyModel>;

/**
 * A place to send requests. Every one here authenticates with a single api key
 * or with none at all, so the surface asks for one string and nothing else.
 * Providers that need an account id in the url (Cloudflare), an OAuth flow
 * (Copilot, Codex) or signed requests (Bedrock) are left out.
 */
export interface Provider {
  id: string;
  label: string;
  /** One key, many vendors' models. */
  gateway?: boolean;
  /**
   * No account and no key: the endpoint answers an anonymous request. LLM7 and
   * Kilo want the string `unused`; OVHcloud and OpenCode Zen reject any bearer
   * token, so their models drop the header instead.
   */
  free?: boolean;
  /** What free costs — the published limit. */
  note?: string;
  /**
   * The endpoint answers a cross-origin preflight. Omitted means it does;
   * `false` names the ones that do not, and a page drops them.
   */
  cors?: boolean;
  /** Where the key comes from. A free provider has none. */
  keyUrl?: string;
  keyPlaceholder?: string;
  /** Picked when this provider is chosen and nothing is stored. */
  defaultModelId: string;
  /** The catalog. Loaded on demand — OpenRouter's alone is 136 KB of json. */
  load: () => Promise<Catalog>;
}

export const PROVIDERS: Provider[] = [
  {
    id: "llm7",
    label: "LLM7",
    free: true,
    note: "10 requests a minute, 500K tokens a day.",
    defaultModelId: "gemini-3.1-flash-lite",
    load: async () => LLM7_MODELS,
  },
  {
    id: "kilo",
    label: "Kilo Gateway",
    gateway: true,
    free: true,
    cors: false,
    note: "200 requests an hour.",
    defaultModelId: "kilo-auto/free",
    load: async () => KILO_MODELS,
  },
  {
    id: "ovhcloud",
    label: "OVHcloud",
    free: true,
    note: "2 requests a minute.",
    defaultModelId: "gpt-oss-20b",
    load: async () => OVHCLOUD_MODELS,
  },
  {
    id: "opencode-zen",
    label: "OpenCode Zen",
    free: true,
    cors: false,
    note: "A fair-use limit the provider does not publish.",
    defaultModelId: "deepseek-v4-flash-free",
    load: async () => OPENCODE_ZEN_MODELS,
  },
  {
    id: "vercel-ai-gateway",
    label: "Vercel AI Gateway",
    gateway: true,
    keyUrl: "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%2Fapi-keys",
    keyPlaceholder: "vck_…",
    defaultModelId: "anthropic/claude-sonnet-5",
    load: () =>
      import("@earendil-works/pi-ai/providers/vercel-ai-gateway.models").then(
        (m) => m.VERCEL_AI_GATEWAY_MODELS,
      ),
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    gateway: true,
    keyUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-v1-…",
    defaultModelId: "anthropic/claude-sonnet-5",
    load: () =>
      import("@earendil-works/pi-ai/providers/openrouter.models").then((m) => m.OPENROUTER_MODELS),
  },
  {
    id: "openai",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-…",
    defaultModelId: "gpt-5",
    load: () =>
      import("@earendil-works/pi-ai/providers/openai.models").then((m) => m.OPENAI_MODELS),
  },
  {
    id: "groq",
    label: "Groq",
    keyUrl: "https://console.groq.com/keys",
    keyPlaceholder: "gsk_…",
    defaultModelId: "llama-3.3-70b-versatile",
    load: () => import("@earendil-works/pi-ai/providers/groq.models").then((m) => m.GROQ_MODELS),
  },
  {
    id: "cerebras",
    label: "Cerebras",
    keyUrl: "https://cloud.cerebras.ai",
    keyPlaceholder: "csk-…",
    defaultModelId: "gpt-oss-120b",
    load: () =>
      import("@earendil-works/pi-ai/providers/cerebras.models").then((m) => m.CEREBRAS_MODELS),
  },
];

export const findProvider = (id?: string): Provider | undefined =>
  PROVIDERS.find((provider) => provider.id === id);

/**
 * Whether this runtime is outside CORS. An extension page fetches through its
 * `host_permissions`, which the preflight never gates; a page — the playground,
 * a host site, the panel served by vite in dev — is gated by it.
 */
export const corsFree = (): boolean => globalThis.location?.protocol === "chrome-extension:";

/**
 * The providers this runtime can reach. `Access-Control-Allow-Origin` is the
 * server's to send, so a provider that sends none is unreachable from a page
 * and no request header changes that — the picker offers it nowhere it would
 * fail. The extension gets the whole list.
 */
export const availableProviders = (): Provider[] =>
  corsFree() ? PROVIDERS : PROVIDERS.filter((provider) => provider.cors !== false);

/**
 * The api modules, one import each.
 *
 * A static import would put every sdk in the first chunk. The module arrives
 * with the first turn that needs it, and the anthropic and openai sdks stay in
 * chunks of their own.
 */
// Each module types its own `Model<api>`; this call site is the one place that
// holds every api at once, so the parameters widen here and nowhere else.
type ApiModule = { streamSimple: (...args: any[]) => AssistantMessageEventStream };

const APIS: Record<string, () => Promise<ApiModule>> = {
  "anthropic-messages": () => import("@earendil-works/pi-ai/api/anthropic-messages"),
  "openai-completions": () => import("@earendil-works/pi-ai/api/openai-completions"),
  "openai-responses": () => import("@earendil-works/pi-ai/api/openai-responses"),
};

/** The apis this bundle can speak. A catalog entry outside them is not offered. */
export const SUPPORTED_APIS = Object.keys(APIS);

/**
 * One stream function for every provider: the model names its api, and the
 * module for it is fetched on use.
 *
 * A throw here is not a protocol failure — `Agent` catches it and ends the turn
 * with the message, which is what a missing chunk or an unknown api deserves.
 */
export const streamFor: StreamFn = async (model, context, options) => {
  const load = APIS[model.api];
  if (!load) throw new Error(`This build does not carry the ${model.api} api.`);
  const { streamSimple } = await load();
  return streamSimple(model, context, options);
};
