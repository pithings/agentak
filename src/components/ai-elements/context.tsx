import type { ComponentChild, ComponentChildren, ComponentProps, VNode } from "preact";
import { cloneElement, createContext, isValidElement, toChildArray } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buttonSx } from "@/components/ui/button";
import { useInteraction } from "@/lib/use-interaction";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";
import type { LanguageModelUsage } from "@/types";

/** A line between children — a flex `gap` cannot draw one. */
const DIVIDER: Sx = { borderTop: "1px solid var(--border)" };

/** Narrows `isValidElement` so the clone below can type the `style` it adds. */
function hasStyle(child: ComponentChild): child is VNode<{ style?: Sx }> {
  return isValidElement(child);
}

function withDividers(children: ComponentChildren): ComponentChildren {
  return toChildArray(children).map((child, index) =>
    index > 0 && hasStyle(child)
      ? cloneElement(child, { style: sx(DIVIDER, child.props.style) })
      : child,
  );
}

const S = {
  context: {
    width: "fit-content",
    fontSize: "0.75rem",
  },
  // Only while the pointer is away: the ghost variant repaints the colour on
  // hover, and it is `buttonSx` that paints it now.
  contextTrigger: { color: "var(--muted-foreground)" },
  // Bigger than a button icon, because the reading sits inside it.
  contextRing: { width: "1.5rem", height: "1.5rem" },
  // The ring is drawn from 12 o'clock, so the arc turns a quarter back.
  contextRingTrack: {
    opacity: "0.25",
  },
  contextRingArc: {
    opacity: "0.7",
    transform: "rotate(-90deg)",
    transformOrigin: "center",
  },
  // In user units, so the reading scales with the ring.
  contextRingLabel: {
    fill: "currentColor",
    fontSize: "9px",
    fontWeight: "500",
    fontVariantNumeric: "tabular-nums",
  },
  contextContent: {
    boxSizing: "border-box",
    minWidth: "15rem",
    marginTop: "0.5rem",
    overflow: "hidden",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    background: "var(--background)",
    boxShadow: "var(--shadow-xs)",
  },
  contextHeader: { boxSizing: "border-box", width: "100%", padding: "0.75rem" },
  contextSummary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  contextModel: {
    marginTop: "0.25rem",
  },
  // Only when the window is nearly spent, so the meter reads as a reading
  // until it reads as a warning.
  contextNear: {
    marginTop: "0.5rem",
    color: "var(--warning)",
  },
  contextNearFill: {
    background: "var(--warning)",
  },
  contextMeter: {
    display: "flex",
    height: "0.5rem",
    marginTop: "0.5rem",
    overflow: "hidden",
    borderRadius: "9999px",
    background: "var(--muted)",
  },
  contextMeterFill: {
    background: "var(--primary)",
    transition: "width var(--transition)",
  },
  contextBody: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    flexDirection: "column",
    gap: "0.375rem",
    padding: "0.75rem",
  },
  contextRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  contextCost: {
    marginLeft: "0.5rem",
    color: "var(--muted-foreground)",
  },
  contextFooter: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.75rem",
    background: "var(--secondary)",
  },
} satisfies Record<string, Sx>;

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

/** Costs in USD. Upstream priced the usage with `tokenlens`; a caller does it now. */
export interface ContextCosts {
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: number;
  total?: number;
}

interface ContextSchema {
  usedTokens: number;
  maxTokens: number;
  usage?: LanguageModelUsage;
  modelId?: string;
  costs?: ContextCosts;
  /**
   * The next turn may not fit. Where the line is belongs to whoever counts the
   * tokens — the meter only reports it, in the ring and in the panel.
   */
  nearLimit?: boolean;
}

const ContextContext = createContext<ContextSchema | null>(null);

const useContextValue = () => {
  const context = useContext(ContextContext);
  if (!context) throw new Error("Context components must be used within Context");
  return context;
};

const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, style: "percent" });
const compact = new Intl.NumberFormat("en-US", { notation: "compact" });
// Four digits, because a turn often costs less than a cent.
const currency = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 4,
  style: "currency",
});

export type ContextProps = WithSx<ComponentProps<typeof Collapsible>> & ContextSchema;

