import type { JSX } from "preact";

/**
 * A style object. Preact writes these straight onto `element.style`, so a
 * property is set on the element itself and outranks every rule in the sheet.
 *
 * That precedence is the whole constraint of this codebase's split: a property
 * belongs here only when nothing in `styles/` overrides it for the same element.
 * A property that a `::placeholder`, a `:last-child` or a descendant selector
 * re-declares has to stay in CSS, or the inline value would win and the rule
 * would never paint. `styles/sheet.tsx` documents what is left.
 */
export type Sx = JSX.CSSProperties;

/**
 * Component props with `style` narrowed to an object.
 *
 * Preact accepts a `style` string too, which cannot be merged with a style
 * object — the last one written would silently drop the other. Components take
 * the object form only, so `sx()` can fold a caller's style over their own.
 */
export type WithSx<T> = Omit<T, "style"> & { style?: Sx };

/**
 * Merge style objects, later wins. Falsy entries drop out, so a variant map can
 * be indexed inline.
 *
 * Order has to match the old sheet order: the base object first, then variants,
 * then the caller's own `style`. Cascade order used to do this; here it is the
 * argument order and nothing else.
 */
export function sx(...parts: (Sx | false | null | undefined)[]): Sx | undefined {
  let out: Sx | undefined;
  let cloned = false;
  for (const part of parts) {
    if (!part) continue;
    if (!out) {
      out = part; // The common case is one object — hand back the constant, no copy.
      continue;
    }
    if (!cloned) {
      out = { ...out };
      cloned = true;
    }
    Object.assign(out, part);
  }
  return out;
}
