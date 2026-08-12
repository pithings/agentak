import { base } from "@/styles/base";

import { inputStyles } from "@/components/ui/input";
import { commandStyles } from "@/components/ui/command";

/**
 * All that is left of the stylesheet, in cascade order: `styles/base.ts` first —
 * the tokens, the `.dark` overrides, `:host`, and the `box-sizing` rule that
 * applies to every element — then the two component blocks below.
 *
 * A component's styling is an inline style object now; see the Styling section
 * of AGENTS.md. Only one justification is left for a block: a pseudo-element is
 * a box of its own, so nothing put on the element is even in the running. Every
 * other rule was reachable from the element, a prop, or a cloned child, and has
 * gone inline. These are all of them:
 *
 * - `ui/input.tsx` — `::placeholder` and `::selection`.
 * - `ui/command.tsx` — `::placeholder`, same as the input.
 *
 * The list is explicit because module evaluation order is not a contract — it
 * changes with the entry point and with how a bundler splits chunks, so a
 * server and a browser would otherwise build different sheets from the same
 * source.
 *
 * There are no compound selectors left here, and no component overrides another
 * through the sheet. To override a primitive, pass the value as `style`: `sx()`
 * merges caller-last, so the wrapper's object wins over the primitive's own
 * (`<Badge style={S.result} />`). A class cannot — the primitive's value is
 * inline, and inline outranks every rule.
 */
const BLOCKS = [base, inputStyles, commandStyles];

/** Marks a root that already carries the sheet, server-rendered or not. */
const MARKER = "data-wa-styles";

const TEXT = BLOCKS.join("\n");

/** The whole stylesheet. Pure — same string everywhere, no DOM needed. */
export function styleText(): string {
  return TEXT;
}

/**
 * The sheet as markup. Use this on any path that renders to a string: it is
 * part of the tree, so a server and its client render the same thing.
 *
 * Use either this or `adoptStyles`, not both — though both check the marker,
 * so a mix costs nothing but a duplicate constructable sheet.
 */
export function Style() {
  return <style {...{ [MARKER]: "" }}>{TEXT}</style>;
}

let sheet: CSSStyleSheet | undefined;

/**
 * Put the stylesheet into a document or a shadow root. Browser only — call it
 * after mount, never during render.
 *
 * Constructable sheets are shared between roots; the `<style>` path covers
 * engines without them.
 */
export function adoptStyles(root: Document | ShadowRoot): void {
  if (root.querySelector(`[${MARKER}]`)) return; // Already there, likely from SSR.

  try {
    sheet ??= new CSSStyleSheet();
    if (sheet.cssRules.length === 0) sheet.replaceSync(TEXT);
    if (root.adoptedStyleSheets.includes(sheet)) return;
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return;
  } catch {
    // No constructable stylesheets — fall through.
  }

  const document = root instanceof Document ? root : root.ownerDocument;
  const style = document.createElement("style");
  style.setAttribute(MARKER, "");
  style.textContent = TEXT;
  (root instanceof Document ? root.head : root).append(style);
}