/**
 * Model context usage. A ring in the trigger, the breakdown in the panel.
 *
 * The panel is a collapsible rather than a hover card, and every cost arrives
 * as a prop — see `.agents/components/porting.md`.
 */
export const Context = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  costs,
  nearLimit,
  className,
  style,
  children,
  ...props
}: ContextProps) => {
  const value = useMemo(
    () => ({ costs, maxTokens, modelId, nearLimit, usage, usedTokens }),
    [costs, maxTokens, modelId, nearLimit, usage, usedTokens],
  );

  return (
    <ContextContext.Provider value={value}>
      {/* Kept as a stable hook for the whole widget, same as the other
          `context-*` parts below it — nothing sizes off it directly. */}
      <Collapsible className={className} style={sx(S.context, style)} {...props}>
        {children ?? (
          <>
            <ContextTrigger />
            <ContextContent>
              <ContextContentHeader />
              {usage && (
                <ContextContentBody>
                  <ContextInputUsage />
                  <ContextOutputUsage />
                  <ContextReasoningUsage />
                  <ContextCacheUsage />
                </ContextContentBody>
              )}
              {costs && <ContextContentFooter />}
            </ContextContent>
          </>
        )}
      </Collapsible>
    </ContextContext.Provider>
  );
};

/** The ring, with the reading inside it — `role="img"` hides the text, so the label carries it. */
const ContextIcon = () => {
  const { usedTokens, maxTokens, nearLimit } = useContextValue();
  const circumference = 2 * Math.PI * ICON_RADIUS;
  const used = Math.min(usedTokens / maxTokens, 1);

  return (
    <svg
      aria-label={`Model context usage: ${percent.format(usedTokens / maxTokens)}${
        nearLimit ? ", near the limit" : ""
      }`}
      height="24"
      role="img"
      style={sx(reset.svg, S.contextRing)}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="24"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        r={ICON_RADIUS}
        stroke="currentColor"
        stroke-width={ICON_STROKE_WIDTH}
        style={S.contextRingTrack}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        r={ICON_RADIUS}
        stroke="currentColor"
        stroke-dasharray={`${circumference} ${circumference}`}
        stroke-dashoffset={circumference * (1 - used)}
        stroke-linecap="round"
        stroke-width={ICON_STROKE_WIDTH}
        style={S.contextRingArc}
      />
      {/* Whole percent only — a fraction does not fit the ring. */}
      <text
        dominant-baseline="central"
        style={S.contextRingLabel}
        text-anchor="middle"
        x={ICON_CENTER}
        y={ICON_CENTER}
      >
        {Math.round(used * PERCENT_MAX)}
      </text>
    </svg>
  );
};

export type ContextTriggerProps = WithSx<ComponentProps<typeof CollapsibleTrigger>>;

/**
 * A `CollapsibleTrigger`, not a `Button` — so it carries the whole button look
 * itself, states included. The default child is the ring alone, the reading
 * inside it, so the trigger is a square the size of any other footer icon.
 */
export const ContextTrigger = ({ className, style, children, ...props }: ContextTriggerProps) => {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>(props);
  const { nearLimit } = useContextValue();

  return (
    <CollapsibleTrigger
      className={className}
      style={sx(
        buttonSx({
          focusVisible,
          hasIcon: !children,
          hovered,
          size: children ? "sm" : "icon-sm",
          variant: "ghost",
        }),
        // The ring is drawn in `currentColor`, so the warning reaches it from
        // here — the one reading a reader sees without opening the panel.
        !hovered && (nearLimit ? u.warning : S.contextTrigger),
        style,
      )}
      {...props}
      {...handlers}
    >
      {children ?? <ContextIcon />}
    </CollapsibleTrigger>
  );
};

export type ContextContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const ContextContent = ({ className, style, children, ...props }: ContextContentProps) => (
  <CollapsibleContent className={className} style={sx(S.contextContent, style)} {...props}>
    {withDividers(children)}
  </CollapsibleContent>
);

export type ContextContentHeaderProps = WithSx<ComponentProps<"div">>;

