import type { ComponentProps, RefObject } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "preact/hooks";

import { useControllableState } from "@/lib/use-controllable-state";
import { reset } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * Replaces `@radix-ui/react-popover`, and is the base `hover-card.tsx` builds on.
 *
 * No floating-ui and no portal: the panel is an absolutely positioned child of
 * the `Popover` root, which is the anchor. So it moves with the anchor on
 * scroll for free, and it is clipped by an ancestor with `overflow: hidden`.
 * `side`/`align` are plain CSS; the only collision handling is a flip to the
 * opposite side and a `--popover-available` height for a panel that can give
 * some back, see `fit`.
 */
// The box and the side/align choice are inline (see S.content, SIDE_OFFSET and
// ALIGN below), so DropdownMenu, ModelSelector, InlineCitation and OpenInChat
// re-size the panel by passing `style` to PopoverContent — a class cannot.
const S = {
  popover: { position: "relative", display: "inline-block" },
  anchor: { position: "relative", display: "inline-block" },
  content: {
    boxSizing: "border-box",
    position: "absolute",
    zIndex: "50",
    width: "18rem",
    // Against the viewport, not the anchor. A percentage would resolve against
    // the containing block — the `Popover` root, which is inline-block around
    // the trigger — so a wide panel on a small trigger, an InlineCitation
    // badge, would be squeezed to the badge. A panel that must instead stay
    // inside its anchor's row passes `maxWidth: "100%"` itself; `chat/picker.tsx`
    // is the one that does.
    maxWidth: "var(--popover-max-width, calc(100vw - 1rem))",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    background: "var(--background)",
    color: "var(--foreground)",
    fontSize: "0.875rem",
    outline: "none",
    boxShadow: "var(--shadow-xs)",
    padding: "1rem",
  },
} satisfies Record<string, Sx>;

// Keyed by the resolved side, since that is what used to sit in `[data-side]`.
const SIDE_OFFSET: Record<PopoverSide, Sx> = {
  bottom: { top: "100%", marginTop: "var(--popover-offset, 0.25rem)" },
  left: { right: "100%", marginRight: "var(--popover-offset, 0.25rem)" },
  right: { left: "100%", marginLeft: "var(--popover-offset, 0.25rem)" },
  top: { bottom: "100%", marginBottom: "var(--popover-offset, 0.25rem)" },
};

// Align runs across the side: horizontal for top/bottom, vertical for left/right.
const ALIGN: Record<`${PopoverSide}-${PopoverAlign}`, Sx> = {
  "bottom-center": { left: "50%", translate: "-50% 0" },
  "bottom-end": { right: "0" },
  "bottom-start": { left: "0" },
  "left-center": { top: "50%", translate: "0 -50%" },
  "left-end": { bottom: "0" },
  "left-start": { top: "0" },
  "right-center": { top: "50%", translate: "0 -50%" },
  "right-end": { bottom: "0" },
  "right-start": { top: "0" },
  "top-center": { left: "50%", translate: "-50% 0" },
  "top-end": { right: "0" },
  "top-start": { left: "0" },
};

export type PopoverSide = "top" | "right" | "bottom" | "left";
export type PopoverAlign = "start" | "center" | "end";

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  triggerId: string;
  triggerRef: RefObject<HTMLButtonElement>;
  rootRef: RefObject<HTMLDivElement>;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

/** Read the popover a part belongs to. `hover-card.tsx` is the other user. */
export function usePopover(part: string) {
  const context = useContext(PopoverContext);
  if (!context) throw new Error(`${part} must be used within Popover`);
  return context;
}

const state = (open: boolean) => (open ? "open" : "closed");

const OPPOSITE = { bottom: "top", left: "right", right: "left", top: "bottom" } as const;

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]",
].join(",");

function focusables(node: HTMLElement): HTMLElement[] {
  return [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (item) => item.tabIndex >= 0 && !item.closest("[hidden]"),
  );
}

/** Kept between the panel and the edge it stops at. */
const EDGE = 8;

/** A panel is never capped below this — under it, nothing is usable anyway. */
const FLOOR = 128;

