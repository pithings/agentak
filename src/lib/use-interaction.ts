import type { JSX } from "preact";
import { useMemo, useState } from "preact/hooks";

/**
 * The interaction states the sheet used to paint.
 *
 * `:hover`, `:focus-visible` and `:active` were the last reason a component kept
 * a resting value in CSS: an inline style outranks a rule, so a property the
 * state repaints could not go inline while the state stayed a selector. This
 * hook moves the state itself into JS, so both values become style objects and
 * `sx()` argument order decides which wins.
 *
 * Cost: a render per pointer enter and leave. That is the trade the split makes.
 */
export interface Interaction {
  hovered: boolean;
  /**
   * Tracks `:focus-visible`, not `:focus` — the element is asked directly, so
   * the engine's own heuristic decides, exactly as the rule did.
   */
  focusVisible: boolean;
  pressed: boolean;
}

type Pointer<T extends EventTarget> = JSX.PointerEventHandler<T>;
type Focus<T extends EventTarget> = JSX.FocusEventHandler<T>;

/** The caller's own handlers, which the returned ones still call. */
export interface InteractionProps<T extends EventTarget> {
  onPointerEnter?: Pointer<T>;
  onPointerLeave?: Pointer<T>;
  onPointerDown?: Pointer<T>;
  onPointerUp?: Pointer<T>;
  onFocus?: Focus<T>;
  onBlur?: Focus<T>;
}

export type InteractionResult<T extends EventTarget> = Interaction & {
  /** Spread onto the element. Already chains whatever the caller passed. */
  handlers: Required<InteractionProps<T>>;
};

/**
 * `:focus-visible` has no JS form, so ask the element whether it matches.
 *
 * jsdom does not know the selector, and an engine without it throws on the
 * whole `matches()` call. Treating that as "focused counts as visible" keeps
 * the ring rather than losing it.
 */
function matchesFocusVisible(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  try {
    return node.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * Track hover, focus-visible and press for one element.
 *
 * Pass the caller's handlers in and spread `handlers` out, so a consumer's own
 * `onPointerEnter` still runs:
 *
 * ```tsx
 * const { hovered, handlers } = useInteraction(props);
 * return <div {...props} {...handlers} style={sx(S.base, hovered && S.hover, style)} />;
 * ```
 *
 * `handlers` must be spread AFTER `{...props}`, or the caller's raw handler
 * would replace the chained one and the state would never update.
 */
export function useInteraction<T extends EventTarget = HTMLElement>(
  props: InteractionProps<T> = {},
): InteractionResult<T> {
  const { onPointerEnter, onPointerLeave, onPointerDown, onPointerUp, onFocus, onBlur } = props;

  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [pressed, setPressed] = useState(false);

  const handlers = useMemo(
    (): Required<InteractionProps<T>> => ({
      onPointerEnter: (event) => {
        onPointerEnter?.(event);
        setHovered(true);
      },
      onPointerLeave: (event) => {
        onPointerLeave?.(event);
        setHovered(false);
        // A pointer that leaves mid-press never delivers the up event here.
        setPressed(false);
      },
      onPointerDown: (event) => {
        onPointerDown?.(event);
        setPressed(true);
      },
      onPointerUp: (event) => {
        onPointerUp?.(event);
        setPressed(false);
      },
      onFocus: (event) => {
        onFocus?.(event);
        setFocusVisible(matchesFocusVisible(event.currentTarget));
      },
      onBlur: (event) => {
        onBlur?.(event);
        setFocusVisible(false);
      },
    }),
    [onPointerEnter, onPointerLeave, onPointerDown, onPointerUp, onFocus, onBlur],
  );

  return { focusVisible, handlers, hovered, pressed };
}
