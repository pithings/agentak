import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { Api, AssistantMessageEventStream, Model } from "@earendil-works/pi-ai";

/** A model from any provider. The api it speaks is on the model itself. */
export type AnyModel = Model<Api>;

type Catalog = Record<string, AnyModel>;

/**
 * A place to send requests. Every one here authenticates with a single api key,
 * so the surface asks for one string and nothing else. Providers that need an
 * account id in the url (Cloudflare), an OAuth flow (Copilot, Codex) or signed
 * requests (Bedrock) are left out.
 */
export interface Provider {
  id: string;
  label: string;
  /** One key, many vendors' models. */
  gateway?: boolean;
  /** Where the key comes from. */
  keyUrl: string;
  keyPlaceholder: string;
  /** Picked when this provider is chosen and nothing is stored. */
  defaultModelId: string;
  /** The catalog. Loaded on demand — OpenRouter's alone is 136 KB of json. */
  load: () => Promise<Catalog>;
}

export const PROVIDERS: Provider[] = [
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
