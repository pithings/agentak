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

/** The models of one provider. */
export function useCatalog(providerId: string): CatalogState {
  const [state, setState] = useState<CatalogState>(() => ({
    models: cache.get(providerId) ?? [],
    loading: !cache.has(providerId),
  }));

  useEffect(() => {
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
