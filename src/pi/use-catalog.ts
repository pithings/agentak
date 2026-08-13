import { useEffect, useState } from "preact/hooks";

import { cachedCatalog, loadCatalog } from "@/pi/catalog";
import type { AnyModel } from "@/pi/providers";

export interface CatalogState {
  models: AnyModel[];
  loading: boolean;
  error?: string;
  /** Which provider these models are for. */
  providerId?: string;
}

/**
 * The models of one provider. Without one there is nothing to load.
 *
 * For a host driving `Chat` itself. `createPiSession` calls `loadCatalog`
 * directly, because it holds the choice rather than following it.
 */
export function useCatalog(providerId?: string): CatalogState {
  const [state, setState] = useState<CatalogState>(() => ({
    models: (providerId && cachedCatalog(providerId)) || [],
    loading: Boolean(providerId) && !(providerId && cachedCatalog(providerId)),
    providerId,
  }));

  useEffect(() => {
    if (!providerId) {
      setState({ loading: false, models: [], providerId });
      return;
    }

    const cached = cachedCatalog(providerId);
    if (cached) {
      setState({ loading: false, models: cached, providerId });
      return;
    }

    let live = true;
    setState({ loading: true, models: [], providerId });
    loadCatalog(providerId).then(
      (models) => {
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
