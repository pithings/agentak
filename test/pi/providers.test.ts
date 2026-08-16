import { describe, expect, it } from "vitest";

import {
  catalogModels,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER_ID,
  findModel,
} from "../../src/pi/models.ts";
import { ON_DEVICE_PROVIDER_ID } from "../../src/pi/on-device.ts";
import {
  type AnyModel,
  availableProviders,
  findProvider,
  PROVIDERS,
  streamFor,
  SUPPORTED_APIS,
} from "../../src/pi/providers.ts";

const model = (over: Partial<AnyModel>): AnyModel =>
  ({
    id: "m",
    name: "M",
    api: "openai-completions",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 100_000,
    maxTokens: 8000,
    ...over,
  }) as AnyModel;

describe("catalogModels", () => {
  it("drops what the picker should not offer, and sorts the rest", () => {
    const models = catalogModels({
      a: model({ id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" }),
      b: model({ id: "anthropic/claude-sonnet-5:batch", name: "Claude Sonnet 5 (batch)" }),
      c: model({ id: "gemini-3", name: "Gemini 3", api: "google-generative-ai" }),
      d: model({ id: "zeta", name: "Zeta" }),
      e: model({ id: "alpha", name: "Alpha (latest)" }),
    });

    // The dated snapshot, the batch variant and the api this build cannot
    // speak are all gone; `(latest)` is noise in a name.
    expect(models.map((entry) => entry.id)).toEqual(["alpha", "zeta"]);
    expect(models[0].name).toBe("Alpha");
  });
});

describe("PROVIDERS", () => {
  it("names an api this build carries, and a model that exists", async () => {
    for (const provider of PROVIDERS) {
      const models = catalogModels(await provider.load());

      expect(models.length, `${provider.id} has no usable model`).toBeGreaterThan(0);
      expect(
        findModel(models, provider.defaultModelId),
        `${provider.id} defaults to ${provider.defaultModelId}, which its catalog does not list`,
      ).toBeTruthy();
      for (const entry of models) {
        expect(SUPPORTED_APIS, `${provider.id}/${entry.id}`).toContain(entry.api);
        expect(entry.provider, `${provider.id}/${entry.id}`).toBe(provider.id);
      }
    }
  }, 20_000);

  it("opens on a provider that needs no key, and finds a provider by id", () => {
    expect(DEFAULT_MODEL.provider).toBe(DEFAULT_PROVIDER_ID);
    expect(findProvider(DEFAULT_PROVIDER_ID)?.free).toBe(true);
    expect(findProvider("openrouter")?.gateway).toBe(true);
    expect(findProvider("nope")).toBeUndefined();
  });

  it("offers a page only what it can reach, and opens on one of those", () => {
    // jsdom is a page, so the two that answer no preflight are dropped. The
    // extension is the runtime that gets the whole list.
    const blocked = PROVIDERS.filter((entry) => entry.cors === false).map((entry) => entry.id);
    expect(blocked).toEqual(["kilo", "opencode-zen"]);

    const ids = availableProviders().map((entry) => entry.id);
    expect(ids).not.toContain("kilo");
    expect(ids).not.toContain("opencode-zen");
    expect(ids).toContain(DEFAULT_PROVIDER_ID);
    // jsdom is not Chrome either, so the on-device provider goes with them.
    expect(ids).not.toContain(ON_DEVICE_PROVIDER_ID);
    expect(ids.length).toBe(PROVIDERS.length - blocked.length - 1);
  });

  it("lists the on-device provider only where the browser carries the api", () => {
    const global = globalThis as { LanguageModel?: unknown };
    global.LanguageModel = { availability: async () => "available", create: async () => ({}) };
    try {
      expect(availableProviders().map((entry) => entry.id)).toContain(ON_DEVICE_PROVIDER_ID);
    } finally {
      delete global.LanguageModel;
    }
  });

  it("prices a free provider at nothing, and asks it for no key", async () => {
    for (const provider of PROVIDERS.filter((entry) => entry.free)) {
      expect(provider.keyUrl, `${provider.id} points at a key page`).toBeUndefined();
      expect(provider.note, `${provider.id} does not say what the limit is`).toBeTruthy();
      for (const entry of catalogModels(await provider.load())) {
        expect(Object.values(entry.cost), `${provider.id}/${entry.id}`).toEqual([0, 0, 0, 0]);
      }
    }
  });
});

describe("streamFor", () => {
  it("says which api is missing rather than failing silently", async () => {
    await expect(
      streamFor(model({ api: "mistral-conversations" }), { messages: [] }),
    ).rejects.toThrow("mistral-conversations");
  });
});
