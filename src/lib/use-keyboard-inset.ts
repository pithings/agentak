// Docs: @docs/3.widget.md
import { useEffect, useState } from "preact/hooks";

import { isTouch } from "./utils.ts";

/** Below this, the difference is browser chrome or rounding, not a keyboard. */
const FLOOR = 24;

/**
 * How much of the layout viewport the virtual keyboard covers, in px.
 *
 * A phone keyboard does not reach every browser the same way. Where the page
 * asks for `interactive-widget=resizes-content` — and the browser honours it —
 * the layout viewport itself shrinks, a full-height surface is already above the
 * keyboard, and this is 0. Where it does not — iOS Safari — the layout viewport
 * keeps its height, the keyboard covers the foot of it, and a surface that
 * wants its composer visible has to lift that foot itself.
 *
 * `offsetTop` counts too: iOS scrolls the visual viewport over the layout one
 * rather than resizing it, which hides just as much again at the bottom.
 */
function measureInset(viewport: VisualViewport): number {
  const covered = globalThis.innerHeight - viewport.height - viewport.offsetTop;
  return covered > FLOOR ? Math.round(covered) : 0;
}

/**
 * Report the inset now, and again whenever it moves.
 *
 * Touch only. A desktop pinch shrinks the visual viewport the same way, and
 * there is no keyboard behind it to make room for. A browser without the visual
 * viewport reports nothing, and the caller keeps its 0.
 *
 * **Reported at most once a frame**, because on iOS this fires while the reader
 * is typing: the visual viewport is scrolled to follow the caret, so every few
 * characters move `offsetTop` by a pixel or two. Each reading also reads
 * `innerHeight`, which is a layout read, so an unthrottled listener did one per
 * keystroke. See `chat.tsx` for the other half of that — the surface takes this
 * as a custom property rather than as state, so a moved caret redraws nothing.
 */
export function watchKeyboardInset(report: (inset: number) => void): () => void {
  const viewport = globalThis.visualViewport;
  if (!viewport || !isTouch()) return () => {};

  let frame = 0;
  const read = () => {
    frame = 0;
    report(measureInset(viewport));
  };
  const later = () => {
    frame ||= globalThis.requestAnimationFrame(read);
  };

  viewport.addEventListener("resize", later);
  // The keyboard on iOS is a scroll, not a resize: the offset moves.
  viewport.addEventListener("scroll", later);
  read();

  return () => {
    globalThis.cancelAnimationFrame(frame);
    viewport.removeEventListener("resize", later);
    viewport.removeEventListener("scroll", later);
  };
}

/** The same reading as state, for a caller that lays itself out in js. */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => watchKeyboardInset(setInset), []);

  return inset;
}

/** An input a virtual keyboard opens for. Cross-document, so no `instanceof`. */
const NO_KEYBOARD = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isField(node: Element | null): boolean {
  if (!node) return false;
  if ((node as HTMLElement).isContentEditable) return true;
  if (node.tagName === "TEXTAREA") return true;
  return node.tagName === "INPUT" && !NO_KEYBOARD.has((node as HTMLInputElement).type);
}

/**
 * Whether a virtual keyboard is up. Touch only, false everywhere else.
 *
 * Two signals, because neither covers both kinds of browser. The inset is the
 * measured one and the better one, but it is 0 wherever the browser shrinks the
 * layout viewport for the keyboard itself — there is nothing left over to
 * measure. The focus is what is left: on a phone the only thing that opens a
 * keyboard is a field taking the focus, so a focused field means a keyboard,
 * whether or not it moved a viewport this code can see.
 *
 * Use it for what a keyboard costs rather than where it sits — `use-keyboard-inset`
 * is the one that answers where. A panel that should spend the room it has left
 * asks this; `chat/picker.tsx` is the first, for its model list and its key field.
 */
export function useKeyboardOpen(): boolean {
  const inset = useKeyboardInset();
  const [field, setField] = useState(false);

  useEffect(() => {
    const doc = globalThis.document;
    if (!doc || !isTouch()) return;

    let frame = 0;
    const read = () => setField(isField(doc.activeElement));
    // `focusout` lands before the next field has the focus, so a move from one
    // field to the next reads as no field at all — and anything measured
    // against it would collapse and grow back in the same breath. A frame later
    // the focus has landed, and one read serves both events.
    const later = () => {
      frame = globalThis.requestAnimationFrame(read);
    };

    doc.addEventListener("focusin", read, true);
    doc.addEventListener("focusout", later, true);
    read();

    return () => {
      globalThis.cancelAnimationFrame(frame);
      doc.removeEventListener("focusin", read, true);
      doc.removeEventListener("focusout", later, true);
    };
  }, []);

  return inset > 0 || field;
}
