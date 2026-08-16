/**
 * The catalogs of the installed pi-ai, in place of esm.sh.
 *
 * A provider's `load()` imports a url, which node refuses and which would put
 * the network in the middle of a unit test. The installed copy is what these
 * tests are about anyway: a default model that no longer exists is caught at
 * the version this repo resolves, before `@latest` ever answers.
 *
 * This is the same seam a host uses to pin the models it ships — see
 * `useCatalogSource()` in `src/pi/providers.ts`.
 */

import { type CatalogSource, useCatalogSource } from "../src/pi/providers.ts";

const BUNDLED: Record<string, () => Promise<Record<string, unknown>>> = {
  cerebras: () => import("@earendil-works/pi-ai/providers/cerebras.models"),
  groq: () => import("@earendil-works/pi-ai/providers/groq.models"),
  openai: () => import("@earendil-works/pi-ai/providers/openai.models"),
  openrouter: () => import("@earendil-works/pi-ai/providers/openrouter.models"),
  "vercel-ai-gateway": () => import("@earendil-works/pi-ai/providers/vercel-ai-gateway.models"),
};

const bundled: CatalogSource = (module) => {
  const load = BUNDLED[module];
  if (!load) throw new Error(`No bundled catalog for ${module}.`);
  return load();
};

useCatalogSource(bundled);
