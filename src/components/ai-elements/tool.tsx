import type { ComponentChildren, ComponentProps } from "preact";
import { isValidElement } from "preact";

import type { DynamicToolUIPart, ToolUIPart } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "@/components/ui/collapsible";
import {
  CheckCircleIcon,
  Chevron,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "@/lib/icons";
import { useAnimation } from "@/lib/use-animation";
import { pulseKeyframes, pulseOptions, reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

import { CodeBlock } from "./code-block";

/**
 * The input/output box. Exported so other files that render the same surface
 * on a plain `<div>` — `agent.tsx`, `test-results.tsx` — can reuse it instead
 * of duplicating the declarations (same pattern as `controlSx` in `ui/input.tsx`).
 */
export const toolBodySx = {
  overflowX: "auto",
  borderRadius: "var(--wa-radius-md)",
  background: "var(--wa-muted-surface)",
  color: "var(--wa-foreground)",
  fontSize: "0.75rem",
} satisfies Sx;

export const toolBodyErrorSx = {
  background: "var(--wa-destructive-surface)",
  color: "var(--wa-destructive)",
} satisfies Sx;

const S = {
  tool: {
    width: "100%",
    marginBottom: "1rem",
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-md)",
  },
  toolHeader: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem",
  },
  toolTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  toolName: {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  toolContent: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1rem",
    color: "var(--wa-foreground)",
    outline: "none",
  },
  // The panel is a `CollapsibleContent`, which hides itself with the `hidden`
  // attribute. An inline `display` would outrank the UA `[hidden]` rule, so
  // closing has to be driven from here too, in the same expression.
  hidden: { display: "none" },
  toolSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    overflow: "hidden",
  },
  toolLabel: {
    color: "var(--wa-muted-foreground)",
    fontSize: "0.75rem",
    fontWeight: "500",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
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

export const ToolHeader = ({
  className,
  style,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName = type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");
  const { open } = useCollapsible("ToolHeader");

  return (
    <CollapsibleTrigger className={className} style={sx(S.toolHeader, style)} {...props}>
      <div style={S.toolTitle}>
        <WrenchIcon style={sx(u.icon, u.muted)} />
        <span style={S.toolName}>{title ?? derivedName}</span>
        {getStatusBadge(state)}
      </div>
      <Chevron open={open} style={u.muted} />
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
  input: ToolPart["input"];
};

export const ToolInput = ({ className, style, input, ...props }: ToolInputProps) => (
  <div className={className} style={sx(S.toolSection, style)} {...props}>
    <h4 style={sx(reset.text, S.toolLabel)}>Parameters</h4>
    <div style={toolBodySx}>
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = WithSx<ComponentProps<"div">> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({ className, style, output, errorText, ...props }: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output = <div>{output as ComponentChildren}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = <CodeBlock code={JSON.stringify(output, null, 2)} language="json" />;
  } else if (typeof output === "string") {
    Output = <CodeBlock code={output} language="json" />;
  }

  return (
    <div className={className} style={sx(S.toolSection, style)} {...props}>
      <h4 style={sx(reset.text, S.toolLabel)}>{errorText ? "Error" : "Result"}</h4>
      <div style={sx(toolBodySx, Boolean(errorText) && toolBodyErrorSx)}>
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
