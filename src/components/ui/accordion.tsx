import type { ComponentChild, ComponentProps, VNode } from "preact";
import { cloneElement, createContext, isValidElement, toChildArray } from "preact";
import { useContext, useId, useMemo } from "preact/hooks";

import { Chevron } from "../../lib/icons.tsx";
import { useControllableState } from "../../lib/use-controllable-state.ts";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

/**
 * The separating border is cloned, not selected. `:last-child` used to drop it
 * from the last item; `Accordion` instead hands `S.itemBorder` to every child
 * but the last, as `style`. A wrapper works as well as `AccordionItem` itself —
 * `AgentTool` (`ai-elements/agent.tsx`) forwards its props straight through, so
 * the style reaches the same div an `isLast` flag never could.
 *
 * The one fragility: this needs `style` to survive the trip. A future wrapper
 * that swallows `style` instead of forwarding it loses the border silently —
 * nothing fails, the rule is just never applied.
 */
const S = {
  itemBorder: { borderBottom: "1px solid var(--border)" },
  heading: { display: "flex", margin: "0" },
  trigger: {
    display: "flex",
    flex: "1",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
    borderRadius: "var(--radius-md)",
    paddingBlock: "1rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    textAlign: "left",
    outline: "none",
    transition: "color var(--transition)",
  },
  triggerHover: { textDecoration: "underline" },
  triggerFocus: { boxShadow: "var(--focus-ring)" },
  triggerDisabled: { pointerEvents: "none", opacity: "0.5" },
  content: { overflow: "hidden", fontSize: "0.875rem" },
  body: { paddingBottom: "1rem" },
  chevron: { translate: "0 0.125rem", pointerEvents: "none" },
} satisfies Record<string, Sx>;

interface AccordionContextValue {
  value: string[];
  toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

interface AccordionItemContextValue {
  open: boolean;
  value: string;
  contentId: string;
  triggerId: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordion(part: string) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error(`${part} must be used within Accordion`);
  return context;
}

function useAccordionItem(part: string) {
  const context = useContext(AccordionItemContext);
  if (!context) throw new Error(`${part} must be used within AccordionItem`);
  return context;
}

const state = (open: boolean) => (open ? "open" : "closed");

/** Narrows `isValidElement` so the clone below can type the `style` it adds. */
function hasStyle(child: ComponentChild): child is VNode<{ style?: Sx }> {
  return isValidElement(child);
}

export type AccordionProps = Omit<ComponentProps<"div">, "value" | "defaultValue" | "onChange"> & {
  /** `single` keeps at most one item open. */
  type?: "single" | "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** `single` only: let a click close the open item. */
  collapsible?: boolean;
};

// The open set is always an array, for both types. Radix carries a bare string
// for `single`, which costs a discriminated union and buys nothing here.
function Accordion({
  className,
  children,
  type = "single",
  value,
  defaultValue,
  onValueChange,
  collapsible = true,
  ...props
}: AccordionProps) {
  const [open, setOpen] = useControllableState<string[]>({
    defaultProp: defaultValue ?? [],
    onChange: onValueChange,
    prop: value,
  });

  const context = useMemo(
    () => ({
      toggle: (item: string) => {
        const isOpen = open.includes(item);
        if (type === "multiple") {
          setOpen(isOpen ? open.filter((entry) => entry !== item) : [...open, item]);
        } else if (!isOpen) {
          setOpen([item]);
        } else if (collapsible) {
          setOpen([]);
        }
      },
      value: open,
    }),
    [collapsible, open, setOpen, type],
  );

  const items = toChildArray(children);

  return (
    <AccordionContext.Provider value={context}>
      <div className={className} data-slot="accordion" {...props}>
        {items.map((child, index) =>
          index < items.length - 1 && hasStyle(child)
            ? cloneElement(child, { style: sx(child.props.style, S.itemBorder) })
            : child,
        )}
      </div>
    </AccordionContext.Provider>
  );
}

export type AccordionItemProps = WithSx<ComponentProps<"div">> & { value: string };

function AccordionItem({ className, style, value, ...props }: AccordionItemProps) {
  const { value: openValues } = useAccordion("AccordionItem");
  const id = useId();
  const open = openValues.includes(value);

  const context = useMemo(
    () => ({ contentId: `${id}-content`, open, triggerId: `${id}-trigger`, value }),
    [id, open, value],
  );

  return (
    <AccordionItemContext.Provider value={context}>
      <div
        className={className}
        data-slot="accordion-item"
        data-state={state(open)}
        // `style` is destructured out and merged here, so `{...props}` cannot
        // overwrite it — the border Accordion clones on arrives this way.
        style={sx(style)}
        {...props}
      />
    </AccordionItemContext.Provider>
  );
}

export type AccordionTriggerProps = WithSx<ComponentProps<"button">>;

function AccordionTrigger({
  className,
  children,
  onClick,
  style,
  type = "button",
  disabled,
  ...props
}: AccordionTriggerProps) {
  const { toggle } = useAccordion("AccordionTrigger");
  const { open, value, contentId, triggerId } = useAccordionItem("AccordionTrigger");
  const { hovered, focusVisible, handlers } = useInteraction(props);

  return (
    <h3 style={sx(reset.text, S.heading)}>
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className={className}
        data-slot="accordion-trigger"
        data-state={state(open)}
        disabled={disabled}
        id={triggerId}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) toggle(value);
        }}
        style={sx(
          reset.button,
          S.trigger,
          hovered && S.triggerHover,
          focusVisible && S.triggerFocus,
          disabled && S.triggerDisabled,
          style,
        )}
        type={type}
        {...props}
        {...handlers}
      >
        {children}
        <Chevron open={open} style={sx(S.chevron, u.muted)} />
      </button>
    </h3>
  );
}

export type AccordionContentProps = WithSx<ComponentProps<"div">>;

function AccordionContent({ className, children, style, ...props }: AccordionContentProps) {
  const { open, contentId, triggerId } = useAccordionItem("AccordionContent");

  return (
    <div
      aria-labelledby={triggerId}
      data-slot="accordion-content"
      data-state={state(open)}
      hidden={!open}
      id={contentId}
      role="region"
      style={S.content}
      {...props}
    >
      <div className={className} style={sx(S.body, style)}>
        {children}
      </div>
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
