import type { ComponentProps } from "preact";
import { cloneElement, toChildArray } from "preact";

import { isIconChild } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { reset } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * The states are `useInteraction` and the `disabled` / `aria-invalid` props, and
 * the icon size and the icon padding are a walk over the children — see
 * `buttonSx`.
 */
const S = {
  btn: {
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    border: "1px solid transparent",
    borderRadius: "var(--wa-radius-md)",
    fontSize: "0.875rem",
    fontWeight: "500",
    lineHeight: "1.25rem",
    whiteSpace: "nowrap",
    outline: "none",
    transition:
      "background-color var(--wa-transition), border-color var(--wa-transition), color var(--wa-transition), box-shadow var(--wa-transition)",
  },
  focus: { borderColor: "var(--wa-ring)", boxShadow: "var(--wa-focus-ring)" },
  disabled: { pointerEvents: "none", opacity: "0.5" },
  invalid: { borderColor: "var(--wa-destructive)", boxShadow: "var(--wa-invalid-ring)" },
  icon: { width: "1rem", height: "1rem", pointerEvents: "none" },
  iconXs: { width: "0.75rem", height: "0.75rem", pointerEvents: "none" },
} satisfies Record<string, Sx>;

/** A variant is its resting style plus what each state repaints over it. */
interface Variant {
  sx?: Sx;
  hover?: Sx;
  focus?: Sx;
}

/**
 * `iconPad` was `:has(> svg)` and `glyph` was `.wa-btn--size-xs > svg`. Both
 * read the children, which `Button` now walks itself.
 */
interface Size {
  sx: Sx;
  iconPad?: Sx;
  glyph?: Sx;
}

// `data-variant` is still on the element, so anything that needs to select a
// variant from outside still can.
const VARIANTS = {
  default: {
    sx: { background: "var(--wa-primary)", color: "var(--wa-primary-foreground)" },
    hover: { background: "color-mix(in oklab, var(--wa-primary) 90%, transparent)" },
  },
  destructive: {
    sx: { background: "var(--wa-destructive)", color: "var(--wa-destructive-foreground)" },
    hover: { background: "color-mix(in oklab, var(--wa-destructive) 90%, transparent)" },
    focus: { boxShadow: "0 0 0 3px color-mix(in oklab, var(--wa-destructive) 20%, transparent)" },
  },
  outline: {
    sx: {
      borderColor: "var(--wa-input)",
      background: "var(--wa-surface)",
      boxShadow: "var(--wa-shadow-xs)",
    },
    hover: { background: "var(--wa-surface-hover)", color: "var(--wa-hover-foreground)" },
  },
  secondary: {
    sx: { background: "var(--wa-secondary)", color: "var(--wa-secondary-foreground)" },
    hover: { background: "color-mix(in oklab, var(--wa-secondary) 80%, transparent)" },
  },
  ghost: { hover: { background: "var(--wa-hover)", color: "var(--wa-hover-foreground)" } },
  link: {
    sx: { color: "var(--wa-primary)", textUnderlineOffset: "4px" },
    hover: { textDecoration: "underline" },
  },
} satisfies Record<string, Variant>;

const SIZES = {
  default: {
    sx: { boxSizing: "border-box", height: "2.25rem", padding: "0.5rem 1rem" },
    iconPad: { padding: "0.5rem 0.75rem" },
  },
  xs: {
    sx: {
      boxSizing: "border-box",
      height: "1.5rem",
      gap: "0.25rem",
      paddingInline: "0.5rem",
      fontSize: "0.75rem",
    },
    iconPad: { paddingInline: "0.375rem" },
    glyph: S.iconXs,
  },
  sm: {
    sx: { boxSizing: "border-box", height: "2rem", gap: "0.375rem", paddingInline: "0.75rem" },
    iconPad: { paddingInline: "0.625rem" },
  },
  lg: {
    sx: { boxSizing: "border-box", height: "2.5rem", paddingInline: "1.5rem" },
    iconPad: { paddingInline: "1rem" },
  },
  icon: { sx: { width: "2.25rem", height: "2.25rem" } },
  "icon-xs": { sx: { width: "1.5rem", height: "1.5rem" }, glyph: S.iconXs },
  "icon-sm": { sx: { width: "2rem", height: "2rem" } },
  "icon-lg": { sx: { width: "2.5rem", height: "2.5rem" } },
} satisfies Record<string, Size>;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export type ButtonProps = WithSx<ComponentProps<"button">> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** An icon child tightens the padding — was `.wa-btn--size-*:has(> svg)`. */
  hasIcon?: boolean;
  hovered?: boolean;
  focusVisible?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * A button's whole look, states included.
 *
 * The argument order is the old sheet order, so a state still repaints what
 * rests under it: the base, then the variant and the size, then
 * `:focus-visible`, `[aria-invalid]`, the variant's `:hover` and last the
 * destructive focus ring, which used to win its tie with `.wa-btn:focus-visible`
 * on source order alone.
 *
 * Exported because a hand-rolled trigger (a popover or dropdown trigger, which
 * cannot itself render `<Button>`) has to compute the same style rather than
 * copy the values. Such a trigger pairs this with `useInteraction`.
 */
export function buttonSx({
  variant = "default",
  size = "default",
  hasIcon = false,
  hovered = false,
  focusVisible = false,
  disabled = false,
  invalid = false,
}: ButtonLook = {}): Sx {
  const look = VARIANTS[variant] as Variant;
  const box = SIZES[size] as Size;

  return (
    sx(
      S.btn,
      look.sx,
      box.sx,
      hasIcon && box.iconPad,
      focusVisible && S.focus,
      invalid && S.invalid,
      // `pointer-events: none` ended the hover with the disabled state.
      hovered && !disabled && look.hover,
      focusVisible && look.focus,
      disabled && S.disabled,
    ) ?? {}
  );
}

function Button({
  className,
  style,
  variant = "default",
  size = "default",
  children,
  ...props
}: ButtonProps) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  const kids = toChildArray(children);
  const hasIcon = kids.some(isIconChild);
  const glyph = (SIZES[size] as Size).glyph ?? S.icon;
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";

  return (
    <button
      className={className}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      style={sx(
        reset.button,
        buttonSx({
          disabled: props.disabled === true,
          focusVisible,
          hasIcon,
          hovered,
          invalid,
          size,
          variant,
        }),
        style,
      )}
      {...props}
      {...handlers}
    >
      {kids.map((child) =>
        isIconChild(child) ? cloneElement(child, { style: sx(glyph, child.props.style) }) : child,
      )}
    </button>
  );
}

export { Button };
