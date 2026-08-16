import type { ComponentChildren, ComponentProps, FunctionComponent } from "preact";
import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";
import { memo } from "preact/compat";

import { Badge } from "../../ui/badge.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible.tsx";
import { BrainIcon, Chevron, DotIcon, type IconProps } from "../../../lib/icons.tsx";
import { useControllableState } from "../../../lib/use-controllable-state.ts";
import { useInteraction } from "../../../lib/use-interaction.ts";
import { reset, u } from "../../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../../styles/sx.ts";

const S = {
  cot: {
    display: "flex",
    width: "100%",
    flexDirection: "column",
    gap: "1rem",
  },
  cotHeader: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    transition: "color var(--transition)",
  },
  cotHeaderHover: {
    color: "var(--foreground)",
  },
  cotLabel: {
    flex: "1",
    textAlign: "left",
  },
  cotStep: {
    display: "flex",
    gap: "0.5rem",
    fontSize: "0.875rem",
  },
  cotStepActive: {
    color: "var(--foreground)",
  },
  cotStepComplete: {
    color: "var(--muted-foreground)",
  },
  cotStepPending: {
    color: "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  cotMarker: {
    position: "relative",
    marginTop: "0.125rem",
  },
  // The rail that joins one step to the next.
  cotRail: {
    position: "absolute",
    top: "1.75rem",
    bottom: "0",
    left: "50%",
    width: "1px",
    marginInline: "-1px",
    background: "var(--border)",
  },
  cotStepBody: {
    display: "flex",
    flex: "1",
    flexDirection: "column",
    gap: "0.5rem",
    overflow: "hidden",
  },
  cotDescription: {
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  cotResults: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
  },
  cotResult: {
    gap: "0.25rem",
    padding: "0.125rem 0.5rem",
    fontWeight: "400",
  },
  cotContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    marginTop: "0.5rem",
    outline: "none",
  },
  // The panel is a `CollapsibleContent`, which hides itself with the `hidden`
  // attribute. An inline `display` would outrank the UA `[hidden]` rule, so
  // closing has to be driven from here too, in the same expression.
  cotContentHidden: { display: "none" },
  cotImage: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  cotFrame: {
    boxSizing: "border-box",
    display: "flex",
    maxHeight: "22rem",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: "var(--radius-lg)",
    background: "var(--muted)",
    padding: "0.75rem",
  },
  cotCaption: {
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(null);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error("ChainOfThought components must be used within ChainOfThought");
  }
  return context;
};

export type ChainOfThoughtProps = WithSx<ComponentProps<"div">> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    children,
    style,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    });

    const contextValue = useMemo(() => ({ isOpen, setIsOpen }), [isOpen, setIsOpen]);

    return (
      <ChainOfThoughtContext.Provider value={contextValue}>
        <div className={className} style={sx(S.cot, style)} {...props}>
          {children}
        </div>
      </ChainOfThoughtContext.Provider>
    );
  },
);

export type ChainOfThoughtHeaderProps = WithSx<ComponentProps<typeof CollapsibleTrigger>>;

export const ChainOfThoughtHeader = memo(
  ({ className, children, style, ...props }: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen } = useChainOfThought();
    const { hovered, handlers } = useInteraction<HTMLButtonElement>(props);

    return (
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger
          className={className}
          style={sx(S.cotHeader, hovered && S.cotHeaderHover, style)}
          {...props}
          {...handlers}
        >
          <BrainIcon style={u.icon} />
          <span style={S.cotLabel}>{children ?? "Chain of Thought"}</span>
          <Chevron open={isOpen} />
        </CollapsibleTrigger>
      </Collapsible>
    );
  },
);

const STEP_STATUS = {
  active: S.cotStepActive,
  complete: S.cotStepComplete,
  pending: S.cotStepPending,
} as const;

export type ChainOfThoughtStepProps = WithSx<ComponentProps<"div">> & {
  icon?: FunctionComponent<IconProps>;
  label: ComponentChildren;
  description?: ComponentChildren;
  status?: keyof typeof STEP_STATUS;
};

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon: Icon = DotIcon,
    label,
    description,
    status = "complete",
    children,
    style,
    ...props
  }: ChainOfThoughtStepProps) => (
    <div className={className} style={sx(S.cotStep, STEP_STATUS[status], style)} {...props}>
      <div style={S.cotMarker}>
        <Icon style={u.icon} />
        <div style={S.cotRail} />
      </div>
      <div style={S.cotStepBody}>
        <div>{label}</div>
        {description && <div style={S.cotDescription}>{description}</div>}
        {children}
      </div>
    </div>
  ),
);

export type ChainOfThoughtSearchResultsProps = WithSx<ComponentProps<"div">>;

export const ChainOfThoughtSearchResults = memo(
  ({ className, style, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div className={className} style={sx(S.cotResults, style)} {...props} />
  ),
);

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

export const ChainOfThoughtSearchResult = memo(
  ({ className, children, style, ...props }: ChainOfThoughtSearchResultProps) => (
    <Badge className={className} style={sx(S.cotResult, style)} variant="secondary" {...props}>
      {children}
    </Badge>
  ),
);

export type ChainOfThoughtContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const ChainOfThoughtContent = memo(
  ({ className, children, style, ...props }: ChainOfThoughtContentProps) => {
    const { isOpen } = useChainOfThought();

    return (
      <Collapsible open={isOpen}>
        <CollapsibleContent
          className={className}
          style={sx(S.cotContent, !isOpen && S.cotContentHidden, style)}
          {...props}
        >
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  },
);

export type ChainOfThoughtImageProps = WithSx<ComponentProps<"div">> & {
  caption?: string;
};

export const ChainOfThoughtImage = memo(
  ({ className, children, caption, style, ...props }: ChainOfThoughtImageProps) => (
    <div className={className} style={sx(S.cotImage, style)} {...props}>
      <div style={S.cotFrame}>{children}</div>
      {caption && <p style={sx(reset.text, S.cotCaption)}>{caption}</p>}
    </div>
  ),
);
