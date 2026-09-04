import type { ComponentProps } from "preact";

import { useAnimation } from "../../lib/use-animation.ts";
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
} satisfies Record<string, Sx>;

export type ProgressProps = Omit<WithSx<ComponentProps<"div">>, "value" | "max" | "label"> & {
  /** Where the bar stands, out of `max`. Omitted, the bar is indeterminate. */
  value?: number;
  max?: number;
  /** The words above the bar, and its accessible name. */
  label?: string;
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
  children,
  ...props
}: ProgressProps) {
  const sweep = useAnimation<HTMLDivElement>(SWEEP_FRAMES, SWEEP_OPTIONS);

  const known = value !== undefined && Number.isFinite(value) && max > 0;
  const percent = known ? Math.min(FULL, Math.max(0, Math.round((value / max) * FULL))) : undefined;
  // A bar with neither a name nor a reading is the track alone.
  const titled = children !== undefined || label !== undefined || known;

  return (
    <div className={className} data-slot="progress" style={sx(S.progress, style)} {...props}>
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