export const ContextContentHeader = ({ style, children, ...props }: ContextContentHeaderProps) => {
  const { usedTokens, maxTokens, modelId, nearLimit } = useContextValue();
  const used = usedTokens / maxTokens;

  return (
    <div style={sx(S.contextHeader, style)} {...props}>
      {children ?? (
        <>
          <div style={S.contextSummary}>
            <p style={reset.text}>{percent.format(used)}</p>
            <p style={sx(reset.text, u.mono, u.muted)}>
              {compact.format(usedTokens)} / {compact.format(maxTokens)}
            </p>
          </div>
          {/* The model is a label now — nothing looks its limits up. */}
          {modelId && <p style={sx(reset.text, u.mono, u.muted, S.contextModel)}>{modelId}</p>}
          <div
            aria-valuemax={PERCENT_MAX}
            aria-valuemin={0}
            aria-valuenow={Math.round(used * PERCENT_MAX)}
            role="progressbar"
            style={S.contextMeter}
          >
            <div
              data-slot="context-meter-fill"
              style={sx(S.contextMeterFill, nearLimit && S.contextNearFill, {
                width: `${(Math.min(used, 1) * PERCENT_MAX).toFixed(1)}%`,
              })}
            />
          </div>
          {/* Nothing here compacts a conversation yet, so the answer is a new
              one — say that, rather than only that the window is nearly gone. */}
          {nearLimit && (
            <p style={sx(reset.text, S.contextNear)}>
              Near the context limit. Start a new conversation soon.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export type ContextContentBodyProps = WithSx<ComponentProps<"div">>;

export const ContextContentBody = ({
  className,
  style,
  children,
  ...props
}: ContextContentBodyProps) => (
  <div className={className} style={sx(S.contextBody, style)} {...props}>
    {children}
  </div>
);

export type ContextContentFooterProps = WithSx<ComponentProps<"div">>;

export const ContextContentFooter = ({ style, children, ...props }: ContextContentFooterProps) => {
  const { costs } = useContextValue();
  const total =
    costs?.total ??
    (costs?.input ?? 0) + (costs?.output ?? 0) + (costs?.reasoning ?? 0) + (costs?.cache ?? 0);

  if (!children && !total) return null;

  return (
    <div style={sx(S.contextFooter, style)} {...props}>
      {children ?? (
        <>
          <span style={u.muted}>Total cost</span>
          <span>{currency.format(total)}</span>
        </>
      )}
    </div>
  );
};

const Tokens = ({ tokens, cost }: { tokens?: number; cost?: number }) => (
  <span>
    {tokens === undefined ? "—" : compact.format(tokens)}
    {/* A zero costs nothing to hide, and reads as noise beside the tokens. */}
    {cost ? <span style={S.contextCost}>• {currency.format(cost)}</span> : null}
  </span>
);

type UsageRowProps = WithSx<ComponentProps<"div">> & {
  label: string;
  tokens: number;
  cost?: number;
  children?: ComponentChildren;
};

/** One line of the breakdown. Hidden when the model reported no such tokens. */
const UsageRow = ({ label, tokens, cost, style, children, ...props }: UsageRowProps) => {
  if (!children && !tokens) return null;

  return (
    <div style={sx(S.contextRow, style)} {...props}>
      {children ?? (
        <>
          <span style={u.muted}>{label}</span>
          <Tokens cost={cost} tokens={tokens} />
        </>
      )}
    </div>
  );
};

export type ContextUsageProps = WithSx<ComponentProps<"div">>;

export const ContextInputUsage = (props: ContextUsageProps) => {
  const { usage, costs } = useContextValue();
  return <UsageRow cost={costs?.input} label="Input" tokens={usage?.inputTokens ?? 0} {...props} />;
};

export const ContextOutputUsage = (props: ContextUsageProps) => {
  const { usage, costs } = useContextValue();
  return (
    <UsageRow cost={costs?.output} label="Output" tokens={usage?.outputTokens ?? 0} {...props} />
  );
};

export const ContextReasoningUsage = (props: ContextUsageProps) => {
  const { usage, costs } = useContextValue();
  return (
    <UsageRow
      cost={costs?.reasoning}
      label="Reasoning"
      tokens={usage?.reasoningTokens ?? 0}
      {...props}
    />
  );
};

export const ContextCacheUsage = (props: ContextUsageProps) => {
  const { usage, costs } = useContextValue();
  return (
    <UsageRow cost={costs?.cache} label="Cache" tokens={usage?.cachedInputTokens ?? 0} {...props} />
  );
};
