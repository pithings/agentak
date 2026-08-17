/**
 * Light and dark, for the side panel.
 *
 * The library ships both palettes and picks between them on one class: every
 * `--*` pair hangs off `.dark` on an ancestor. Which one is on is the host's
 * call, not the library's — a page may run a theme switch of its own, and the
 * playground does. The panel has no switch and needs none, so it follows the
 * browser, and keeps following it: `prefers-color-scheme` changes under a panel
 * that is already open, either because the person switched or because the
 * system did it at dusk.
 */
const QUERY = "(prefers-color-scheme: dark)";

/** Put the scheme on the root, and keep it there. Call before the first paint. */
export function followColorScheme(): void {
  const dark = globalThis.matchMedia?.(QUERY);
  if (!dark) return;

  const paint = () => document.documentElement.classList.toggle("dark", dark.matches);
  paint();
  dark.addEventListener("change", paint);
}
