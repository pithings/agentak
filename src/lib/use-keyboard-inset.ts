import { useEffect, useState } from "preact/hooks";

import { isTouch } from "@/lib/utils";

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
 *
 * Touch only. A desktop pinch shrinks the visual viewport the same way, and
 * there is no keyboard behind it to make room for.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = globalThis.visualViewport;
    if (!viewport || !isTouch()) return;

    const measure = () => {
      const covered = globalThis.innerHeight - viewport.height - viewport.offsetTop;
      setInset(covered > FLOOR ? Math.round(covered) : 0);
    };

    viewport.addEventListener("resize", measure);
    // The keyboard on iOS is a scroll, not a resize: the offset moves.
    viewport.addEventListener("scroll", measure);
    measure();

    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);

  return inset;
}
