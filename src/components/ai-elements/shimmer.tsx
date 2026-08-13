import type { JSX } from "preact";
import { useMemo } from "preact/hooks";

import { useAnimation } from "@/lib/use-animation";
import { reset } from "@/styles/base";
import { sx, type Sx } from "@/styles/sx";

// A gradient swept across clipped text — what `motion` animated before, then
// `@keyframes shimmer`. Both `background-position` stops were already
// explicit, so the WAAPI frames below are a direct translation — see
// `useAnimation()`.
const SHIMMER_FRAMES: Keyframe[] = [
  { backgroundPosition: "100% center", offset: 0 },
  { backgroundPosition: "0% center", offset: 1 },
];

const S = {
  shimmer: {
    position: "relative",
    display: "inline-block",
    backgroundImage:
      "linear-gradient( 90deg, transparent calc(50% - var(--shimmer-spread)), var(--background), transparent calc(50% + var(--shimmer-spread)) ), linear-gradient(var(--muted-foreground), var(--muted-foreground))",
    backgroundSize: "250% 100%, auto",
    backgroundRepeat: "no-repeat, padding-box",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },
} satisfies Record<string, Sx>;

export interface ShimmerProps {
  children: string;
  as?: "p" | "span" | "div";
  className?: string;
  style?: Sx;
  /** Seconds per sweep. */
  duration?: number;
  /** Highlight width, multiplied by the text length. */
  spread?: number;
}

export const Shimmer = ({
  children,
  as: Tag = "p",
  className,
  style,
  duration = 2,
  spread = 2,
}: ShimmerProps) => {
  const options = useMemo<KeyframeAnimationOptions>(
    () => ({ duration: duration * 1000, easing: "linear", iterations: Infinity }),
    [duration],
  );
  const ref = useAnimation<HTMLElement>(SHIMMER_FRAMES, options);

  return (
    <Tag
      className={className}
      data-slot="shimmer"
      ref={ref}
      style={sx(
        // `Tag` picks the host element, so the preset only applies for "p" —
        // the reset never reaches a tag this component didn't actually render.
        Tag === "p" && reset.text,
        S.shimmer,
        { "--shimmer-spread": `${(children?.length ?? 0) * spread}px` } as JSX.CSSProperties,
        style,
      )}
    >
      {children}
    </Tag>
  );
};
