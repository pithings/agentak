import type { ComponentProps } from "preact";
import { cloneElement, createContext, toChildArray } from "preact";
import { useContext, useId, useMemo } from "preact/hooks";

import { isIconChild } from "../../lib/icons.tsx";
import { useControllableState } from "../../lib/use-controllable-state.ts";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

// Sandbox re-skins the list and the tab through `style` props, which merge
// caller-last.
const S = {
  tabs: { display: "flex", flexDirection: "column", gap: "0.5rem" },
  list: {
    boxSizing: "border-box",
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.25rem",
    color: "var(--muted-foreground)",
    borderRadius: "var(--radius-lg)",
    background: "var(--muted)",
    padding: "3px",
  },
  tab: {
    display: "inline-flex",
    flex: "1 1 0",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    whiteSpace: "nowrap",
    outline: "none",
    transition:
      "background-color var(--transition), border-color var(--transition), color var(--transition)",
    border: "1px solid transparent",
    borderRadius: "var(--radius-md)",
    padding: "0.25rem 0.5rem",
    color: "var(--muted-foreground)",
  },
  tabHover: { color: "var(--foreground)" },
  tabFocus: { borderColor: "var(--ring)", boxShadow: "var(--focus-ring)" },
  tabDisabled: { pointerEvents: "none", opacity: "0.5" },
  tabActive: {
    background: "var(--background)",
    boxShadow: "var(--shadow-xs)",
    color: "var(--foreground)",
  },
  panel: { flex: "1", outline: "none" },
  tabIcon: { width: "1rem", height: "1rem", pointerEvents: "none" },
} satisfies Record<string, Sx>;

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function useTabs(part: string) {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`${part} must be used within Tabs`);
  return context;
}

const triggerId = (baseId: string, value: string) => `${baseId}-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}-${value}-panel`;

export type TabsProps = Omit<
  ComponentProps<"div">,
  "value" | "defaultValue" | "onChange" | "style"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  style?: Sx;
};

function Tabs({ value, defaultValue = "", onValueChange, className, style, ...props }: TabsProps) {
  const baseId = useId();
  const [current, setValue] = useControllableState({
    defaultProp: defaultValue,
    onChange: onValueChange,
    prop: value,
  });

  const context = useMemo(
    () => ({ baseId, setValue, value: current }),
    [baseId, current, setValue],
  );

  return (
    <TabsContext.Provider value={context}>
      <div className={className} data-slot="tabs" style={sx(S.tabs, style)} {...props} />
    </TabsContext.Provider>
  );
}

export type TabsListProps = WithSx<ComponentProps<"div">>;

function TabsList({ className, style, ...props }: TabsListProps) {
  return (
    <div
      className={className}
      data-slot="tabs-list"
      role="tablist"
      style={sx(S.list, style)}
      {...props}
    />
  );
}

export type TabsTriggerProps = Omit<ComponentProps<"button">, "value" | "style"> & {
  value: string;
  style?: Sx;
};

function TabsTrigger({
  className,
  value,
  onClick,
  style,
  type = "button",
  disabled,
  children,
  ...props
}: TabsTriggerProps) {
  const context = useTabs("TabsTrigger");
  const active = context.value === value;
  const { hovered, focusVisible, handlers } = useInteraction(props);

  return (
    <button
      aria-controls={panelId(context.baseId, value)}
      aria-selected={active}
      className={className}
      data-slot="tabs-trigger"
      data-state={active ? "active" : "inactive"}
      disabled={disabled}
      id={triggerId(context.baseId, value)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.setValue(value);
      }}
      role="tab"
      style={sx(
        reset.button,
        S.tab,
        hovered && S.tabHover,
        focusVisible && S.tabFocus,
        disabled && S.tabDisabled,
        active && S.tabActive,
        style,
      )}
      // Only the active tab is a tab stop; the rest are reached from inside.
      tabIndex={active ? 0 : -1}
      type={type}
      {...props}
      {...handlers}
    >
      {toChildArray(children).map((child) =>
        isIconChild(child)
          ? cloneElement(child, { style: sx(S.tabIcon, child.props.style) })
          : child,
      )}
    </button>
  );
}

export type TabsContentProps = Omit<ComponentProps<"div">, "value" | "style"> & {
  value: string;
  style?: Sx;
};

function TabsContent({ className, value, style, ...props }: TabsContentProps) {
  const context = useTabs("TabsContent");
  const active = context.value === value;

  return (
    <div
      aria-labelledby={triggerId(context.baseId, value)}
      className={className}
      data-slot="tabs-content"
      data-state={active ? "active" : "inactive"}
      hidden={!active}
      id={panelId(context.baseId, value)}
      role="tabpanel"
      style={sx(S.panel, style)}
      tabIndex={0}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
