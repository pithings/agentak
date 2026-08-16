import type { ComponentChildren, ComponentProps } from "preact";
import { cloneElement, createContext, toChildArray } from "preact";
import {
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { isIconChild, SearchIcon } from "../../../lib/icons.tsx";
import { useKeyboardOpen } from "../../../lib/use-keyboard-inset.ts";
import { useControllableState } from "../../../lib/use-controllable-state.ts";
import { reset, u } from "../../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../../styles/sx.ts";

/**
 * Replaces `cmdk`. A filter input over a `listbox`, with a roving highlight.
 *
 * Filtering is a case-insensitive substring test — no fuzzy scorer. An item
 * that does not match keeps its place in the tree and is `hidden`, so the DOM
 * order, and therefore the keyboard order, never changes under the filter.
 * `model-selector` is the first user; `voice-selector` and `mic-selector` are
 * the same shape.
 */
const S = {
  command: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "var(--radius-md)",
    background: "var(--background)",
    color: "var(--foreground)",
  },
  // Never shrinks: where the palette is capped — a popover over a phone
  // keyboard — the list gives the height up, not the field being typed in.
  commandInputWrap: {
    display: "flex",
    flexShrink: "0",
    alignItems: "center",
    gap: "0.5rem",
    borderBottom: "1px solid var(--border)",
    paddingInline: "0.75rem",
  },
  commandInputIcon: {
    flexShrink: "0",
    color: "var(--muted-foreground)",
  },
  commandInput: {
    boxSizing: "border-box",
    width: "100%",
    minWidth: "0",
    height: "2.75rem",
    border: "none",
    background: "transparent",
    color: "inherit",
    fontSize: "0.875rem",
    outline: "none",
  },
  // The cap is a variable so the list can hand it back: `CommandList` sets
  // `--command-room: none` while a virtual keyboard is up, and a caller with a
  // cap of its own — `model-selector.tsx` — reads the same variable rather than
  // writing a height the list cannot then give up. See the component below.
  commandList: {
    boxSizing: "border-box",
    maxHeight: "var(--command-room, 18rem)",
    overflowX: "hidden",
    overflowY: "auto",
    padding: "0.25rem",
  },
  commandEmpty: {
    padding: "1.5rem 0.75rem",
    textAlign: "center",
    fontSize: "0.875rem",
    color: "var(--muted-foreground)",
  },
  commandGroupLabel: {
    padding: "0.375rem 0.5rem",
    fontSize: "0.75rem",
    fontWeight: "500",
    color: "var(--muted-foreground)",
  },
  // `display` is paired with `commandItemHidden` below: an inline `display`
  // outranks the UA `[hidden]` rule, so both states are driven from here.
  commandItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: "var(--radius-sm)",
    padding: "0.375rem 0.5rem",
    fontSize: "0.875rem",
    cursor: "default",
    userSelect: "none",
  },
  commandItemHidden: {
    display: "none",
  },
  commandItemSelected: { background: "var(--accent)", color: "var(--accent-foreground)" },
  commandItemDisabled: { pointerEvents: "none", opacity: "0.5" },
  commandItemIcon: { flexShrink: "0", width: "1rem", height: "1rem" },
  commandSeparator: {
    height: "1px",
    margin: "0.25rem -0.25rem",
    background: "var(--border)",
  },
  commandShortcut: {
    marginLeft: "auto",
    fontSize: "0.75rem",
    letterSpacing: "0.05em",
    color: "var(--muted-foreground)",
  },
} satisfies Record<string, Sx>;

/** `text` is the item's value, its `textValue` and its keywords, joined. */
export type CommandFilter = (search: string, value: string, text: string) => boolean;

const defaultFilter: CommandFilter = (search, _value, text) =>
  text.toLowerCase().includes(search.trim().toLowerCase());

interface CommandItemData {
  text: string;
  id: string;
  node: HTMLElement;
  disabled: boolean;
}

interface CommandContextValue {
  search: string;
  setSearch: (search: string) => void;
  /** The committed value. */
  value: string;
  /** Commit a value. Fires the root's `onValueChange`. */
  select: (value: string) => void;
  /** The highlighted value — the first match when nothing is highlighted. */
  active: string | undefined;
  activeId: string | undefined;
  setActive: (value: string) => void;
  register: (value: string, item: CommandItemData) => () => void;
  matches: (value: string) => boolean;
  /** Items exist, but the filter hides all of them. */
  empty: boolean;
  listId: string;
}

const CommandContext = createContext<CommandContextValue | null>(null);

/** Read the command a part belongs to. Exported for compound elements. */
export function useCommand(part: string) {
  const context = useContext(CommandContext);
  if (!context) throw new Error(`${part} must be used within Command`);
  return context;
}

export type CommandProps = WithSx<
  Omit<ComponentProps<"div">, "value" | "defaultValue" | "onChange" | "onInput">
