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
 * opposite side, see `fitSide`.
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
    maxWidth: "100%",
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-md)",
    background: "var(--wa-background)",
    color: "var(--wa-foreground)",
    fontSize: "0.875rem",
    outline: "none",
    boxShadow: "var(--wa-shadow-xs)",
    padding: "1rem",
  },
} satisfies Record<string, Sx>;

// Keyed by the resolved side, since that is what used to sit in `[data-side]`.
const SIDE_OFFSET: Record<PopoverSide, Sx> = {
  bottom: { top: "100%", marginTop: "var(--wa-popover-offset, 0.25rem)" },
  left: { right: "100%", marginRight: "var(--wa-popover-offset, 0.25rem)" },
  right: { left: "100%", marginLeft: "var(--wa-popover-offset, 0.25rem)" },
  top: { bottom: "100%", marginBottom: "var(--wa-popover-offset, 0.25rem)" },
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

/**
 * Flip to the opposite side when the panel does not fit on the wanted one and
 * does fit opposite. Measured against the viewport only — no clipping ancestor
 * is read, and the panel is never shifted along its axis or clamped. `side` is
 * always the wanted side, never the resolved one, so this cannot oscillate.
 */
function fitSide(
  side: PopoverSide,
  offset: number,
  panel: HTMLElement,
  anchor: HTMLElement | null,
): PopoverSide {
  const view = panel.ownerDocument.defaultView;
  if (!anchor || !view) return side;

  const box = anchor.getBoundingClientRect();
  const rect = panel.getBoundingClientRect();
  const room = {
    bottom: view.innerHeight - box.bottom,
    left: box.left,
    right: view.innerWidth - box.right,
    top: box.top,
  };
  const needed = (side === "top" || side === "bottom" ? rect.height : rect.width) + offset;
  const opposite = OPPOSITE[side];

  return room[side] < needed && room[opposite] >= needed ? opposite : side;
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
  /** Focus the panel on open, keep Tab inside it, and give focus back on close. */
  trapFocus?: boolean;
};

function PopoverContent({
  className,
  style,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  avoidCollisions = true,
  trapFocus = true,
  onKeyDown,
  ref,
  ...props
}: PopoverContentProps) {
  const { open, setOpen, contentId, triggerId, triggerRef, rootRef } = usePopover("PopoverContent");
  const contentRef = useRef<HTMLDivElement>(null);
  const [resolvedSide, setResolvedSide] = useState(side);

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

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    doc.addEventListener("pointerdown", onPointerDown, true);
    doc.addEventListener("keydown", onKey, true);

    return () => {
      doc.removeEventListener("pointerdown", onPointerDown, true);
      doc.removeEventListener("keydown", onKey, true);
    };
  }, [open, setOpen, triggerRef]);

  // The panel scrolls with its anchor, so only the flip decision goes stale.
  useEffect(() => {
    const node = contentRef.current;
    if (!open || !node || !avoidCollisions) {
      setResolvedSide(side);
      return;
    }

    const measure = () => setResolvedSide(fitSide(side, sideOffset, node, rootRef.current));
    measure();

    const view = node.ownerDocument.defaultView;
    if (!view) return;
    view.addEventListener("resize", measure);
    view.addEventListener("scroll", measure, { capture: true, passive: true });

    return () => {
      view.removeEventListener("resize", measure);
      view.removeEventListener("scroll", measure, { capture: true });
    };
  }, [avoidCollisions, open, rootRef, side, sideOffset]);

  useEffect(() => {
    const node = contentRef.current;
    if (!open || !node || !trapFocus) return;
    const root = node.getRootNode() as Document | ShadowRoot;
    const trigger = triggerRef.current;

    const first = focusables(node)[0];
    if (first) first.focus();
    else node.focus();

    return () => {
      // Give focus back only if the panel still holds it. `activeElement` is
      // already the body, or null in a shadow root, once the panel is gone.
      const active = root.activeElement;
      if (!active || active === node.ownerDocument.body || node.contains(active)) trigger?.focus();
    };
  }, [open, trapFocus, triggerRef]);

  // Unmounted rather than hidden, so nothing inside stays reachable or stale.
  if (!open) return null;

  // Merged, not overridden: a caller's own `style` must not drop the offset.
  // The offset is a custom property because SIDE_OFFSET's margin reads it, and
  // callers may still set `--wa-popover-offset` on the panel directly.
  const styles = sx(
    S.content,
    SIDE_OFFSET[resolvedSide],
    ALIGN[`${resolvedSide}-${align}`],
    { "--wa-popover-offset": `${sideOffset}px` } as Sx,
    style,
  );

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
    />
  );
}

export { Popover, PopoverAnchor, PopoverTrigger, PopoverContent };
