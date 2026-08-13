import { catalogModels } from "@/pi/models";
import { type AnyModel, findProvider } from "@/pi/providers";

/** One chunk per provider, fetched once for the life of the page. */
const cache = new Map<string, AnyModel[]>();

/** What is already in hand, so a provider picked twice loads nothing. */
export const cachedCatalog = (providerId: string): AnyModel[] | undefined => cache.get(providerId);

/**
 * The models of one provider, ready for the picker.
 *
 * Rejects for a provider this build does not carry, which is the one failure the
 * caller shows — a fetch that fails rejects with its own message.
 */
export async function loadCatalog(providerId: string): Promise<AnyModel[]> {
  const cached = cache.get(providerId);
  if (cached) return cached;

  const provider = findProvider(providerId);
  if (!provider) throw new Error(`No provider named ${providerId}.`);

  const models = catalogModels(await provider.load());
  cache.set(providerId, models);
  return models;
}
