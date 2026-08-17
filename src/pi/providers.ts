// Docs: @docs/4.agents/2.pi-agent/2.providers-and-models.md
import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { Api, AssistantMessageEventStream, FetchFunction, Model } from "@earendil-works/pi-ai";

import {
  KILO_MODELS,
  LLM7_MODELS,
  OPENCODE_ZEN_MODELS,
  OVHCLOUD_MODELS,
} from "./providers/free-models.ts";
import {
  WLLAMA_MODEL_ID,
  WLLAMA_MODELS,
  WLLAMA_PROVIDER_ID,
  wllamaSupported,
} from "./providers/local.ts";
import {
  ON_DEVICE_MODEL_ID,
  ON_DEVICE_MODELS,
  ON_DEVICE_PROVIDER_ID,
  promptApiSupported,
} from "./providers/on-device.ts";

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
  /**
   * Whether this browser carries the provider at all. Only the two that run on
   * the device answer it: a Chrome without the Prompt API has nothing to offer,
   * and an extension page may import no module from a CDN. The picker must not
   * list a row that cannot answer.
   */
  supported?: () => boolean;
  /**
   * The request, rewritten before it is sent. For a provider whose preflight
   * takes fewer headers than the sdk sets — see `vercelFetch`. Omitted leaves
   * the request as the api module built it.
   */
  fetch?: FetchFunction;
  /** Where the key comes from. A free provider has none. */
  keyUrl?: string;
  keyPlaceholder?: string;
  /** Picked when this provider is chosen and nothing is stored. */
  defaultModelId: string;
  /** The catalog. Loaded on demand — OpenRouter's alone is 136 KB of json. */
  load: CatalogLoader;
}

type CatalogLoader = () => Promise<Catalog>;

/**
 * Which pi-ai the catalogs are read from. `latest` and not the installed
 * version, because the point is the models published since this build: pi-ai
 * regenerates its json every release, and a bundled copy only ages. Write a
 * version string here to pin it.
 */
const PI_AI_VERSION = "latest";

const CDN = `https://esm.sh/@earendil-works/pi-ai@${PI_AI_VERSION}/providers`;

/** How one catalog module arrives. What it exports is `catalog()`'s to name. */
export type CatalogSource = (module: string) => Promise<Record<string, unknown>>;

/** A url and not a package, so no bundler follows it and none of it ships. */
const fromCdn: CatalogSource = (module) => import(/* @vite-ignore */ `${CDN}/${module}.models`);

let source = fromCdn;

/**
 * Where the catalogs come from. The default reads esm.sh, which needs a network
 * and a document that may import a module it does not ship. A host that is
 * neither — an offline build, a page whose policy allows no remote module, the
 * MV3 panel — passes its own import here instead, and pins the models it ships.
 */
export const useCatalogSource = (next: CatalogSource | undefined): void => {
  source = next ?? fromCdn;
};

/** One provider's catalog, read from whichever pi-ai `source` answers with. */
const catalog = (module: string): CatalogLoader => {
  // `<id>.models` exports `<ID>_MODELS`, and has since pi-ai generated them.
  const exportName = `${module.replace(/-/g, "_").toUpperCase()}_MODELS`;

  return async () => {
    const models = (await source(module))[exportName] as Catalog | undefined;
    if (!models) throw new Error(`This pi-ai carries no ${exportName}.`);
    return models;
  };
};

/**
 * What Vercel's gateway lets a page send. Its preflight answers with a fixed
 * list, and the anthropic sdk sets four names outside it: `x-api-key`,
 * `anthropic-version`, `anthropic-dangerous-direct-browser-access`, and the
 * `x-stainless-*` telemetry. Any one of them fails the check and the browser
 * drops the request before it leaves — which is the `x-stainless-os is not
 * allowed by Access-Control-Allow-Headers` error the console shows.
 *
 * The list, and not the four names, because it is the server's own answer to
 * `OPTIONS /v1/messages` and so the whole of what a page may send. A header the
 * sdk adds later is refused the same way, and refused here first.
 */
const VERCEL_HEADERS = new Set(["accept", "anthropic-beta", "authorization", "content-type"]);

/**
 * What the gateway would have said, asked of the endpoint that answers.
 *
 * `POST /v1/messages` sends no `Access-Control-Allow-Origin` with a 401, so a
 * refused key reaches the page as an unreadable network error and the chat can
 * only say that the provider was not reached. `GET /v1/models` takes the same
 * key, answers a bad one with the same 401, and does send the header — so it is
 * asked, and its answer stands in for the one the browser would not read.
 *
 * Only the key is settled this way. A gateway that took the key and failed the
 * turn for another reason answers this 200, and the original error stands.
 */
