// A preact `className` prop may arrive as a signal, which stringifies to its
// value — the same flattening clsx did before.
export type ClassValue = string | false | null | undefined | { toString: () => string };

/** Join class names. Falsy entries drop out; an empty result drops the attribute. */
export function cn(...inputs: ClassValue[]): string | undefined {
  return inputs.filter(Boolean).join(" ") || undefined;
}

/**
 * Whether a media query holds, now.
 *
 * One `MediaQueryList` per query, kept. Every `matchMedia()` call makes another
 * one, and each one the browser keeps alive is re-evaluated whenever the
 * viewport changes — which on a phone is constantly, and which the callers here
 * do often: `isTouch()` is read while rendering the composer, and
 * `prefersReducedMotion()` once per word of a streaming answer. The list stays
 * live, so `matches` is as fresh as a new call would have been.
 *
 * Keyed on `matchMedia` itself as well as on the query, so a test that stubs the
 * global gets a fresh set rather than the answers the last one gave.
 */
const queries = new Map<string, MediaQueryList | undefined>();
let source: unknown;

export function media(query: string): boolean {
  const match = globalThis.matchMedia;
  if (source !== match) {
    source = match;
    queries.clear();
  }
  if (!queries.has(query)) queries.set(query, match?.(query));
  return queries.get(query)?.matches ?? false;
}

/**
 * A finger rather than a mouse — every field the surface can focus takes `u.noZoom`
 * on one, so iOS does not scale the page in on focus.
 */
export function isTouch(): boolean {
  return media("(pointer: coarse)");
}

/**
 * A phone or a small tablet — the device itself, not a narrow surface.
 *
 * A coarse pointer alone is a touch display, which a laptop may also have. The
 * screen and NOT the viewport answers the rest: a phone is small because the
 * device is, while a surface can be small because it was docked — the
 * extension's side panel is ~400px on a desktop, and a chat in a page's sidebar
 * is no wider. Either would read as a phone through a `max-width` query.
 */
export function isPhone(): boolean {
  return isTouch() && (globalThis.screen?.width ?? Infinity) <= 820;
}
