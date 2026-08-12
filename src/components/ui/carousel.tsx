import type { ComponentProps, RefObject } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { ArrowLeftIcon, ArrowRightIcon } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * Replaces `embla-carousel-react`. The browser does the paging: one scroll-snap
 * track, buttons that call `scrollTo`, and a scroll listener that reports which
 * slide is nearest. No drag handler, no autoplay, no plugins, one axis only.
 */
const S = {
  carousel: { position: "relative" },
  // position: relative makes the track the offset parent of its slides, so
  // scrollTo can use offsetLeft.
  track: {
    position: "relative",
    display: "flex",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    scrollBehavior: "smooth",
    scrollbarWidth: "none",
  },
  item: { flex: "0 0 100%", minWidth: "0", scrollSnapAlign: "start" },
  button: {
    display: "inline-flex",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--wa-radius-sm)",
    transition: "color var(--wa-transition)",
    color: "var(--wa-muted-foreground)",
  },
  buttonHover: { color: "var(--wa-foreground)" },
  buttonDisabled: { opacity: "0.5", cursor: "not-allowed" },
  index: {
    color: "var(--wa-muted-foreground)",
    fontSize: "0.75rem",
    fontVariantNumeric: "tabular-nums",
  },
} satisfies Record<string, Sx>;

/** ms of quiet before a scroll is read as settled. */
const SETTLE = 80;

interface CarouselContextValue {
  /** Index of the slide in view, from 0. */
  current: number;
  count: number;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  scrollTo: (index: number) => void;
  scrollPrev: () => void;
  scrollNext: () => void;
  trackRef: RefObject<HTMLDivElement>;
  /** Called by the track after every render: count the slides. */
  syncCount: () => void;
  onTrackScroll: () => void;
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

/** Read the carousel a part belongs to — the equivalent of embla's `api`. */
export function useCarousel(part: string) {
  const context = useContext(CarouselContext);
  if (!context) throw new Error(`${part} must be used within Carousel`);
  return context;
}

export type CarouselProps = WithSx<ComponentProps<"div">>;

function Carousel({ className, style, ...props }: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [count, setCount] = useState(0);
  const [current, setCurrent] = useState(0);

  const syncCount = useCallback(() => {
    const track = trackRef.current;
    if (track) setCount(track.children.length);
  }, []);

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current;
    const item = track?.children[index] as HTMLElement | undefined;
    if (!track || !item) return;

    // Optimistic: the readout must not wait out the smooth scroll, and the
    // nearest slide is still the old one for half of it.
    setCurrent(index);
    if (typeof track.scrollTo === "function") track.scrollTo({ left: item.offsetLeft });
    else track.scrollLeft = item.offsetLeft;
  }, []);

  // Debounced, so a smooth scroll reports once it lands rather than at every
  // frame it passes through.
  const onTrackScroll = useCallback(() => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;

      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (const [index, item] of [...track.children].entries()) {
        const distance = Math.abs((item as HTMLElement).offsetLeft - track.scrollLeft);
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      }
      setCurrent(nearest);
    }, SETTLE);
  }, []);

  useEffect(() => () => clearTimeout(settle.current), []);

  const context = useMemo(
    () => ({
      canScrollNext: current < count - 1,
      canScrollPrev: current > 0,
      count,
      current,
      onTrackScroll,
      scrollNext: () => scrollTo(current + 1),
      scrollPrev: () => scrollTo(current - 1),
      scrollTo,
      syncCount,
      trackRef,
    }),
    [count, current, onTrackScroll, scrollTo, syncCount],
  );

  return (
    <CarouselContext.Provider value={context}>
      <div
        aria-roledescription="carousel"
        className={className}
        data-slot="carousel"
        role="region"
        style={sx(S.carousel, style)}
        {...props}
      />
    </CarouselContext.Provider>
  );
}

export type CarouselContentProps = WithSx<ComponentProps<"div">>;

function CarouselContent({ className, onScroll, style, ...props }: CarouselContentProps) {
  const { trackRef, syncCount, onTrackScroll } = useCarousel("CarouselContent");

  // No dependency list: the slide count follows the children, and counting is
  // one property read.
  useEffect(syncCount);

  return (
    <div
      className={className}
      data-slot="carousel-content"
      style={sx(S.track, style)}
      onScroll={(event) => {
        onScroll?.(event);
        onTrackScroll();
      }}
      ref={trackRef}
      {...props}
    />
  );
}

export type CarouselItemProps = WithSx<ComponentProps<"div">>;

function CarouselItem({ className, style, ...props }: CarouselItemProps) {
  return (
    <div
      aria-roledescription="slide"
      className={className}
      data-slot="carousel-item"
      role="group"
      style={sx(S.item, style)}
      {...props}
    />
  );
}

export type CarouselButtonProps = WithSx<ComponentProps<"button">>;

function CarouselPrevious({ className, children, onClick, style, ...props }: CarouselButtonProps) {
  const { canScrollPrev, scrollPrev } = useCarousel("CarouselPrevious");
  const disabled = !canScrollPrev;
  const { hovered, handlers } = useInteraction(props);

  return (
    <button
      aria-label="Previous"
      className={className}
      data-slot="carousel-previous"
      style={sx(
        reset.button,
        S.button,
        hovered && !disabled && S.buttonHover,
        disabled && S.buttonDisabled,
        style,
      )}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) scrollPrev();
      }}
      type="button"
      {...props}
      {...handlers}
    >
      {children ?? <ArrowLeftIcon style={u.icon} />}
    </button>
  );
}

function CarouselNext({ className, children, onClick, style, ...props }: CarouselButtonProps) {
  const { canScrollNext, scrollNext } = useCarousel("CarouselNext");
  const disabled = !canScrollNext;
  const { hovered, handlers } = useInteraction(props);

  return (
    <button
      aria-label="Next"
      className={className}
      data-slot="carousel-next"
      style={sx(
        reset.button,
        S.button,
        hovered && !disabled && S.buttonHover,
        disabled && S.buttonDisabled,
        style,
      )}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) scrollNext();
      }}
      type="button"
      {...props}
      {...handlers}
    >
      {children ?? <ArrowRightIcon style={u.icon} />}
    </button>
  );
}

export type CarouselIndexProps = WithSx<ComponentProps<"div">>;

/** Position readout, 1-based. `children` replaces the default text. */
function CarouselIndex({ className, children, style, ...props }: CarouselIndexProps) {
  const { count, current } = useCarousel("CarouselIndex");

  return (
    <div
      aria-live="polite"
      className={className}
      data-slot="carousel-index"
      style={sx(S.index, style)}
      {...props}
    >
      {children ?? `${count === 0 ? 0 : current + 1}/${count}`}
    </div>
  );
}

export { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, CarouselIndex };
