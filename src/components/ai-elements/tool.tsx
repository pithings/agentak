import type { ComponentChildren, ComponentProps } from "preact";
import { isValidElement } from "preact";

import type { DynamicToolUIPart, ToolUIPart } from "../../types.ts";
import { Badge } from "../ui/badge.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "../ui/collapsible.tsx";
import {
  CheckCircleIcon,
  Chevron,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "../../lib/icons.tsx";
import { useAnimation } from "../../lib/use-animation.ts";
import { pulseKeyframes, pulseOptions, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

import { CodeBlock } from "./code-block.tsx";

/**
 * The input/output box. Exported so other files that render the same surface
 * on a plain `<div>` — `agent.tsx`, `test-results.tsx` — can reuse it instead
 * of duplicating the declarations (same pattern as `controlSx` in `ui/input.tsx`).
 */
export const toolBodySx = {
  overflowX: "auto",
  borderRadius: "var(--radius-md)",
  background: "var(--muted-surface)",
  color: "var(--foreground)",
  fontSize: "0.75rem",
} satisfies Sx;

/**
 * A `CodeBlock` inside one of those bodies. The body already paints the
 * surface, and the block paints the same one — two tints would stack into a
 * box darker than either.
 */
export const toolCodeSx = { background: "transparent" } satisfies Sx;

export const toolBodyErrorSx = {
  background: "var(--destructive-surface)",
  color: "var(--destructive)",
} satisfies Sx;

const S = {
  tool: {
    boxSizing: "border-box",
    width: "100%",
    marginBottom: "1rem",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  toolHeader: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem",
  },
  toolTitle: {
    display: "flex",
    flex: "1",
    minWidth: "0",
    alignItems: "center",
    gap: "0.5rem",
    overflow: "hidden",
    textAlign: "left",
  },
  toolName: {
    flexShrink: "0",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  // The input on the header line, when it is short enough to read there. It is
  // the part that gives, so it takes the ellipsis and the name never does.
  toolSummary: {
    minWidth: "0",
    overflow: "hidden",
    color: "var(--muted-foreground)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Status and chevron, held to the right of whatever the title does.
  toolMeta: {
    display: "flex",
    flexShrink: "0",
    alignItems: "center",
    gap: "0.5rem",
  },
  toolContent: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1rem",
    color: "var(--foreground)",
    outline: "none",
  },
  // The panel is a `CollapsibleContent`, which hides itself with the `hidden`
  // attribute. An inline `display` would outrank the UA `[hidden]` rule, so
  // closing has to be driven from here too, in the same expression.
  hidden: { display: "none" },
  // The label rides the body itself, so a section is the body and nothing else.
  toolSection: {
    position: "relative",
    overflow: "hidden",
  },
  // A badge in the corner of the surface, not a heading over it — one line of
  // height saved per section, and the box still says which one it is.
  toolLabel: {
    position: "absolute",
    top: "0",
    right: "0",
    zIndex: "1",
    padding: "0.125rem 0.375rem",
    borderBottomLeftRadius: "var(--radius-sm)",
    background: "var(--muted-surface)",
    color: "var(--muted-foreground)",
    fontSize: "0.625rem",
    fontWeight: "500",
    letterSpacing: "0.05em",
    lineHeight: "1.4",
    textTransform: "uppercase",
    pointerEvents: "none",
  },
  toolLabelError: {
    background: "var(--destructive-surface)",
    color: "var(--destructive)",
  },
  // Output that is not a `CodeBlock` — plain text with no padding of its own,
  // and room at the top right for the badge.
  toolText: {
    overflowX: "auto",
    padding: "0.5rem 0.75rem",
    paddingRight: "5rem",
  },
  // Sized by whatever `style` a caller clones onto it — see `PulsingClockIcon`.
  pulseIconWrap: { display: "inline-flex" },
  pulseIconGlyph: { width: "100%", height: "100%" },
} satisfies Record<string, Sx>;

export type ToolProps = WithSx<ComponentProps<typeof Collapsible>>;

export const Tool = ({ className, style, ...props }: ToolProps) => (
  <Collapsible className={className} style={sx(S.tool, style)} {...props} />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  /** The call's input. A short one reads as the header subtitle — `toolSummary`. */
  input?: ToolPart["input"];
  className?: string;
  style?: Sx;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Awaiting Approval",
  "approval-responded": "Responded",
  "input-available": "Running",
  "input-streaming": "Pending",
  "output-available": "Completed",
  "output-denied": "Denied",
  "output-error": "Error",
};

/**
 * The running-state icon, pulsing. A component of its own because
 * `useAnimation()` is a hook — the plain-VNode `statusIcons` map below never
 * mounts as a component, so it cannot call one itself.
 *
 * `Badge` clones a size onto any icon child it renders (see ui/badge.tsx),
 * so this takes `style` and forwards it to the sized wrapper, the same way
 * `ui/spinner.tsx` forwards a ref-bearing span in place of a plain icon.
 */
const PulsingClockIcon = ({ style }: { style?: Sx }) => {
  const ref = useAnimation<HTMLSpanElement>(pulseKeyframes, pulseOptions);

  return (
    <span ref={ref} style={sx(S.pulseIconWrap, style)}>
      <ClockIcon style={S.pulseIconGlyph} />
    </span>
  );
};
(PulsingClockIcon as unknown as { isIcon: true }).isIcon = true;

const statusIcons: Record<ToolPart["state"], ComponentChildren> = {
  "approval-requested": <ClockIcon style={u.warning} />,
  "approval-responded": <CheckCircleIcon style={u.info} />,
  "input-available": <PulsingClockIcon />,
  "input-streaming": <CircleIcon />,
  "output-available": <CheckCircleIcon style={u.success} />,
  "output-denied": <XCircleIcon style={u.notice} />,
  "output-error": <XCircleIcon style={u.danger} />,
};

export const getStatusBadge = (status: ToolPart["state"]) => (
  <Badge variant="secondary">
    {statusIcons[status]}
    {statusLabels[status]}
  </Badge>
);

/** Longest subtitle drawn on the header line; anything past it is an ellipsis. */
const SUMMARY_MAX = 72;

const summaryValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return undefined;
};

/** `cut` is true when the header shows less than the whole input. */
const summarize = (input: ToolPart["input"]): { text: string; cut: boolean } | undefined => {
  let text: string | undefined;

  if (input && typeof input === "object") {
    if (Array.isArray(input)) return undefined;
    const entries = Object.entries(input as Record<string, unknown>);
    if (entries.length !== 1) return undefined;
    const [key, value] = entries[0];
    const shown = summaryValue(value);
    text = shown === undefined ? undefined : `${key}: ${shown}`;
  } else {
    text = summaryValue(input);
  }

  // One line, whatever the input holds — a newline would grow the header row.
  const line = text?.replace(/\s+/g, " ").trim();
  if (!line) return undefined;

  return line.length > SUMMARY_MAX
    ? { text: `${line.slice(0, SUMMARY_MAX - 1)}…`, cut: true }
    : { text: line, cut: text !== line };
};

/**
 * The one-line form of a call's input, for the header: a bare value as it
 * stands, a single-key object as `key: value`. Two keys never read on one line,
 * so a wider input stays in the Parameters box alone and the header shows the
 * name by itself.
 */
export const toolSummary = (input: ToolPart["input"]): string | undefined => summarize(input)?.text;

export const ToolHeader = ({
  className,
  style,
  title,
  input,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName = type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");
  const { open } = useCollapsible("ToolHeader");
  const summary = toolSummary(input);

  return (
    <CollapsibleTrigger className={className} style={sx(S.toolHeader, style)} {...props}>
      <div style={S.toolTitle}>
        <WrenchIcon style={sx(u.icon, u.muted)} />
        <span style={S.toolName}>{title ?? derivedName}</span>
        {/* The native `title` carries what the ellipsis cuts — there is no tooltip. */}
        {summary ? (
          <span style={S.toolSummary} title={summary}>
            {summary}
          </span>
        ) : null}
      </div>
      <div style={S.toolMeta}>
        {getStatusBadge(state)}
        <Chevron open={open} style={u.muted} />
      </div>
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const ToolContent = ({ className, style, ...props }: ToolContentProps) => {
  const { open } = useCollapsible("ToolContent");

  return (
    <CollapsibleContent
      className={className}
      style={sx(S.toolContent, !open && S.hidden, style)}
      {...props}
    />
  );
};

export type ToolInputProps = WithSx<ComponentProps<"div">> & {
  /**
   * Renders nothing when `ToolHeader` would carry this whole input as its
   * subtitle, so pass the same value to both — a header without it leaves a
   * short input nowhere on the card.
   */
  input: ToolPart["input"];
};

export const ToolInput = ({ className, style, input, ...props }: ToolInputProps) => {
  // A call with no arguments has nothing to show, and `JSON.stringify` returns
  // undefined for one — an empty box, or a code block with no code.
  const empty =
    input === undefined ||
    input === null ||
    (typeof input === "object" && Object.keys(input).length === 0);

  // The header subtitle already reads the whole input — `toolSummary` cut
  // nothing — so the box below would repeat it in a bigger type.
  const summary = summarize(input);

  if (empty || (summary && !summary.cut)) {
    return null;
  }

  return (
    <div className={className} style={sx(toolBodySx, S.toolSection, style)} {...props}>
      <span style={S.toolLabel}>Parameters</span>
      {typeof input === "string" ? (
        <div style={S.toolText}>{input}</div>
      ) : (
        <CodeBlock code={JSON.stringify(input, null, 2)} language="json" style={toolCodeSx} />
      )}
    </div>
  );
};

export type ToolOutputProps = WithSx<ComponentProps<"div">> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({ className, style, output, errorText, ...props }: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div style={S.toolText}>{output as ComponentChildren}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <CodeBlock code={JSON.stringify(output, null, 2)} language="json" style={toolCodeSx} />
    );
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" style={toolCodeSx} />;
  }

  return (
    <div
      className={className}
      style={sx(toolBodySx, S.toolSection, Boolean(errorText) && toolBodyErrorSx, style)}
      {...props}
    >
      <span style={sx(S.toolLabel, Boolean(errorText) && S.toolLabelError)}>
        {errorText ? "Error" : "Result"}
      </span>
      {errorText && <div style={S.toolText}>{errorText}</div>}
      {output ? Output : null}
    </div>
  );
};
