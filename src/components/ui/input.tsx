import type { ComponentProps } from "preact";

import { css } from "@/lib/css";
import { cn } from "@/lib/utils";
import { useInteraction } from "@/lib/use-interaction";
import { reset } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * A pseudo-element is a box of its own, so no inline style is even in the
 * running. These two are the only reason `.wa-control` is still on the input and
 * on the textarea, and they stay CSS for good.
 */
export const inputStyles = css`
  .wa-control::placeholder {
    color: var(--wa-muted-foreground);
  }
  .wa-control::selection {
    background: var(--wa-primary);
    color: var(--wa-primary-foreground);
  }
`;

const S = {
  control: {
    width: "100%",
    minWidth: "0",
    border: "1px solid var(--wa-input)",
    borderRadius: "var(--wa-radius-md)",
    background: "var(--wa-surface)",
    boxShadow: "var(--wa-shadow-xs)",
    color: "var(--wa-foreground)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    outline: "none",
    transition: "border-color var(--wa-transition), box-shadow var(--wa-transition)",
  },
  focus: { borderColor: "var(--wa-ring)", boxShadow: "var(--wa-focus-ring)" },
  disabled: { pointerEvents: "none", cursor: "not-allowed", opacity: "0.5" },
  invalid: { borderColor: "var(--wa-destructive)", boxShadow: "var(--wa-invalid-ring)" },
  input: { height: "2.25rem", padding: "0.25rem 0.75rem" },
} satisfies Record<string, Sx>;

/** The states `.wa-control` used to paint. */
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
      className={cn("wa-control", className)}
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
