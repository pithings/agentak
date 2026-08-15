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
} from "../ui/command.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopover,
  type PopoverContentProps,
  type PopoverProps,
  type PopoverTriggerProps,
} from "../ui/popover.tsx";
import { buttonSx, type ButtonSize, type ButtonVariant } from "../ui/button.tsx";
import { useControllableState } from "../../lib/use-controllable-state.ts";
import { useInteraction } from "../../lib/use-interaction.ts";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "../../lib/icons.tsx";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

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
  //
  // A column capped at the room the popover measured, which a virtual keyboard
  // takes most of. `Command` and its list both clip, so both may shrink under
  // it: the search field and the strip keep their height and the list gives up
  // the rest, scrolling in what is left rather than opening off the top of the
  // surface with no way to reach the first row.
  modelSelectorContent: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    width: "17rem",
    maxHeight: "var(--popover-available, none)",
    padding: "0",
  },
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
  // Shrinks to an ellipsis but never grows: the tick sits against the name, and
  // the shortcut keeps the far side to itself over its own `margin-left: auto`.
  modelSelectorName: {
    flex: "0 1 auto",
    minWidth: "0",
    overflow: "hidden",
    textAlign: "left",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // A model list is long and reads as secondary chrome, so the text runs one
  // step below `ui/command.tsx`. The boxes do not follow it down: a row is a
  // finger target first, so it keeps a height a thumb can hit.
  modelSelectorIcon: { width: "0.875rem", height: "0.875rem" },
  // The tick is the last child, so the two `order`s put it back beside the name
  // and leave the shortcut at the end of the row.
  modelSelectorCheck: { order: "1" },
  // Replacing the default magnifier drops what `CommandInput` set on it.
  modelSelectorSearchIcon: { flexShrink: "0", color: "var(--muted-foreground)" },
  modelSelectorInput: { height: "2.75rem", fontSize: "0.8125rem" },
  modelSelectorList: { maxHeight: "18rem" },
  modelSelectorEmpty: { padding: "1.25rem 0.75rem", fontSize: "0.75rem" },
  // `minHeight` rather than `height`: a row that wraps grows, and the padding
  // then keeps the text off the edges.
  modelSelectorItem: {
    gap: "0.5rem",
    minHeight: "2.5rem",
    padding: "0.5rem 0.625rem",
    fontSize: "0.8125rem",
  },
  modelSelectorShortcut: { order: "2", fontSize: "0.6875rem" },
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
  size = "xs",
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
      <ChevronsUpDownIcon style={sx(S.modelSelectorIcon, S.modelSelectorChevron)} />
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

const ModelSelectorInput = ({ style, ...props }: ModelSelectorInputProps) => (
  <CommandInput
    data-slot="model-selector-input"
    icon={<SearchIcon style={sx(S.modelSelectorIcon, S.modelSelectorSearchIcon)} />}
    placeholder="Search models…"
    style={sx(S.modelSelectorInput, style)}
    {...props}
  />
);

export type ModelSelectorListProps = ComponentProps<typeof CommandList>;

const ModelSelectorList = ({ style, ...props }: ModelSelectorListProps) => (
  <CommandList data-slot="model-selector-list" style={sx(S.modelSelectorList, style)} {...props} />
);

export type ModelSelectorEmptyProps = ComponentProps<typeof CommandEmpty>;

const ModelSelectorEmpty = ({ children, style, ...props }: ModelSelectorEmptyProps) => (
  <CommandEmpty data-slot="model-selector-empty" style={sx(S.modelSelectorEmpty, style)} {...props}>
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

function ModelSelectorItem({ children, checked, style, value, ...props }: ModelSelectorItemProps) {
  const { value: chosen } = useModelSelector("ModelSelectorItem");
  const ticked = checked ?? chosen === value;

  return (
    <CommandItem
      data-checked={ticked}
      data-slot="model-selector-item"
      style={sx(S.modelSelectorItem, style)}
      value={value}
      {...props}
    >
      {children}
      <CheckIcon
        data-checked={ticked}
        style={sx(S.modelSelectorIcon, S.modelSelectorCheck, !ticked && { visibility: "hidden" })}
      />
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

const ModelSelectorShortcut = ({ style, ...props }: ModelSelectorShortcutProps) => (
  <CommandShortcut
    data-slot="model-selector-shortcut"
    style={sx(S.modelSelectorShortcut, style)}
    {...props}
  />
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
