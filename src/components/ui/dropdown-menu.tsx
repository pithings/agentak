import type { ComponentProps, RefObject } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { useInteraction } from "@/lib/use-interaction";
import { reset } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopover,
  type PopoverContentProps,
  type PopoverProps,
  type PopoverTriggerProps,
} from "@/components/ui/popover";

/**
 * Replaces `@radix-ui/react-dropdown-menu`, on top of `popover.tsx`.
 *
 * The popover owns the panel, the positioning and the dismissal. This adds only
 * the menu layer radix carries and the popover deliberately does not: `menu`
 * and `menuitem` roles, roving focus over the items, and Enter/Space to
 * activate. No submenus, no checkbox or radio items — nothing has asked for one.
 */
const S = {
  // Was the `.popover-content.menu` compound: the panel is a popover
  // first, so this must reach PopoverContent as `style` to keep outranking it.
  content: {
    boxSizing: "border-box",
    width: "max-content",
    minWidth: "8rem",
    maxWidth: "20rem",
    padding: "0.25rem",
  },
  item: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "0.5rem",
    border: "0",
    borderRadius: "var(--radius-sm)",
    padding: "0.375rem 0.5rem",
    font: "inherit",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    textAlign: "left",
    textDecoration: "none",
    outline: "none",
    cursor: "pointer",
    background: "transparent",
    color: "inherit",
  },
  itemActive: { background: "var(--hover)", color: "var(--hover-foreground)" },
  itemDisabled: { pointerEvents: "none", opacity: "0.5" },
  label: {
    padding: "0.375rem 0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
    fontWeight: "500",
  },
  separator: { margin: "0.25rem -0.25rem", borderTop: "1px solid var(--border)" },
} satisfies Record<string, Sx>;

/** Where focus lands when the keyboard opens the menu. */
type Landing = "first" | "last";

interface DropdownMenuContextValue {
  /** Written by the trigger, read once by the content when the panel opens. */
  landing: RefObject<Landing | null>;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu(part: string) {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error(`${part} must be used within DropdownMenu`);
  return context;
}

const ITEM = '[data-slot="dropdown-menu-item"]:not([disabled]):not([aria-disabled="true"])';

function items(node: HTMLElement | null): HTMLElement[] {
  return node ? [...node.querySelectorAll<HTMLElement>(ITEM)] : [];
}

export type DropdownMenuProps = PopoverProps;

function DropdownMenu(props: DropdownMenuProps) {
  const landing = useRef<Landing | null>(null);
  const context = useMemo(() => ({ landing }), []);

  return (
    <DropdownMenuContext.Provider value={context}>
      <Popover data-slot="dropdown-menu" {...props} />
    </DropdownMenuContext.Provider>
  );
}

export type DropdownMenuTriggerProps = PopoverTriggerProps;

function DropdownMenuTrigger({ onKeyDown, ...props }: DropdownMenuTriggerProps) {
  const { landing } = useDropdownMenu("DropdownMenuTrigger");
  const { open, setOpen } = usePopover("DropdownMenuTrigger");

  return (
    <PopoverTrigger
      aria-haspopup="menu"
      data-slot="dropdown-menu-trigger"
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || open) return;

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          landing.current = event.key === "ArrowUp" ? "last" : "first";
          setOpen(true);
        } else if (event.key === "Enter" || event.key === " ") {
          // The click these keys fire does the opening; this only says where
          // focus lands.
          landing.current = "first";
        }
      }}
      {...props}
    />
  );
}

export type DropdownMenuContentProps = PopoverContentProps;

