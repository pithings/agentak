import type { ComponentChildren, ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  type CommandFilter,
  type CommandItemProps,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopover,
  type PopoverContentProps,
  type PopoverProps,
  type PopoverTriggerProps,
} from "@/components/ui/popover";
import { buttonSx, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { useControllableState } from "@/lib/use-controllable-state";
import { useInteraction } from "@/lib/use-interaction";
import { CheckIcon, ChevronsUpDownIcon } from "@/lib/icons";
import { u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * Pick a model from a filtered list.
 *
 * Upstream is a `cmdk` palette in a radix dialog. Here the panel is a popover
 * and the list is `ui/command.tsx`. The provider logos are gone — see
 * `.agents/components/porting.md`.
 */
const S = {
  // Was the `.popover-content.model-selector-content` compound: the
  // popover's own padding and width are wrong for a list, so this must reach
  // PopoverContent as `style` to keep outranking it.
  modelSelectorContent: { boxSizing: "border-box", width: "20rem", padding: "0" },
  // The trigger renders `PopoverTrigger`, not `Button`, so its box comes from
  // `buttonSx()` (ui/button.tsx) over the `variant`/`size` props, plus the
  // properties Button does not set — `justifyContent`/`minWidth`/`maxWidth`
  // fit a value-and-chevron layout rather than centred text.
  modelSelectorTrigger: {
    justifyContent: "space-between",
    gap: "0.375rem",
    minWidth: "0",
    maxWidth: "100%",
  },
  modelSelectorChevron: {
    opacity: "0.5",
  },
  modelSelectorValue: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  modelSelectorName: {
    flex: "1",
    overflow: "hidden",
    textAlign: "left",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
} satisfies Record<string, Sx>;

interface ModelSelectorContextValue {
  value: string;
  setValue: (value: string) => void;
}

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(null);

function useModelSelector(part: string) {
  const context = useContext(ModelSelectorContext);
  if (!context) throw new Error(`${part} must be used within ModelSelector`);
  return context;
}

export type ModelSelectorProps = Omit<PopoverProps, "value" | "defaultValue"> & {
  /** The chosen model id, controlled. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

function ModelSelector({
  className,
  value,
  defaultValue = "",
  onValueChange,
  ...props
}: ModelSelectorProps) {
  const [selected, setSelected] = useControllableState({
    defaultProp: defaultValue,
    onChange: onValueChange,
    prop: value,
  });

  const context = useMemo(
    () => ({ setValue: setSelected, value: selected }),
    [selected, setSelected],
  );

  return (
    <ModelSelectorContext.Provider value={context}>
      <Popover className={className} data-slot="model-selector" {...props} />
    </ModelSelectorContext.Provider>
  );
}

export type ModelSelectorTriggerProps = PopoverTriggerProps & {
  /** The button look, for a trigger that sits in a composer rather than a bar. */
  variant?: ButtonVariant;
  size?: ButtonSize;
};

function ModelSelectorTrigger({
  className,
  style,
  children,
  variant = "outline",
  size = "sm",
  ...props
}: ModelSelectorTriggerProps) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <PopoverTrigger
      className={className}
      data-slot="model-selector-trigger"
      style={sx(
        buttonSx({ focusVisible, hasIcon: true, hovered, size, variant }),
        S.modelSelectorTrigger,
        style,
      )}
      {...props}
      {...handlers}
    >
      {children ?? <ModelSelectorValue />}
      <ChevronsUpDownIcon style={sx(u.icon, S.modelSelectorChevron)} />
    </PopoverTrigger>
  );
}

export type ModelSelectorValueProps = WithSx<ComponentProps<"span">> & {
  placeholder?: ComponentChildren;
};

/** The chosen id, or `children` when the caller has a nicer label for it. */
function ModelSelectorValue({
  className,
  children,
  style,
  placeholder = "Select a model",
  ...props
}: ModelSelectorValueProps) {
  const { value } = useModelSelector("ModelSelectorValue");

  return (
    <span
      className={className}
      data-slot="model-selector-value"
      style={sx(S.modelSelectorValue, style)}
      {...props}
    >
      {children ?? (value || placeholder)}
    </span>
  );
}

export type ModelSelectorContentProps = PopoverContentProps & {
  filter?: CommandFilter;
  /** The filter text, controlled — for a caller that swaps the list under it. */
  search?: string;
  onSearchChange?: (search: string) => void;
};

function ModelSelectorContent({
  className,
  children,
  filter,
  search,
  onSearchChange,
  style,
  ...props
}: ModelSelectorContentProps) {
  const { value, setValue } = useModelSelector("ModelSelectorContent");
  const { setOpen } = usePopover("ModelSelectorContent");

  return (
    <PopoverContent
      align="start"
      className={className}
      data-slot="model-selector-content"
      style={sx(S.modelSelectorContent, style)}
      {...props}
    >
      <Command
        filter={filter}
        onSearchChange={onSearchChange}
        onValueChange={(next) => {
          setValue(next);
          setOpen(false);
        }}
        search={search}
        value={value}
      >
        {children}
      </Command>
    </PopoverContent>
  );
}

export type ModelSelectorInputProps = ComponentProps<typeof CommandInput>;

const ModelSelectorInput = (props: ModelSelectorInputProps) => (
  <CommandInput data-slot="model-selector-input" placeholder="Search models…" {...props} />
);

export type ModelSelectorListProps = ComponentProps<typeof CommandList>;

const ModelSelectorList = (props: ModelSelectorListProps) => (
  <CommandList data-slot="model-selector-list" {...props} />
);

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

const ModelSelectorEmpty = ({ children, ...props }: ModelSelectorEmptyProps) => (
  <CommandEmpty data-slot="model-selector-empty" {...props}>
    {children ?? "No models found."}
  </CommandEmpty>
);

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>;

const ModelSelectorGroup = (props: ModelSelectorGroupProps) => (
  <CommandGroup data-slot="model-selector-group" {...props} />
);

export type ModelSelectorItemProps = CommandItemProps & {
  /** Overrides the tick, for a row that stands for something else. */
  checked?: boolean;
};

function ModelSelectorItem({ children, checked, value, ...props }: ModelSelectorItemProps) {
  const { value: chosen } = useModelSelector("ModelSelectorItem");
  const ticked = checked ?? chosen === value;

  return (
    <CommandItem data-checked={ticked} data-slot="model-selector-item" value={value} {...props}>
      {children}
      <CheckIcon data-checked={ticked} style={sx(u.icon, !ticked && { visibility: "hidden" })} />
    </CommandItem>
  );
}

export type ModelSelectorNameProps = WithSx<ComponentProps<"span">>;

const ModelSelectorName = ({ className, style, ...props }: ModelSelectorNameProps) => (
  <span
    className={className}
    data-slot="model-selector-name"
    style={sx(S.modelSelectorName, style)}
    {...props}
  />
);

export type ModelSelectorShortcutProps = ComponentProps<typeof CommandShortcut>;

const ModelSelectorShortcut = (props: ModelSelectorShortcutProps) => (
  <CommandShortcut data-slot="model-selector-shortcut" {...props} />
);

export type ModelSelectorSeparatorProps = ComponentProps<typeof CommandSeparator>;

const ModelSelectorSeparator = (props: ModelSelectorSeparatorProps) => (
  <CommandSeparator data-slot="model-selector-separator" {...props} />
);

export {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorValue,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorName,
  ModelSelectorShortcut,
  ModelSelectorSeparator,
};
