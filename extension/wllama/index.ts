// Docs: @docs/7.extension.md
// Docs: @docs/4.agents/2.pi/3.on-device-models.md
/**
 * Local models, for the side panel.
 *
 * The library's default takes wllama and its wasm from a CDN, which is the one
 * thing an MV3 page may not do — so the row is left out of the picker there.
 * The panel ships all of it instead: the module through this import, the wasm
 * and the two workers beside the bundle. See `build.ts` for why a worker is
 * the hard half, and `../catalogs.ts`, which does the same for the catalogs.
 *
 * Saying so is what turns the row back on. A source of this build's own is the
 * gate: the library reads it as the host answering for its own document.
 */
import { useWllamaSource } from "@/pi/providers/local.ts";
import { ASSETS } from "./worker.ts";

/** Point the picker at the wllama this build carries. Call before the session. */
export function useLocalModels(): void {
  useWllamaSource({
    // The package names no entry that resolves, so the subpath is the one the
    // CDN url names too.
    module: () => import("@wllama/wllama/esm/index.js"),
    wasm: chrome.runtime.getURL(`${ASSETS}/wllama.wasm`),
  });
}