interface Fit {
  side: PopoverSide;
  /** Room left on that side, or `null` where nothing constrains the panel. */
  available: number | null;
  /** The gap to the anchor. Negative where `fill` pulls the panel over it. */
  offset: number;
}

/** Up out of a shadow tree as well as up the tree: a panel may be in one. */
function up(node: Element): Element | null {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

/**
 * The nearest ancestor that clips the panel, or null for none.
 *
 * Resolved once per open: the chain cannot change while the panel is up, only
 * the rects can — and the fit is read every frame, so the walk must not be.
 */
function clipper(panel: HTMLElement, view: Window): Element | null {
  for (let node = up(panel); node; node = up(node)) {
    const style = view.getComputedStyle(node);
    if (style.overflowX !== "visible" || style.overflowY !== "visible") return node;
  }
  return null;
}

/**
 * What the panel opens into: the visible band of the viewport, narrowed to the
 * clipping ancestor.
 *
 * The **visual** viewport, because a virtual keyboard takes the foot of the
 * layout viewport without resizing it — a panel measured against the layout
 * viewport would size itself to open behind the keyboard. The clipping ancestor
 * matters just as much: the chat surface is `overflow: hidden`, so a corner box
 * cuts a panel off long before the viewport does.
 */
function bounds(clip: Element | null, view: Window) {
  const viewport = view.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const left = viewport?.offsetLeft ?? 0;
  const box = {
    bottom: top + (viewport?.height ?? view.innerHeight),
    left,
    right: left + (viewport?.width ?? view.innerWidth),
    top,
  };

  if (!clip) return box;

  const rect = clip.getBoundingClientRect();
  return {
    bottom: Math.min(box.bottom, rect.bottom),
    left: Math.max(box.left, rect.left),
    right: Math.min(box.right, rect.right),
    top: Math.max(box.top, rect.top),
  };
}

/**
 * Flip to the opposite side when the panel does not fit on the wanted one and
 * does fit opposite, and report the room the resolved side leaves. The panel is
 * never shifted along its axis. `side` is always the wanted side, never the
 * resolved one, so this cannot oscillate.
 */
function fit(
  side: PopoverSide,
  offset: number,
  panel: HTMLElement,
  anchor: HTMLElement | null,
  clip: Element | null,
  view: Window,
  fill: boolean,
): Fit {
  if (!anchor) return { available: null, offset, side };

  const box = anchor.getBoundingClientRect();
  const rect = panel.getBoundingClientRect();
  const edge = bounds(clip, view);
  const room = {
    bottom: edge.bottom - box.bottom,
    left: box.left - edge.left,
    right: edge.right - box.right,
    top: box.top - edge.top,
  };
  const needed = (side === "top" || side === "bottom" ? rect.height : rect.width) + offset;
  const opposite = OPPOSITE[side];
  const resolved = room[side] < needed && room[opposite] >= needed ? opposite : side;

  // What the panel would leave behind it: from its own edge, across the anchor,
  // to the far edge of the band. `fill` hands it that as room to open into
  // instead — see the prop. A negative gap is what pulls it there, so the
  // smaller of the two always wins, and an anchor already at the far edge —
  // nothing to reclaim, or past it — keeps the gap it asked for.
  const behind = {
    bottom: box.bottom - edge.top,
    left: edge.right - box.left,
    right: box.right - edge.left,
    top: edge.bottom - box.top,
  };
  const gap = fill ? Math.min(offset, EDGE - behind[resolved]) : offset;

  return {
    available: Math.round(Math.max(room[resolved] - gap - EDGE, FLOOR)),
    offset: gap,
    side: resolved,
  };
}

export type PopoverProps = WithSx<Omit<ComponentProps<"div">, "onToggle">> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Popover({
  className,
  open,
  defaultOpen = false,
  onOpenChange,
  style,
  ...props
}: PopoverProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useControllableState({
    defaultProp: defaultOpen,
    onChange: onOpenChange,
    prop: open,
  });

  const context = useMemo(
    () => ({
      contentId: `${id}-content`,
      open: isOpen,
      rootRef,
      setOpen,
      triggerId: `${id}-trigger`,
      triggerRef,
    }),
    [id, isOpen, setOpen],
  );

  return (
    <PopoverContext.Provider value={context}>
      <div
        className={className}
        data-slot="popover"
        data-state={state(isOpen)}
        ref={rootRef}
        style={sx(S.popover, style)}
        {...props}
      />
    </PopoverContext.Provider>
  );
}

export type PopoverAnchorProps = WithSx<ComponentProps<"div">>;

// A second positioning box, for a panel that must sit against part of the
// root. It works because CSS positions the panel against its nearest
// positioned ancestor — so put the `PopoverContent` inside the anchor.
function PopoverAnchor({ className, style, ...props }: PopoverAnchorProps) {
  return (
    <div className={className} data-slot="popover-anchor" style={sx(S.anchor, style)} {...props} />
  );
}

export type PopoverTriggerProps = WithSx<ComponentProps<"button">>;

// A real `<button>`: this project has no `asChild`. Call `preventDefault()` in
// `onClick` to keep the click from toggling, as `HoverCardTrigger` does.
function PopoverTrigger({ onClick, style, type = "button", ...props }: PopoverTriggerProps) {
  const { open, setOpen, contentId, triggerId, triggerRef } = usePopover("PopoverTrigger");

  return (
    <button
      aria-controls={contentId}
      aria-expanded={open}
      aria-haspopup="dialog"
      data-slot="popover-trigger"
      data-state={state(open)}
      id={triggerId}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      ref={triggerRef}
      style={sx(reset.button, style)}
      type={type}
      {...props}
    />
  );
}

export type PopoverContentProps = WithSx<ComponentProps<"div">> & {
  side?: PopoverSide;
  align?: PopoverAlign;
  /** Gap between anchor and panel, in px. */
  sideOffset?: number;
  /** Flip to the opposite side when the panel does not fit. Nothing else. */
  avoidCollisions?: boolean;
  /**
   * Open over the anchor, down to the far edge of the room measured.
   *
   * A panel is normally a box beside the control that opened it. On a phone
   * that control is usually at the bottom of the surface with a keyboard under
   * it, and the rows between the two — the composer's own — are room the panel
   * is not allowed to use while it is anchored above them. This gives it the
   * whole band instead, `EDGE` off both ends, and the anchor goes under it.
   *
   * Needs `avoidCollisions`, which is what measures the band.
   */
  fill?: boolean;
  /** Focus the panel on open, keep Tab inside it, and give focus back on close. */
  trapFocus?: boolean;
  /** Focus the first control inside on open. Off leaves it on the panel itself. */
  autoFocus?: boolean;
};

function PopoverContent({
  className,
  style,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  avoidCollisions = true,
  fill = false,
  trapFocus = true,
  autoFocus = true,
  onKeyDown,
  ref,
  ...props
}: PopoverContentProps) {
  const { open, setOpen, contentId, triggerId, triggerRef, rootRef } = usePopover("PopoverContent");
  const contentRef = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState<Fit>({ available: null, offset: sideOffset, side });

  // Merged, not overridden: the panel needs its own ref for dismissal and focus,
  // so a caller's ref is forwarded alongside it rather than replacing it.
  const setContentRef = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  // Dismissal. The listeners are on the owner document, not on the shadow root:
  // a pointerdown inside the shadow tree still reaches it, and composedPath()
  // is the only view of the target that crosses the boundary — `event.target`
  // is retargeted to the host, which would read as outside.
  useEffect(() => {
    const node = contentRef.current;
    if (!open || !node) return;
    const doc = node.ownerDocument;

    const onPointerDown = (event: Event) => {
      const path = event.composedPath();
      const trigger = triggerRef.current;
      if (path.includes(node) || (trigger && path.includes(trigger))) return;
      setOpen(false);
    };

    // preventDefault marks the key used, so a host that closes its own surface
    // on Escape — the playground chatbox does — leaves it open behind a panel.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };

    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("keydown", onKey, true);

    return () => {
      doc.removeEventListener("pointerdown", onPointerDown, true);
      doc.removeEventListener("keydown", onKey, true);
    };
  }, [open, setOpen, triggerRef]);

  /**
   * The fit, read every frame the panel is open.
   *
   * Not on `resize` and `scroll`: the anchor moves for reasons neither event
   * reports. The chat composer lifts over a phone keyboard and drops back when
   * it closes — a state change, one frame *after* the viewport event that
   * caused it — and the textarea under the panel grows as it is typed in. A
   * panel measured on the event alone keeps whatever room the old layout had,
   * which is how one opened over a keyboard stayed at its floor after the
   * keyboard was gone.
   *
   * A frame costs three rects. The clipping ancestor is resolved once, so the
   * walk and its `getComputedStyle` are not per-frame, and the state is only
   * written when a number actually changes.
   */
  useEffect(() => {
    const node = contentRef.current;
    if (!open || !node || !avoidCollisions) {
      setFitted({ available: null, offset: sideOffset, side });
      return;
    }

    const view = node.ownerDocument.defaultView;
    if (!view) return;

    const clip = clipper(node, view);
    let frame = 0;
    let last = "";

    const tick = () => {
      const next = fit(side, sideOffset, node, rootRef.current, clip, view, fill);
      const key = `${next.side}:${next.available}:${next.offset}`;
      if (key !== last) {
        last = key;
        setFitted(next);
      }
      frame = view.requestAnimationFrame(tick);
    };

    tick();

    return () => view.cancelAnimationFrame(frame);
  }, [avoidCollisions, fill, open, rootRef, side, sideOffset]);

  useEffect(() => {
    const node = contentRef.current;
    if (!open || !node || !trapFocus) return;
    const root = node.getRootNode() as Document | ShadowRoot;
    const trigger = triggerRef.current;

    const first = autoFocus ? focusables(node)[0] : undefined;
    if (first) first.focus();
    else node.focus();

    return () => {
      // Give focus back only if the panel still holds it. `activeElement` is
      // already the body, or null in a shadow root, once the panel is gone.
      const active = root.activeElement;
      if (!active || active === node.ownerDocument.body || node.contains(active)) trigger?.focus();
    };
  }, [autoFocus, open, trapFocus, triggerRef]);

  // Unmounted rather than hidden, so nothing inside stays reachable or stale.
  if (!open) return null;

  const resolvedSide = fitted.side;

  // Merged, not overridden: a caller's own `style` must not drop the offset.
  // The offset is a custom property because SIDE_OFFSET's margin reads it, and
  // callers may still set `--popover-offset` on the panel directly. It is the
  // measured one rather than `sideOffset`, since `fill` pulls it negative.
  //
  // `--popover-available` is the room measured on the resolved side, for a panel
  // that can give height back — `model-selector.tsx` caps its list with it.
  // Always written, never left off: a custom property inherits, and a panel
  // inside a panel would otherwise read the outer one's room as its own.
  const styles = sx(
    S.content,
    SIDE_OFFSET[resolvedSide],
    ALIGN[`${resolvedSide}-${align}`],
    {
      "--popover-available":
        fitted.available == null ? "none" : `${Math.round(fitted.available)}px`,
      "--popover-offset": `${fitted.offset}px`,
    } as Sx,
    style,
  );

  // `data-popover-content` is last, after the spread, because it is the one mark
  // on the panel a caller cannot take off: `data-slot` and `role` are both
  // overridden downstream — ModelSelectorContent and DropdownMenuContent name
  // themselves — and `input-group.tsx` has to recognise a panel opened from
  // inside an addon to leave its focus alone.
  return (
    <div
      aria-labelledby={triggerId}
      aria-modal="false"
      className={className}
      data-align={align}
      data-side={resolvedSide}
      data-slot="popover-content"
      data-state={state(open)}
      id={contentId}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!trapFocus || event.defaultPrevented || event.key !== "Tab") return;

        const node = contentRef.current;
        if (!node) return;

        // Wrap at the edges. The panel itself is the edge when it holds no
        // focusable of its own.
        const items = focusables(node);
        const first = items[0] ?? node;
        const last = items[items.length - 1] ?? node;
        const active = (node.getRootNode() as Document | ShadowRoot).activeElement;

        if (event.shiftKey && (active === first || active === node)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      ref={setContentRef}
      role="dialog"
      style={styles}
      tabIndex={-1}
      {...props}
      data-popover-content=""
    />
  );
}

export { Popover, PopoverAnchor, PopoverTrigger, PopoverContent };
