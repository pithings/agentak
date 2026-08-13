import { useEffect, useState } from "preact/hooks";

import { catalogModels } from "@/agent/models";
import { type AnyModel, findProvider } from "@/agent/providers";

export interface CatalogState {
  models: AnyModel[];
  loading: boolean;
  error?: string;
}

/** One chunk per provider, fetched once for the life of the page. */
const cache = new Map<string, AnyModel[]>();

/** The models of one provider. Without one there is nothing to load. */
export function useCatalog(providerId?: string): CatalogState {
  const [state, setState] = useState<CatalogState>(() => ({
    models: (providerId && cache.get(providerId)) || [],
    loading: Boolean(providerId) && !cache.has(providerId as string),
  }));

  useEffect(() => {
    if (!providerId) {
      setState({ models: [], loading: false });
      return;
    }

    const cached = cache.get(providerId);
    if (cached) {
      setState({ models: cached, loading: false });
      return;
    }

    const provider = findProvider(providerId);
    if (!provider) {
      setState({ models: [], loading: false, error: `No provider named ${providerId}.` });
      return;
    }

    let live = true;
    setState({ models: [], loading: true });
    provider.load().then(
      (catalog) => {
        const models = catalogModels(catalog);
        cache.set(providerId, models);
        if (live) setState({ models, loading: false });
      },
      (error: unknown) => {
        if (live) {
          setState({
            models: [],
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );

    return () => {
      live = false;
    };
  }, [providerId]);

  return state;
}
