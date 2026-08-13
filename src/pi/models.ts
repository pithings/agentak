import { LLM7_MODELS } from "@/pi/free-models";
import { type AnyModel, SUPPORTED_APIS } from "@/pi/providers";

/** A keyless provider, so a fresh page can answer before anyone is asked for a key. */
export const DEFAULT_PROVIDER_ID = "llm7";
export const DEFAULT_MODEL_ID = "gemini-3.1-flash-lite";

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
 * exists before any chunk arrives. The free catalogs are written here and cost
 * a couple of KB together; every vendor catalog is fetched.
 */
export const DEFAULT_MODELS = catalogModels(LLM7_MODELS);

export const DEFAULT_MODEL = findModel(DEFAULT_MODELS, DEFAULT_MODEL_ID) ?? DEFAULT_MODELS[0];
