import type { ComponentProps } from "preact";

import { useInteraction } from "@/lib/use-interaction";
import { reset } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * `::placeholder` and `::selection` were the last two rules in this project. A
 * pseudo-element is a box of its own, so no inline style was ever in the running
 * for either, and keeping them meant keeping a stylesheet for three
 * declarations.
 *
 * The placeholder is `color-scheme` now — it inherits from the host's `:root`
 * alongside the tokens (`styles/base.ts`), so the UA paints a placeholder that
 * suits the theme. It is the browser's grey rather than `--muted-foreground`;
 * that is the trade. The selection highlight went back to the UA's, which
 * follows the OS.
 */
const S = {
  control: {
    boxSizing: "border-box",
    width: "100%",
    minWidth: "0",
    border: "1px solid var(--input)",
    borderRadius: "var(--radius-md)",
    background: "var(--surface)",
    boxShadow: "var(--shadow-xs)",
    color: "var(--foreground)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    outline: "none",
    transition: "border-color var(--transition), box-shadow var(--transition)",
  },
  focus: { borderColor: "var(--ring)", boxShadow: "var(--focus-ring)" },
  disabled: { pointerEvents: "none", cursor: "not-allowed", opacity: "0.5" },
  invalid: { borderColor: "var(--destructive)", boxShadow: "var(--invalid-ring)" },
  input: { boxSizing: "border-box", height: "2.25rem", padding: "0.25rem 0.75rem" },
} satisfies Record<string, Sx>;

/** The states the control frame paints. */
export interface ControlLook {
  focusVisible?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}

/** True for `aria-invalid` in either of the forms a caller may write. */
export function isInvalid(value: unknown): boolean {
  return value === true || value === "true";
}

/**
 * The control frame, shared with Textarea — the border, focus ring and invalid
 * state are the same control, only the box differs.
 *
 * The argument order is the old sheet order: the frame, then `:focus-visible`
 * and `:disabled`, and last `[aria-invalid="true"]`, which tied with the focus
 * ring on specificity and won on source order alone.
 */
export function controlSx({
  focusVisible = false,
  disabled = false,
  invalid = false,
}: ControlLook = {}): Sx {
  return sx(S.control, focusVisible && S.focus, disabled && S.disabled, invalid && S.invalid) ?? {};
}

function Input({ className, style, type, ...props }: WithSx<ComponentProps<"input">>) {
  const { focusVisible, handlers } = useInteraction<HTMLInputElement>(props);

  return (
    <input
      className={className}
      data-slot="input"
      style={sx(
        reset.control,
        controlSx({
          disabled: props.disabled === true,
          focusVisible,
          invalid: isInvalid(props["aria-invalid"]),
        }),
        S.input,
        style,
      )}
      type={type}
      {...props}
      {...handlers}
    />
  );
}

export { Input };
