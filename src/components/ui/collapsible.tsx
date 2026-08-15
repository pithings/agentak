import type { ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext, useId, useMemo } from "preact/hooks";

import { useControllableState } from "../../lib/use-controllable-state.ts";
import { reset } from "../../styles/base.ts";
import { sx, type WithSx } from "../../styles/sx.ts";

export interface CollapsibleContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  contentId: string;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

export function useCollapsible(part: string) {
  const context = useContext(CollapsibleContext);
  if (!context) throw new Error(`${part} must be used within Collapsible`);
  return context;
}

const state = (open: boolean) => (open ? "open" : "closed");

export type CollapsibleProps = Omit<ComponentProps<"div">, "onToggle"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
};

function Collapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  ...props
}: CollapsibleProps) {
  const contentId = useId();
  const [isOpen, setOpen] = useControllableState({
    defaultProp: defaultOpen,
    onChange: onOpenChange,
    prop: open,
  });

  const value = useMemo(
    () => ({ contentId, disabled, open: isOpen, setOpen }),
    [contentId, disabled, isOpen, setOpen],
  );

  return (
    <CollapsibleContext.Provider value={value}>
      <div data-slot="collapsible" data-state={state(isOpen)} {...props} />
    </CollapsibleContext.Provider>
  );
}

export type CollapsibleTriggerProps = WithSx<ComponentProps<"button">>;

function CollapsibleTrigger({
  onClick,
  style,
  type = "button",
  ...props
}: CollapsibleTriggerProps) {
  const { open, setOpen, disabled, contentId } = useCollapsible("CollapsibleTrigger");

  return (
    <button
      aria-controls={contentId}
      aria-expanded={open}
      data-slot="collapsible-trigger"
      data-state={state(open)}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      style={sx(reset.button, style)}
      type={type}
      {...props}
    />
  );
}

export type CollapsibleContentProps = ComponentProps<"div">;

function CollapsibleContent(props: CollapsibleContentProps) {
  const { open, contentId } = useCollapsible("CollapsibleContent");

  return (
    <div
      data-slot="collapsible-content"
      data-state={state(open)}
      hidden={!open}
      id={contentId}
      {...props}
    />
  );
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
