import type { ComponentChildren, ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { memo } from "preact/compat";

import { Markdown } from "@/components/markdown";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BrainIcon, Chevron } from "@/lib/icons";
import { useControllableState } from "@/lib/use-controllable-state";
import { useInteraction } from "@/lib/use-interaction";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

import { Shimmer } from "./shimmer";

const S = {
  reasoning: {
    marginBottom: "1rem",
  },
  reasoningTrigger: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    transition: "color var(--transition)",
  },
  reasoningTriggerHover: {
    color: "var(--foreground)",
  },
  reasoningContent: {
    marginTop: "1rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    outline: "none",
  },
} satisfies Record<string, Sx>;

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = WithSx<ComponentProps<typeof Collapsible>> & {
  isStreaming?: boolean;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className,
    style,
    isStreaming = false,
    open,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    // An explicit `defaultOpen={false}` opts out of auto-opening on stream.
    const isExplicitlyClosed = defaultOpen === false;

    const [isOpen, setIsOpen] = useControllableState<boolean>({
      defaultProp: defaultOpen ?? isStreaming,
      onChange: onOpenChange,
      prop: open,
    });
    const [duration, setDuration] = useControllableState<number | undefined>({
      defaultProp: undefined,
      prop: durationProp,
    });

    const hasEverStreamedRef = useRef(isStreaming);
    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const startTimeRef = useRef<number | null>(null);

    useEffect(() => {
      if (isStreaming) {
        hasEverStreamedRef.current = true;
        startTimeRef.current ??= Date.now();
      } else if (startTimeRef.current !== null) {
        setDuration(Math.ceil((Date.now() - startTimeRef.current) / MS_IN_S));
        startTimeRef.current = null;
      }
    }, [isStreaming, setDuration]);

    useEffect(() => {
      if (isStreaming && !isOpen && !isExplicitlyClosed) setIsOpen(true);
    }, [isStreaming, isOpen, setIsOpen, isExplicitlyClosed]);

    useEffect(() => {
      if (hasEverStreamedRef.current && !isStreaming && isOpen && !hasAutoClosed) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, setIsOpen, hasAutoClosed]);

    const contextValue = useMemo(
      () => ({ duration, isOpen, isStreaming, setIsOpen }),
      [duration, isOpen, isStreaming, setIsOpen],
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        <Collapsible
          className={className}
          onOpenChange={setIsOpen}
          open={isOpen}
          style={sx(S.reasoning, style)}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  },
);

export type ReasoningTriggerProps = WithSx<ComponentProps<typeof CollapsibleTrigger>> & {
  getThinkingMessage?: (isStreaming: boolean, duration?: number) => ComponentChildren;
};

const defaultGetThinkingMessage = (isStreaming: boolean, duration?: number) => {
  if (isStreaming || duration === 0) {
    return <Shimmer duration={1}>Thinking...</Shimmer>;
  }
  if (duration === undefined) {
    return <p style={reset.text}>Thought for a few seconds</p>;
  }
  return <p style={reset.text}>Thought for {duration} seconds</p>;
};

export const ReasoningTrigger = memo(
  ({
    className,
    style,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();
    const { hovered, handlers } = useInteraction<HTMLButtonElement>(props);

    return (
      <CollapsibleTrigger
        className={className}
        style={sx(S.reasoningTrigger, hovered && S.reasoningTriggerHover, style)}
        {...props}
        {...handlers}
      >
        {children ?? (
          <>
            <BrainIcon style={u.icon} />
            {getThinkingMessage(isStreaming, duration)}
            <Chevron open={isOpen} />
          </>
        )}
      </CollapsibleTrigger>
    );
  },
);

export type ReasoningContentProps = Omit<
  WithSx<ComponentProps<typeof CollapsibleContent>>,
  "children"
> & {
  children: string;
};

/** Thinking text, rendered as markdown. */
export const ReasoningContent = memo(
  ({ className, style, children, ...props }: ReasoningContentProps) => {
    const { isStreaming } = useReasoning();

    return (
      <CollapsibleContent className={className} style={sx(S.reasoningContent, style)} {...props}>
        <Markdown animate={isStreaming}>{children}</Markdown>
      </CollapsibleContent>
    );
  },
);
