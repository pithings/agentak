import { useEffect, useState } from "preact/hooks";

import { catalogModels } from "@/agent/models";
import { type AnyModel, findProvider } from "@/agent/providers";

export interface CatalogState {
  models: AnyModel[];
  loading: boolean;
  error?: string;
  /** Which provider these models are for. */
  providerId?: string;
}

/** One chunk per provider, fetched once for the life of the page. */
const cache = new Map<string, AnyModel[]>();

/** The models of one provider. Without one there is nothing to load. */
export function useCatalog(providerId?: string): CatalogState {
  const [state, setState] = useState<CatalogState>(() => ({
    models: (providerId && cache.get(providerId)) || [],
    loading: Boolean(providerId) && !cache.has(providerId as string),
    providerId,
  }));

  useEffect(() => {
    if (!providerId) {
      setState({ loading: false, models: [], providerId });
      return;
    }

    const cached = cache.get(providerId);
    if (cached) {
      setState({ loading: false, models: cached, providerId });
      return;
    }

    const provider = findProvider(providerId);
    if (!provider) {
      setState({
        error: `No provider named ${providerId}.`,
        loading: false,
        models: [],
        providerId,
      });
      return;
    }

    let live = true;
    setState({ loading: true, models: [], providerId });
    provider.load().then(
      (catalog) => {
        const models = catalogModels(catalog);
        cache.set(providerId, models);
        if (live) setState({ loading: false, models, providerId });
      },
      (error: unknown) => {
        if (live) {
          setState({
            error: error instanceof Error ? error.message : String(error),
            loading: false,
            models: [],
            providerId,
          });
        }
      },
    );

    return () => {
      live = false;
    };
  }, [providerId]);

  // The effect runs after the render that changed the provider, so the state
  // held here is one render stale. Report the load, never the last catalog.
  return state.providerId === providerId ? state : { loading: true, models: [], providerId };
}