function DropdownMenuContent({ className, onKeyDown, style, ...props }: DropdownMenuContentProps) {
  const { landing } = useDropdownMenu("DropdownMenuContent");
  const { open, rootRef } = usePopover("DropdownMenuContent");

  // The panel is read through the popover root rather than through a ref of our
  // own: `PopoverContent` owns its ref, and a second one passed in props would
  // silently replace it. This effect runs after the popover has focused the
  // panel, so it has the last word.
  useEffect(() => {
    if (!open) return;
    const where = landing.current;
    landing.current = null;
    if (!where) return;

    const list = items(rootRef.current);
    const item = where === "last" ? list[list.length - 1] : list[0];
    item?.focus();
  }, [landing, open, rootRef]);

  return (
    <PopoverContent
      aria-orientation="vertical"
      className={className}
      data-slot="dropdown-menu-content"
      style={sx(S.content, style)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;

        const panel = event.currentTarget;
        const list = items(panel);
        if (list.length === 0) return;

        const root = panel.getRootNode() as Document | ShadowRoot;
        const index = list.indexOf(root.activeElement as HTMLElement);
        const move = (next: number) => {
          event.preventDefault();
          list[next]?.focus();
        };

        switch (event.key) {
          case "ArrowDown": {
            move((index + 1) % list.length); // -1, the panel itself, lands on the first.
            break;
          }
          case "ArrowUp": {
            move(index < 1 ? list.length - 1 : index - 1);
            break;
          }
          case "Home": {
            move(0);
            break;
          }
          case "End": {
            move(list.length - 1);
            break;
          }
          case "Enter":
          case " ": {
            const item = list[index];
            if (!item) break;
            // One activation, not two: the key's own default is dropped and the
            // click is ours. Space alone would not activate a link.
            event.preventDefault();
            item.click();
            break;
          }
        }
      }}
      role="menu"
      {...props}
    />
  );
}

export type DropdownMenuItemProps = WithSx<ComponentProps<"button">>;

function DropdownMenuItem({
  className,
  onClick,
  onFocus,
  onBlur,
  style,
  type = "button",
  disabled,
  ...props
}: DropdownMenuItemProps) {
  const { setOpen } = usePopover("DropdownMenuItem");
  // Focus moves programmatically here (roving tabindex, and on open), so
  // plain :focus is the state that matters — not the hook's own
  // `focusVisible`, which filters through the engine's keyboard heuristic.
  const [focused, setFocused] = useState(false);
  const { hovered, handlers } = useInteraction(props);
  const ariaDisabled = props["aria-disabled"];
  const isDisabled = disabled || ariaDisabled === true || ariaDisabled === "true";

  return (
    <button
      className={className}
      data-slot="dropdown-menu-item"
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      role="menuitem"
      style={sx(
        reset.button,
        S.item,
        (hovered || focused) && S.itemActive,
        isDisabled && S.itemDisabled,
        style,
      )}
      tabIndex={-1}
      type={type}
      {...props}
      {...handlers}
      onFocus={(event) => {
        onFocus?.(event);
        setFocused(true);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        setFocused(false);
      }}
    />
  );
}

export type DropdownMenuItemLinkProps = WithSx<ComponentProps<"a">>;

// This project has no `asChild`, so an item that navigates is its own component
// rather than a `<button>` wrapping an `<a>`.
function DropdownMenuItemLink({
  className,
  onClick,
  onFocus,
  onBlur,
  style,
  ...props
}: DropdownMenuItemLinkProps) {
  const { setOpen } = usePopover("DropdownMenuItemLink");
  const [focused, setFocused] = useState(false);
  const { hovered, handlers } = useInteraction(props);
  const ariaDisabled = props["aria-disabled"];
  const isDisabled = ariaDisabled === true || ariaDisabled === "true";

  return (
    <a
      className={className}
      data-slot="dropdown-menu-item"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
      role="menuitem"
      style={sx(
        reset.link,
        S.item,
        (hovered || focused) && S.itemActive,
        isDisabled && S.itemDisabled,
        style,
      )}
      tabIndex={-1}
      {...props}
      {...handlers}
      onFocus={(event) => {
        onFocus?.(event);
        setFocused(true);
      }}
      onBlur={(event) => {
        onBlur?.(event);
        setFocused(false);
      }}
    />
  );
}

export type DropdownMenuLabelProps = WithSx<ComponentProps<"div">>;

function DropdownMenuLabel({ className, style, ...props }: DropdownMenuLabelProps) {
  return (
    <div
      className={className}
      data-slot="dropdown-menu-label"
      style={sx(S.label, style)}
      {...props}
    />
  );
}

export type DropdownMenuSeparatorProps = WithSx<ComponentProps<"div">>;

function DropdownMenuSeparator({ className, style, ...props }: DropdownMenuSeparatorProps) {
  return (
    <div
      className={className}
      data-slot="dropdown-menu-separator"
      role="separator"
      style={sx(S.separator, style)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemLink,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