> & {
  /** The committed value, controlled. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** The filter text, controlled. */
  search?: string;
  defaultSearch?: string;
  onSearchChange?: (search: string) => void;
  filter?: CommandFilter;
  /** Wrap the highlight at the ends of the list. */
  loop?: boolean;
};

function Command({
  className,
  value,
  defaultValue = "",
  onValueChange,
  search,
  defaultSearch = "",
  onSearchChange,
  filter = defaultFilter,
  loop = true,
  onKeyDown,
  style,
  ...props
}: CommandProps) {
  const id = useId();
  const items = useRef(new Map<string, CommandItemData>());
  // The registry is a ref — a render must be asked for when it changes.
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((count) => count + 1), []);
  const [selected, setSelected] = useControllableState({
    defaultProp: defaultValue,
    onChange: onValueChange,
    prop: value,
  });
  const [query, setQuery] = useControllableState({
    defaultProp: defaultSearch,
    onChange: onSearchChange,
    prop: search,
  });
  const [highlight, setHighlight] = useState<string | undefined>(undefined);

  // Registration order is DOM order: an item is hidden, never unmounted.
  const register = useCallback(
    (key: string, item: CommandItemData) => {
      items.current.set(key, item);
      bump();
      return () => {
        items.current.delete(key);
        bump();
      };
    },
    [bump],
  );

  const matches = useCallback(
    (key: string) => {
      const item = items.current.get(key);
      // Unregistered on the first render — visible until it reports itself.
      return !item || filter(query, key, item.text);
    },
    [filter, query],
  );

  const visible: string[] = [];
  for (const [key, item] of items.current) {
    if (filter(query, key, item.text) && !item.disabled) visible.push(key);
  }
  const total = items.current.size;
  const hits = [...items.current].filter(([key, item]) => filter(query, key, item.text)).length;

  const preferred = highlight ?? selected;
  const active = preferred && visible.includes(preferred) ? preferred : visible[0];
  const activeId = active ? items.current.get(active)?.id : undefined;

  const context = useMemo(
    () => ({
      active,
      activeId,
      empty: total > 0 && hits === 0,
      listId: `${id}-list`,
      matches,
      register,
      search: query,
      select: setSelected,
      setActive: setHighlight,
      setSearch: setQuery,
      value: selected,
    }),
    [active, activeId, hits, id, matches, query, register, selected, setQuery, setSelected, total],
  );

  return (
    <CommandContext.Provider value={context}>
      <div
        className={className}
        data-slot="command"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          // Enter belongs to the palette, never to a form around it — the
          // composer holds one, and would otherwise submit on an empty list.
          if (event.key === "Enter") event.preventDefault();
          if (visible.length === 0) return;

          const index = active ? visible.indexOf(active) : -1;
          const last = visible.length - 1;
          const move = (next: number) => {
            event.preventDefault();
            const target = loop
              ? (next + visible.length) % visible.length
              : Math.min(Math.max(next, 0), last);
            const key = visible[target];
            setHighlight(key);
            // Optional call: jsdom has no layout and so no scrollIntoView.
            items.current.get(key)?.node.scrollIntoView?.({ block: "nearest" });
          };

          switch (event.key) {
            case "ArrowDown":
              move(index + 1);
              break;
            case "ArrowUp":
              move(index < 0 ? last : index - 1);
              break;
            case "Home":
              move(0);
              break;
            case "End":
              move(last);
              break;
            case "Enter":
              if (!active) break;
              event.preventDefault();
              items.current.get(active)?.node.click();
              break;
            default:
              break;
          }
        }}
        style={sx(S.command, style)}
        {...props}
      />
    </CommandContext.Provider>
  );
}

export type CommandInputProps = WithSx<Omit<ComponentProps<"input">, "value" | "onInput">> & {
  /** Replaces the magnifier. */
  icon?: ComponentChildren;
};

function CommandInput({
  className,
  icon,
  placeholder = "Search…",
  style,
  ...props
}: CommandInputProps) {
  const { search, setSearch, listId, activeId } = useCommand("CommandInput");

  return (
    <div data-slot="command-input-wrap" style={S.commandInputWrap}>
      {icon ?? <SearchIcon style={sx(u.icon, S.commandInputIcon)} />}
      <input
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded
        autocomplete="off"
        className={className}
        data-slot="command-input"
        onInput={(event) => setSearch(event.currentTarget.value)}
        placeholder={placeholder}
        role="combobox"
        spellcheck={false}
        style={sx(reset.control, S.commandInput, style)}
        type="text"
        value={search}
        {...props}
      />
    </div>
  );
}

export type CommandListProps = WithSx<ComponentProps<"div">>;

/** What the cap becomes with a keyboard up — see `CommandList`. */
const ROOM = { "--command-room": "none" } as Sx;

