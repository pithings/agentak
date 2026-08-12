import { describe, expect, it } from "vitest";

import { catalogModels, DEFAULT_MODEL, findModel } from "@/agent/models";
import {
  type AnyModel,
  findProvider,
  PROVIDERS,
  streamFor,
  SUPPORTED_APIS,
} from "@/agent/providers";

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

  it("opens on Anthropic, and finds a provider by id", () => {
    expect(DEFAULT_MODEL.provider).toBe("anthropic");
    expect(findProvider("openrouter")?.gateway).toBe(true);
    expect(findProvider("nope")).toBeUndefined();
  });
});

describe("streamFor", () => {
  it("says which api is missing rather than failing silently", async () => {
    await expect(
      streamFor(model({ api: "mistral-conversations" }), { messages: [] }),
    ).rejects.toThrow("mistral-conversations");
  });
});
