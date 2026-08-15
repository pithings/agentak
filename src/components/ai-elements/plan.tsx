import type { ComponentChild, ComponentProps, VNode } from "preact";
import { cloneElement, createContext, isValidElement, toChildArray } from "preact";
import { useContext, useMemo } from "preact/hooks";

import {
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "../ui/collapsible.tsx";
import { buttonSx } from "../ui/button.tsx";
import { ChevronsUpDownIcon } from "../../lib/icons.tsx";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

import { Shimmer } from "./shimmer.tsx";

const S = {
  // Collapsible renders the div in place of `Card`, so the card's own box is
  // reproduced here directly — `Card`'s box is inline only within `<Card>`
  // itself now (see ui/card.tsx). `boxShadow: "none"` is the one deliberate
  // override: a plan looks like a card but flat.
  plan: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
    paddingBlock: "1.5rem",
    color: "var(--foreground)",
    boxShadow: "none",
  },
  // Same reasoning: CardContent's own padding is inline only within
  // `<CardContent>` itself, and PlanContent renders `CollapsibleContent` in
  // its place.
  planContent: {
    paddingInline: "1.5rem",
  },
  planDescription: {
    textWrap: "balance",
  },
  // Title and description toggle too, so they read as part of the trigger.
  // The button stays the keyboard path — these are pointer only.
  planToggle: {
    cursor: "pointer",
    userSelect: "none",
  },
  planSteps: {
    paddingLeft: "1.25rem",
    fontSize: "0.875rem",
    listStyle: "decimal",
  },
  planStepGap: {
    marginTop: "0.25rem",
  },
} satisfies Record<string, Sx>;

interface PlanContextValue {
  isStreaming: boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("Plan components must be used within Plan");
  }
  return context;
};

export type PlanProps = WithSx<ComponentProps<typeof Collapsible>> & {
  isStreaming?: boolean;
};

// Collapsible renders the div, so the card look goes straight on it —
// upstream needed `asChild` for the same result.
export const Plan = ({ className, isStreaming = false, children, style, ...props }: PlanProps) => {
  const contextValue = useMemo(() => ({ isStreaming }), [isStreaming]);

  return (
    <PlanContext.Provider value={contextValue}>
      <Collapsible className={className} data-slot="plan" style={sx(S.plan, style)} {...props}>
        {children}
      </Collapsible>
    </PlanContext.Provider>
  );
};

export type PlanHeaderProps = ComponentProps<typeof CardHeader>;

// The card header's own grid is the layout: title on the first row,
// description under it, the action in a column of its own.
export const PlanHeader = (props: PlanHeaderProps) => (
  <CardHeader data-slot="plan-header" {...props} />
);

export type PlanTitleProps = Omit<ComponentProps<typeof CardTitle>, "children"> & {
  children: string;
};

export const PlanTitle = ({ children, onClick, style, ...props }: PlanTitleProps) => {
  const { isStreaming } = usePlan();
  const { open, setOpen } = useCollapsible("PlanTitle");

  return (
    <CardTitle
      data-slot="plan-title"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      style={sx(S.planToggle, style)}
      {...props}
    >
      {isStreaming ? <Shimmer>{children}</Shimmer> : children}
    </CardTitle>
  );
};

export type PlanDescriptionProps = Omit<ComponentProps<typeof CardDescription>, "children"> & {
  children: string;
};

export const PlanDescription = ({
  className,
  children,
  onClick,
  style,
  ...props
}: PlanDescriptionProps) => {
  const { isStreaming } = usePlan();
  const { open, setOpen } = useCollapsible("PlanDescription");

  return (
    <CardDescription
      className={className}
      data-slot="plan-description"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      style={sx(S.planDescription, S.planToggle, style)}
      {...props}
    >
      {isStreaming ? <Shimmer>{children}</Shimmer> : children}
    </CardDescription>
  );
};

export type PlanActionProps = ComponentProps<typeof CardAction>;

export const PlanAction = (props: PlanActionProps) => (
  <CardAction data-slot="plan-action" {...props} />
);

export type PlanContentProps = ComponentProps<typeof CardContent>;

export const PlanContent = ({ className, style, ...props }: PlanContentProps) => (
  <CollapsibleContent
    className={className}
    data-slot="plan-content"
    style={sx(S.planContent, style)}
    {...props}
  />
);

export type PlanFooterProps = ComponentProps<typeof CardFooter>;

export const PlanFooter = (props: PlanFooterProps) => (
  <CardFooter data-slot="plan-footer" {...props} />
);

export type PlanStepsProps = WithSx<ComponentProps<"ol">>;

/** An ordered list of steps, the usual plan body. */
export const PlanSteps = ({ className, style, children, ...props }: PlanStepsProps) => (
  <ol className={className} style={sx(reset.list, S.planSteps, style)} {...props}>
    {toChildArray(children).map((child, index) =>
      index > 0 && hasStyle(child)
        ? cloneElement(child, { style: sx(S.planStepGap, child.props.style) })
        : child,
    )}
  </ol>
);

/** Narrows `isValidElement` so the clone above can type the `style` it adds. */
function hasStyle(child: ComponentChild): child is VNode<{ style?: Sx }> {
  return isValidElement(child);
}

export type PlanTriggerProps = WithSx<ComponentProps<typeof CollapsibleTrigger>>;

// The trigger is the button, so it carries the button look rather than a
// nested `Button` — a button inside a button is invalid. `buttonSx` is the
// same look `Button` computes, states included.
export const PlanTrigger = ({ className, style, ...props }: PlanTriggerProps) => {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <CollapsibleTrigger
      className={className}
      data-slot="plan-trigger"
      style={sx(buttonSx({ focusVisible, hovered, size: "icon-sm", variant: "ghost" }), style)}
      {...props}
      {...handlers}
    >
      <ChevronsUpDownIcon style={u.icon} />
      <span style={u.srOnly}>Toggle plan</span>
    </CollapsibleTrigger>
  );
};
