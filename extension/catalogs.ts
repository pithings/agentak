// Docs: @docs/7.extension.md
/**
 * The model catalogs, for the side panel.
 *
 * A page reads them from esm.sh, so a model published after the build is still
 * offered and no json ships. The panel cannot: an MV3 content security policy
 * allows no remote module, and every keyed provider would list nothing at all.
 * So the panel ships the catalogs of the pi-ai it was built against — pinned by
 * the lockfile, and as old as the build.
 *
 * One `import()` per provider, written out rather than built from the name: a
 * bundler follows a literal and nothing else, and each one is its own chunk, so
 * a catalog is still only read when its provider is picked. OpenRouter's alone
 * is 136 KB.
 *
 * Only the two keyed gateways are here. The free ones carry their models in
 * `pi/free-models.ts`, which the panel already bundles.
 */
import { useCatalogSource } from "@/pi/providers.ts";

type Module = Promise<Record<string, unknown>>;

const CATALOGS: Record<string, () => Module> = {
  openrouter: () => import("@earendil-works/pi-ai/providers/openrouter.models"),
  "vercel-ai-gateway": () => import("@earendil-works/pi-ai/providers/vercel-ai-gateway.models"),
};

/** Point the picker at the bundled catalogs. Call once, before the session. */
export function useBundledCatalogs(): void {
  useCatalogSource((module) => {
    const load = CATALOGS[module];
    if (!load) return Promise.reject(new Error(`The panel ships no ${module} catalog.`));
    return load();
  });
}
