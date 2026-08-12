import { ANTHROPIC_MODELS } from "@earendil-works/pi-ai/providers/anthropic.models";

import { type AnyModel, SUPPORTED_APIS } from "@/agent/providers";

export const DEFAULT_PROVIDER_ID = "vercel";
export const DEFAULT_MODEL_ID = "claude-sonnet-5";

/** A dated snapshot. The same model is listed under a rolling id as well. */
const DATED = /-\d{8}$/;

/** OpenRouter lists a batch variant of many models. It is not a chat endpoint. */
const BATCH = /:batch$/;

/**
 * A provider catalog, ready for the picker: no duplicates, no api this build
 * cannot speak, sorted by name because some catalogs hold hundreds.
 */
export function catalogModels(catalog: Record<string, AnyModel>): AnyModel[] {
  return Object.values(catalog)
    .filter(
      (model) =>
        SUPPORTED_APIS.includes(model.api) && !DATED.test(model.id) && !BATCH.test(model.id),
    )
    .map((model) => ({ ...model, name: model.name.replace(" (latest)", "") }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const findModel = (models: AnyModel[], id?: string): AnyModel | undefined =>
  models.find((model) => model.id === id);

/**
 * The default provider's catalog, imported rather than loaded, so an agent
 * exists before any chunk arrives. It is 5 KB; every other catalog is fetched.
 */
export const DEFAULT_MODELS = catalogModels(ANTHROPIC_MODELS);

export const DEFAULT_MODEL = findModel(DEFAULT_MODELS, DEFAULT_MODEL_ID) ?? DEFAULT_MODELS[0];