/**
 * The rows, capped — a palette must not run the height of the screen just
 * because the list is long.
 *
 * **The cap comes off while a virtual keyboard is up.** The panel is then
 * already capped by the room over the keyboard, which is less than the list
 * wants, and a second cap under it only leaves rows unread in a box that had
 * nowhere to grow anyway. The room is `--popover-available` where the palette
 * is in a popover (`ui/popover.tsx`), and the list scrolls in whatever is left.
 */
function CommandList({ className, style, ...props }: CommandListProps) {
  const { listId } = useCommand("CommandList");
  const keyboard = useKeyboardOpen();

  return (
    <div
      className={className}
      data-slot="command-list"
      id={listId}
      role="listbox"
      style={sx(S.commandList, keyboard && ROOM, style)}
      {...props}
    />
  );
}

export type CommandEmptyProps = WithSx<ComponentProps<"div">>;

/** Rendered only when the filter hides every item — never before they register. */
function CommandEmpty({ className, children, style, ...props }: CommandEmptyProps) {
  const { empty } = useCommand("CommandEmpty");
  if (!empty) return null;

  return (
    <div
      className={className}
      data-slot="command-empty"
      style={sx(S.commandEmpty, style)}
      {...props}
    >
      {children ?? "No results found."}
    </div>
  );
}

export type CommandGroupProps = ComponentProps<"div"> & {
  heading?: ComponentChildren;
};

function CommandGroup({ className, heading, children, ...props }: CommandGroupProps) {
  const id = useId();
  // Re-render whenever the filter changes, so the DOM query below stays live —
  // a caller can wrap `CommandItem` in its own component, so membership can
  // only be read from the rendered tree, not from `children`.
  useCommand("CommandGroup");
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);

  useLayoutEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>('[data-slot="command-item"]') ?? [];
    setEmpty(items.length > 0 && [...items].every((item) => item.hidden));
  });

  return (
    <div
      aria-labelledby={heading === undefined ? undefined : id}
      className={className}
      data-slot="command-group"
      hidden={empty}
      ref={ref}
      role="group"
      {...props}
    >
      {heading !== undefined && (
        <div id={id} style={S.commandGroupLabel}>
          {heading}
        </div>
      )}
      {children}
    </div>
  );
}

export type CommandItemProps = WithSx<Omit<ComponentProps<"div">, "onSelect" | "value">> & {
  value: string;
  /**
   * Extra text to match on — usually the visible label. Read once, when the
   * item registers, so pass it for content that changes.
   */
  textValue?: string;
  keywords?: string[];
  disabled?: boolean;
  onSelect?: (value: string) => void;
};

function CommandItem({
  className,
  value,
  textValue,
  keywords,
  disabled = false,
  onClick,
  onPointerMove,
  onSelect,
  style,
  children,
  ...props
}: CommandItemProps) {
  const { active, matches, register, select, setActive, value: chosen } = useCommand("CommandItem");
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const words = keywords?.join(" ");

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    return register(value, {
      disabled,
      id,
      node,
      text: [value, textValue ?? node.textContent ?? "", words].filter(Boolean).join(" "),
    });
  }, [disabled, id, register, textValue, value, words]);

  const highlighted = active === value;

  return (
    <div
      aria-disabled={disabled || undefined}
      aria-selected={highlighted}
      className={className}
      data-checked={chosen === value}
      data-disabled={disabled}
      data-selected={highlighted}
      data-slot="command-item"
      data-value={value}
      hidden={!matches(value)}
      id={id}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        setActive(value);
        onSelect?.(value);
        select(value);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        if (!event.defaultPrevented && !disabled) setActive(value);
      }}
      ref={ref}
      role="option"
      style={sx(
        S.commandItem,
        // `hidden` is kept for accessibility, but an inline `display` outranks
        // the UA `[hidden] { display: none }` rule — so drive it from here too.
        !matches(value) && S.commandItemHidden,
        highlighted && S.commandItemSelected,
        disabled && S.commandItemDisabled,
        style,
      )}
      {...props}
    >
      {toChildArray(children).map((child) =>
        isIconChild(child)
          ? cloneElement(child, { style: sx(S.commandItemIcon, child.props.style) })
          : child,
      )}
    </div>
  );
}

export type CommandSeparatorProps = WithSx<ComponentProps<"div">>;

function CommandSeparator({ className, style, ...props }: CommandSeparatorProps) {
  return (
    <div
      className={className}
      data-slot="command-separator"
      role="separator"
      style={sx(S.commandSeparator, style)}
      {...props}
    />
  );
}

export type CommandShortcutProps = WithSx<ComponentProps<"span">>;

function CommandShortcut({ className, style, ...props }: CommandShortcutProps) {
  return (
    <span
      className={className}
      data-slot="command-shortcut"
      style={sx(S.commandShortcut, style)}
      {...props}
    />
  );
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
};
