import type { ComponentProps } from "preact";
import { cloneElement, toChildArray } from "preact";

import { isIconChild } from "../../lib/icons.tsx";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

const S = {
  badge: {
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: "0",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.25rem",
    overflow: "hidden",
    border: "1px solid transparent",
    borderRadius: "9999px",
    padding: "0.125rem 0.5rem",
    fontWeight: "500",
    lineHeight: "1rem",
    whiteSpace: "nowrap",
    fontSize: "0.75rem",
  },
  icon: { width: "0.75rem", height: "0.75rem", pointerEvents: "none" },
} satisfies Record<string, Sx>;

// Was a map of class names. `data-variant` is still on the element, so anything
// that needs to select a variant still can.
const VARIANTS = {
  default: { background: "var(--primary)", color: "var(--primary-foreground)" },
  secondary: { background: "var(--secondary)", color: "var(--secondary-foreground)" },
  destructive: { background: "var(--destructive)", color: "var(--destructive-foreground)" },
  outline: { borderColor: "var(--border)", color: "var(--foreground)" },
} satisfies Record<string, Sx>;

export type BadgeVariant = keyof typeof VARIANTS;

export type BadgeProps = WithSx<ComponentProps<"span">> & { variant?: BadgeVariant };

function Badge({ className, style, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={className}
      data-slot="badge"
      data-variant={variant}
      style={sx(S.badge, VARIANTS[variant], style)}
      {...props}
    >
      {toChildArray(children).map((child) =>
        isIconChild(child) ? cloneElement(child, { style: sx(S.icon, child.props.style) }) : child,
      )}
    </span>
  );
}

export { Badge };
