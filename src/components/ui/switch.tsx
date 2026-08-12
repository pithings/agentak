import type { ComponentProps } from "preact";

import { useControllableState } from "@/lib/use-controllable-state";
import { useInteraction } from "@/lib/use-interaction";
import { reset } from "@/styles/base";
import { sx, type Sx } from "@/styles/sx";

/**
 * Hand-rolled from radix `Switch`: a button with `role="switch"`, so the state
 * is `aria-checked` rather than a radix data attribute.
 *
 * The checked track and thumb colours are inline conditionals — the component
 * already knows its own checked state, and `aria-checked` stays on the element
 * for tests and a11y.
 */
const S = {
  switch: {
    display: "inline-flex",
    width: "2rem",
    height: "1.15rem",
    flexShrink: "0",
    alignItems: "center",
    borderRadius: "9999px",
    outline: "none",
    transition:
      "background-color var(--wa-transition), border-color var(--wa-transition), box-shadow var(--wa-transition)",
    border: "1px solid transparent",
    boxShadow: "var(--wa-shadow-xs)",
  },
  switchFocus: { borderColor: "var(--wa-ring)", boxShadow: "var(--wa-focus-ring)" },
  switchDisabled: { cursor: "not-allowed", opacity: "0.5" },
  switchChecked: { background: "var(--wa-primary)" },
  switchUnchecked: { background: "var(--wa-input)" },
  thumb: {
    display: "block",
    width: "1rem",
    height: "1rem",
    borderRadius: "9999px",
    pointerEvents: "none",
    transition: "transform var(--wa-transition)",
  },
  // Contrasts its track in either theme, so no dark rule needed.
  thumbChecked: {
    background: "var(--wa-primary-foreground)",
    transform: "translateX(calc(100% - 2px))",
  },
  thumbUnchecked: { background: "var(--wa-muted-foreground)" },
} satisfies Record<string, Sx>;

export type SwitchProps = Omit<
  ComponentProps<"button">,
  "checked" | "defaultChecked" | "onChange" | "style"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  style?: Sx;
};

function Switch({
  className,
  checked,
  defaultChecked = false,
  disabled,
  onCheckedChange,
  onClick,
  style,
  type = "button",
  ...props
}: SwitchProps) {
  const [isChecked, setChecked] = useControllableState({
    defaultProp: defaultChecked,
    onChange: onCheckedChange,
    prop: checked,
  });
  const { focusVisible, handlers } = useInteraction(props);

  return (
    <button
      aria-checked={isChecked}
      className={className}
      data-slot="switch"
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setChecked(!isChecked);
      }}
      role="switch"
      style={sx(
        reset.button,
        S.switch,
        isChecked ? S.switchChecked : S.switchUnchecked,
        focusVisible && S.switchFocus,
        disabled && S.switchDisabled,
        style,
      )}
      type={type}
      {...props}
      {...handlers}
    >
      <span
        data-slot="switch-thumb"
        style={sx(S.thumb, isChecked ? S.thumbChecked : S.thumbUnchecked)}
      />
    </button>
  );
}

export { Switch };
