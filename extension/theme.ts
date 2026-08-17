// Docs: @docs/7.extension.md
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

/**
 * The three tokens the browser can answer better than we can.
 *
 * Chrome tells an extension nothing about its own shell — no theme api, and a
 * screenshot reaches the page and never the browser around it. The css system
 * colours are the one thing it does answer: `Canvas` is the colour it paints a
 * document, `CanvasText` the colour it writes on one, and `GrayText` the dimmed
 * text it draws against both. They are not the toolbar, so this is a near miss
 * and not a match — but a near miss picked by the browser beats a guess of ours,
 * and it holds under a theme we cannot read.
 *
 * **One block covers both schemes.** A system colour resolves against the used
 * `color-scheme`, and `followColorScheme()` has already put that on the root —
 * so `Canvas` is the light one or the dark one without a second rule, and it
 * turns over at dusk with everything else.
 *
 * The rest of the palette stays the library's. The greys are derived from these
 * three in the eye rather than in css, the status hues and the syntax colours
 * are fixed on purpose, and `--surface` and `--hover` already read `--background`
 * and `--accent`, so they follow this on their own.
 *
 * `:root:root` outranks both `:root` and `.dark`, so this wins wherever it lands
 * in the cascade — the library injects its tokens when the chat mounts, and that
 * is after this, not before.
 */
export function useSystemColors(): void {
  const style = document.createElement("style");
  style.textContent = `:root:root {
  --background: Canvas;
  --foreground: CanvasText;
  --muted-foreground: GrayText;
}`;
  document.head.append(style);
}
