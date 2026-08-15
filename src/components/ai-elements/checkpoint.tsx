import type { ComponentProps } from "preact";

import { Button, type ButtonProps } from "../ui/button.tsx";
import { Separator } from "../ui/separator.tsx";
import { BookmarkIcon, type IconProps } from "../../lib/icons.tsx";
import { u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

const S = {
  // Stretches the separator this component renders. `sx()` in separator.tsx
  // merges a caller's style last, so this replaces its resting `flex-shrink`.
  separator: { flex: "1" },
  checkpoint: {
    display: "flex",
    alignItems: "center",
    gap: "0.125rem",
    overflow: "hidden",
    color: "var(--muted-foreground)",
  },
} satisfies Record<string, Sx>;

export type CheckpointProps = WithSx<ComponentProps<"div">>;

export const Checkpoint = ({ className, children, style, ...props }: CheckpointProps) => (
  <div className={className} style={sx(S.checkpoint, style)} {...props}>
    {children}
    <Separator style={S.separator} />
  </div>
);

export type CheckpointIconProps = WithSx<IconProps>;

export const CheckpointIcon = ({ className, children, style, ...props }: CheckpointIconProps) => (
  <>{children ?? <BookmarkIcon className={className} style={sx(u.icon, style)} {...props} />}</>
);

export type CheckpointTriggerProps = ButtonProps & { tooltip?: string };

/** Tooltips are dropped in this project — the hint is the native `title`. */
export const CheckpointTrigger = ({
  variant = "ghost",
  size = "sm",
  tooltip,
  ...props
}: CheckpointTriggerProps) => (
  <Button size={size} title={tooltip} type="button" variant={variant} {...props} />
);
