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
import { buttonSx } from "@/components/ui/button";
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
 * COMPONENTS.md.
 */
const S = {
  // Was the `.wa-popover-content.wa-model-selector-content` compound: the
  // popover's own padding and width are wrong for a list, so this must reach
  // PopoverContent as `style` to keep outranking it.
  modelSelectorContent: {
    width: "20rem",
    padding: "0",
  },
  // The trigger renders `PopoverTrigger`, not `Button`, so its box comes from
  // `buttonSx({ variant: "outline", size: "sm" })` (ui/button.tsx) plus the
  // two properties Button does not set — `justifyContent`/`minWidth`/
  // `maxWidth` fit a value-and-chevron layout rather than centred text.
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

export type ModelSelectorTriggerProps = PopoverTriggerProps;

function ModelSelectorTrigger({ className, style, children, ...props }: ModelSelectorTriggerProps) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <PopoverTrigger
      className={className}
      data-slot="model-selector-trigger"
      style={sx(
        buttonSx({ focusVisible, hasIcon: true, hovered, size: "sm", variant: "outline" }),
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
};

function ModelSelectorContent({
  className,
  children,
  filter,
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
        onValueChange={(next) => {
          setValue(next);
          setOpen(false);
        }}
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

const ModelSelectorEmpty = (props: ModelSelectorEmptyProps) => (
  <CommandEmpty data-slot="model-selector-empty" {...props}>
    No models found.
  </CommandEmpty>
);

export type ModelSelectorGroupProps = ComponentProps<typeof CommandGroup>;

const ModelSelectorGroup = (props: ModelSelectorGroupProps) => (
  <CommandGroup data-slot="model-selector-group" {...props} />
);

export type ModelSelectorItemProps = CommandItemProps;

function ModelSelectorItem({ children, value, ...props }: ModelSelectorItemProps) {
  const { value: chosen } = useModelSelector("ModelSelectorItem");
  const checked = chosen === value;

  return (
    <CommandItem data-slot="model-selector-item" value={value} {...props}>
      {children}
      <CheckIcon data-checked={checked} style={sx(u.icon, !checked && { visibility: "hidden" })} />
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
