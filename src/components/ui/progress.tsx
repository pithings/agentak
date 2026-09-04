import type { ComponentProps } from "preact";
import { useEffect, useState } from "preact/hooks";

import { prefersReducedMotion, useAnimation } from "../../lib/use-animation.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

// The bar with no reading behind it: a short fill swept across the track,
// starting and ending outside it. `translateX` is of the fill's own width, so
// a quarter-wide fill travels the track in four of them. Reduced motion, or
// jsdom, leaves the resting frame — a fill at the head of the track, which is
// where a bar of unknown length has always sat.
const SWEEP_FRAMES: Keyframe[] = [
  { transform: "translateX(-100%)" },
  { transform: "translateX(400%)" },
];
const SWEEP_OPTIONS: KeyframeAnimationOptions = {
  duration: 1600,
  easing: "ease-in-out",
  iterations: Infinity,
};

const FULL = 100;

/**
 * How long a full bar is left on screen before it goes, and how long it takes
 * to fade. The rest is the delay `Reasoning` closes a finished thinking block
 * after: long enough to read as finished, short enough not to be waited on.
 */
const REST_MS = 1000;
const FADE_MS = 300;

const S = {
  progress: {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    gap: "0.375rem",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // The label yields the row, so a long one is cut rather than pushing the
  // reading off the end.
  label: { minWidth: "0px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  value: { flexShrink: "0", fontVariantNumeric: "tabular-nums" },
  track: {
    display: "flex",
    height: "0.5rem",
    overflow: "hidden",
    borderRadius: "9999px",
    background: "var(--muted)",
  },
  fill: {
    borderRadius: "9999px",
    background: "var(--primary)",
    transition: "width var(--transition)",
  },
  sweep: { width: "25%" },
  leaving: { opacity: "0", transition: `opacity ${FADE_MS}ms ease` },
} satisfies Record<string, Sx>;

export type ProgressProps = Omit<WithSx<ComponentProps<"div">>, "value" | "max" | "label"> & {
  /** Where the bar stands, out of `max`. Omitted, the bar is indeterminate. */
  value?: number;
  max?: number;
  /** The words above the bar, and its accessible name. */
  label?: string;
  /**
   * A full bar has nothing left to report: it fades and goes. A bar that is
   * already full when it mounts — a finished download read back out of a
   * stored conversation — never appears at all.
   */
  hideWhenDone?: boolean;
};

/**
 * A bar, with the reading beside its label.
 *
 * Not `<progress>`: that element is only styled through vendor pseudo-elements,
 * and this library has no stylesheet to write them in.
 */
function Progress({
  className,
  style,
  value,
  max = FULL,
  label,
  hideWhenDone = false,
  children,
  ...props
}: ProgressProps) {
  const sweep = useAnimation<HTMLDivElement>(SWEEP_FRAMES, SWEEP_OPTIONS);

  const known = value !== undefined && Number.isFinite(value) && max > 0;
  const percent = known ? Math.min(FULL, Math.max(0, Math.round((value / max) * FULL))) : undefined;
  // A bar with neither a name nor a reading is the track alone.
  const titled = children !== undefined || label !== undefined || known;

  const done = hideWhenDone && percent === FULL;
  // The first render answers for the whole life of this bar: full on arrival is
  // a bar nobody watched fill, so there is no leaving to see.
  const [gone, setGone] = useState(done);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!done || gone) return;

    const fade = prefersReducedMotion() ? 0 : FADE_MS;
    const starts = setTimeout(() => setLeaving(true), REST_MS);
    const ends = setTimeout(() => setGone(true), REST_MS + fade);

    return () => {
      clearTimeout(starts);
      clearTimeout(ends);
    };
  }, [done, gone]);

  if (gone) return null;

  return (
    <div
      className={className}
      data-slot="progress"
      data-state={leaving ? "leaving" : "open"}
      style={sx(S.progress, leaving && S.leaving, style)}
      {...props}
    >
      {titled && (
        <div style={S.row}>
          {children ?? <span style={S.label}>{label}</span>}
          {percent !== undefined && <span style={S.value}>{percent}%</span>}
        </div>
      )}
      <div
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={known ? value : undefined}
        data-slot="progress-track"
        role="progressbar"
        style={S.track}
      >
        <div
          data-slot="progress-fill"
          ref={known ? undefined : sweep}
          style={sx(S.fill, known ? { width: `${percent}%` } : S.sweep)}
        />
      </div>
    </div>
  );
}

export { Progress };