const vercelRefusal = async (url: string, authorization: string): Promise<Response | undefined> => {
  const answer = await fetch(new URL("/v1/models", url), { headers: { authorization } }).catch(
    () => undefined,
  );
  if (!answer || answer.ok) return undefined;

  // A status the sdk can read is a status the chat can act on: pi puts it at
  // the head of the failure, and the session opens the settings page on a 4xx.
  return new Response(await answer.text(), {
    status: answer.status,
    headers: { "content-type": answer.headers.get("content-type") ?? "application/json" },
  });
};

/**
 * The same request with only those headers left. The key moves to
 * `Authorization`, which the gateway takes in place of `x-api-key`, and the
 * version header goes: the gateway asks for none.
 *
 * The extension needs none of this — its fetch is not gated by a preflight —
 * but the rewrite costs it nothing and one path is easier to reason about.
 */
export const vercelFetch: FetchFunction = async (input, init) => {
  const url = input instanceof Request ? input.url : input.toString();
  const sent = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

  const headers = new Headers();
  for (const [name, value] of sent) {
    if (VERCEL_HEADERS.has(name)) headers.set(name, value);
  }

  const key = sent.get("x-api-key");
  if (key && !headers.has("authorization")) headers.set("authorization", `Bearer ${key}`);

  try {
    return await fetch(input, { ...init, headers });
  } catch (error) {
    // A turn the person stopped is not a failure to explain, and neither is a
    // request that carried no key at all.
    const authorization = headers.get("authorization");
    if (init?.signal?.aborted || !authorization) throw error;

    const refusal = await vercelRefusal(url, authorization);
    if (!refusal) throw error;
    return refusal;
  }
};

/**
 * The picker's order: the two gateways a key opens first, then the ones that
 * need none. A free provider is the fallback and not the recommendation — one
 * key reaches every vendor's newest model, while free means a rate limit, a
 * small model, or a download — so the list leads with the choice worth making
 * and leaves the keyless rows at the foot for anyone who has no key to give.
 *
 * Inside the free group: the device's own first, because nothing about it is
 * metered or shared, then the two that answer a page — LLM7 ahead of OVHcloud
 * on the published limit — then the two only the extension reaches. Chrome's
 * own is last: it takes a 4 GB download and answers text alone, no tool call
 * and no image, so it is the weakest row here even where it is listed.
 */
export const PROVIDERS: Provider[] = [
  {
    id: "vercel-ai-gateway",
    label: "Vercel AI Gateway",
    gateway: true,
    fetch: vercelFetch,
    keyUrl: "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys",
    keyPlaceholder: "vck_…",
    defaultModelId: "anthropic/claude-sonnet-5",
    load: catalog("vercel-ai-gateway"),
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    gateway: true,
    keyUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-v1-…",
    defaultModelId: "anthropic/claude-sonnet-5",
    load: catalog("openrouter"),
  },
  {
    id: WLLAMA_PROVIDER_ID,
    label: "On Device (wllama)",
    free: true,
    supported: wllamaSupported,
    note: "llama.cpp runs in this tab. The model is downloaded once, 0.2 to 1.9 GB.",
    defaultModelId: WLLAMA_MODEL_ID,
    load: async () => WLLAMA_MODELS,
  },
  {
    id: "llm7",
    label: "LLM7",
    free: true,
    note: "10 requests a minute, 500K tokens a day.",
    defaultModelId: "gemini-3.1-flash-lite",
    load: async () => LLM7_MODELS,
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
    id: "opencode-zen",
    label: "OpenCode Zen",
    free: true,
    cors: false,
    note: "A fair-use limit the provider does not publish.",
    defaultModelId: "deepseek-v4-flash-free",
    load: async () => OPENCODE_ZEN_MODELS,
  },
  {
    id: ON_DEVICE_PROVIDER_ID,
    label: "Chrome Built-in AI",
    free: true,
    supported: promptApiSupported,
    note: "Gemini Nano runs on this device. Chrome downloads it once, ~4 GB.",
    defaultModelId: ON_DEVICE_MODEL_ID,
    load: async () => ON_DEVICE_MODELS,
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
 * fail. The extension gets the whole list, bar the one Chrome itself decides:
 * the on-device model is listed only where the browser carries the api.
 */
export const availableProviders = (): Provider[] =>
  PROVIDERS.filter(
    (provider) => (corsFree() || provider.cors !== false) && (provider.supported?.() ?? true),
  );

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
  // Not one of pi's: Chrome's own, written here. See `chrome-prompt.ts`.
  "chrome-prompt": () => import("./providers/chrome-prompt.ts"),
  "openai-completions": () => import("@earendil-works/pi-ai/api/openai-completions"),
  "openai-responses": () => import("@earendil-works/pi-ai/api/openai-responses"),
  // Not one of pi's either: llama.cpp in this tab. See `wllama.ts`.
  wllama: () => import("./providers/wllama.ts"),
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
  // A provider's own fetch is the last word on its headers; a host that passes
  // one has already replaced the transport, so that one stands.
  const fetch = options?.fetch ?? findProvider(model.provider)?.fetch;
  return streamSimple(model, context, fetch ? { ...options, fetch } : options);
};
