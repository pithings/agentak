import type { ComponentProps } from "preact";

import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  // `flexShrink` is a resting value a caller may replace. It is written before
  // the caller's `style`, so `<Separator style={{ flex: "1" }}/>` (checkpoint.tsx)
  // still wins — `flex` is a shorthand, and it is written second.
  separator: { flexShrink: "0", background: "var(--wa-border)" },
  // Were `[data-orientation]` rules. The component knows the orientation, so it
  // picks the box itself; the attribute stays for anything selecting on it.
  horizontal: { width: "100%", height: "1px" },
  vertical: { width: "1px", height: "100%" },
} satisfies Record<string, Sx>;

export type SeparatorProps = WithSx<ComponentProps<"div">> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
};

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  style,
  ...props
}: SeparatorProps) {
  return (
    <div
      aria-orientation={decorative ? undefined : orientation}
      className={className}
      data-orientation={orientation}
      data-slot="separator"
      role={decorative ? "none" : "separator"}
      style={sx(S.separator, S[orientation], style)}
      {...props}
    />
  );
}

export { Separator };
