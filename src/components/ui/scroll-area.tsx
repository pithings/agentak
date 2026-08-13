import type { ComponentProps } from "preact";

import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * Radix ships an overlay scrollbar with its own thumb geometry. This is the
 * minimum the components need: a styled overflow container on the native
 * scrollbar, so there is no measuring pass and no second renderer.
 */
const S = {
  scrollArea: {
    position: "relative",
    overflow: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: "var(--border) transparent",
  },
  // Were `--horizontal` / `--vertical` classes; `data-orientation` still carries
  // the choice for anything selecting on it.
  horizontal: { overflowX: "auto", overflowY: "hidden" },
  vertical: { overflowX: "hidden", overflowY: "auto" },
  both: undefined,
  // Merged last, so it wins over the scrollbar width above — argument order now
  // does what source order used to.
  bare: { scrollbarWidth: "none" },
} satisfies Record<string, Sx | undefined>;

export type ScrollAreaOrientation = "horizontal" | "vertical" | "both";

export type ScrollAreaProps = WithSx<ComponentProps<"div">> & {
  orientation?: ScrollAreaOrientation;
  /** Scroll, but draw no scrollbar. */
  hideScrollbar?: boolean;
};

function ScrollArea({
  className,
  orientation = "vertical",
  hideScrollbar = false,
  style,
  ...props
}: ScrollAreaProps) {
  return (
    <div
      className={className}
      data-orientation={orientation}
      data-slot="scroll-area"
      style={sx(S.scrollArea, S[orientation], hideScrollbar && S.bare, style)}
      {...props}
    />
  );
}

export { ScrollArea };
