import type { ComponentChildren, ComponentProps, JSX } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useMemo } from "preact/hooks";

import { useControllableState } from "@/lib/use-controllable-state";
import { useInteraction } from "@/lib/use-interaction";
import { reset } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";
// Aliased — the component below has the same name as the type.
import type { TranscriptionSegment as Segment } from "@/types";

/** `data-past` and `data-active` carry the segment state for anything reading it. */
const S = {
  transcription: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.25rem",
    fontSize: "0.875rem",
    lineHeight: "1.625",
  },
  segment: {
    display: "inline",
    color: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
    cursor: "default",
    textAlign: "left",
    transition: "color var(--transition)",
  },
  segmentPast: {
    color: "var(--muted-foreground)",
  },
  segmentActive: {
    color: "var(--primary)",
  },
  segmentSeekable: {
    cursor: "pointer",
  },
  // The old rule was `:hover` on top of the base/`--past`/`--active` color —
  // its pseudo-class specificity always outranked those single-class rules,
  // so it applies last here too, regardless of which of the two it follows.
  segmentSeekableHover: {
    color: "var(--foreground)",
  },
} satisfies Record<string, Sx>;

interface TranscriptionContextValue {
  segments: Segment[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek?: (time: number) => void;
}

const TranscriptionContext = createContext<TranscriptionContextValue | null>(null);

const useTranscription = () => {
  const context = useContext(TranscriptionContext);
  if (!context) {
    throw new Error("Transcription components must be used within Transcription");
  }
  return context;
};

export type TranscriptionProps = WithSx<Omit<ComponentProps<"div">, "children">> & {
  segments: Segment[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  /** Renders one segment. Defaults to `TranscriptionSegment`. */
  children?: (segment: Segment, index: number) => ComponentChildren;
};

const defaultRenderSegment = (segment: Segment, index: number) => (
  <TranscriptionSegment index={index} key={index} segment={segment} />
);

export const Transcription = ({
  segments,
  currentTime: externalCurrentTime,
  onSeek,
  className,
  style,
  children = defaultRenderSegment,
  ...props
}: TranscriptionProps) => {
  const [currentTime, setCurrentTime] = useControllableState({
    defaultProp: 0,
    onChange: onSeek,
    prop: externalCurrentTime,
  });

  const contextValue = useMemo(
    () => ({ currentTime, onSeek, onTimeUpdate: setCurrentTime, segments }),
    [currentTime, onSeek, setCurrentTime, segments],
  );

  return (
    <TranscriptionContext.Provider value={contextValue}>
      <div
        className={className}
        data-slot="transcription"
        style={sx(S.transcription, style)}
        {...props}
      >
        {segments
          .filter((segment) => segment.text.trim())
          .map((segment, index) => children(segment, index))}
      </div>
    </TranscriptionContext.Provider>
  );
};

export type TranscriptionSegmentProps = WithSx<ComponentProps<"button">> & {
  segment: Segment;
  index: number;
};

export const TranscriptionSegment = ({
  segment,
  index,
  className,
  style,
  onClick,
  ...props
}: TranscriptionSegmentProps) => {
  const { currentTime, onSeek } = useTranscription();

  const isActive = currentTime >= segment.startSecond && currentTime < segment.endSecond;
  const isPast = currentTime >= segment.endSecond;
  const { hovered, handlers } = useInteraction<HTMLButtonElement>(props);

  const handleClick = useCallback(
    (event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
      onSeek?.(segment.startSecond);
      onClick?.(event);
    },
    [onSeek, segment.startSecond, onClick],
  );

  return (
    <button
      className={className}
      data-active={isActive}
      data-index={index}
      data-past={isPast}
      data-slot="transcription-segment"
      onClick={handleClick}
      style={sx(
        reset.button,
        S.segment,
        isPast && S.segmentPast,
        isActive && S.segmentActive,
        onSeek && S.segmentSeekable,
        onSeek && hovered && S.segmentSeekableHover,
        style,
      )}
      type="button"
      {...props}
      {...handlers}
    >
      {segment.text}
    </button>
  );
};
