import { useCallback, useEffect, useRef, useState } from "preact/hooks";

/** Distance from the bottom, in px, still counted as "at the bottom". */
const THRESHOLD = 32;

/**
 * Keeps a scroll container pinned to its newest content, and releases the pin
 * as soon as the user scrolls up. Replaces `use-stick-to-bottom`, which is
 * React-only.
 *
 * `follow` is what the region has to follow. Off, growing content no longer
 * pulls the view down — an empty transcript has no newest message, so it reads
 * from the top like any other page. `scrollToBottom` still works: it is the
 * reader asking.
 */
export function useStickToBottom(follow = true) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  // Mirrors isAtBottom for the scroll and observer callbacks, which must not re-subscribe.
  const stickRef = useRef(true);
  const lastTop = useRef(0);

  const stick = useCallback((next: boolean) => {
    stickRef.current = next;
    setIsAtBottom(next);
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      stick(true);
      // jsdom has no scrollTo.
      el.scrollTo?.({ behavior, top: el.scrollHeight });
    },
    [stick],
  );

  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;

    const sync = () => {
      const top = el.scrollTop;
      const atBottom = el.scrollHeight - top - el.clientHeight <= THRESHOLD;
      // Following always moves down, so an upward move is the reader's. Reading
      // the pin off the position alone would drop it while a follow is in
      // flight, or while new content sits below the fold.
      if (atBottom) stick(true);
      else if (top < lastTop.current) stick(false);
      lastTop.current = top;
    };

    el.addEventListener("scroll", sync, { passive: true });
    sync();

    if (typeof ResizeObserver === "undefined") {
      return () => el.removeEventListener("scroll", sync);
    }

    // Instant, not smooth: tokens arrive faster than an animation settles.
    const observer = new ResizeObserver(() => {
      if (follow && stickRef.current) el.scrollTo({ behavior: "auto", top: el.scrollHeight });
    });
    observer.observe(content);

    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [follow, stick]);

  return { contentRef, isAtBottom, scrollRef, scrollToBottom };
}
