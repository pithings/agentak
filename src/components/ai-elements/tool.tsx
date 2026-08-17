import type { ComponentChildren, ComponentProps } from "preact";
import { isValidElement } from "preact";
import { useMemo } from "preact/hooks";
import { detectLanguage } from "rangi/core";

import type { DynamicToolUIPart, ToolUIPart } from "../../types.ts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  type CollapsibleTriggerProps,
  useCollapsible,
} from "../ui/collapsible.tsx";
import { CheckCircleIcon, Chevron, CircleIcon, ClockIcon, XCircleIcon } from "../../lib/icons.tsx";
import { useAnimation } from "../../lib/use-animation.ts";
import { pulseKeyframes, pulseOptions, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

import { CodeBlock, type CodeLanguage } from "./code-block.tsx";

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
  // The status, as the icon alone, and first on the line: it leads where a
  // wrench used to, which said "tool" on a card that is already one. The word
  // it used to carry stays on the element for a screen reader and as the
  // native tooltip, so nothing is lost and the row keeps its width for the
  // name and the input.
  status: {
    display: "inline-flex",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
  },
  // Alone on the right of the row now, and never squeezed by a long input.
  toolChevron: { flexShrink: "0" },
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
  // The badge floats over the box, so what the box holds has to start below it:
  // a code block scrolls sideways, and without this its first line runs under
  // the label. The badge is about 1.125rem tall and the block already pads
  // 0.75rem, so this is the rest of that plus the gap. It costs the section
  // that much height and no width, which the right-hand padding on plain text
  // below does the other way around.
  toolLabelClear: { paddingTop: "0.625rem" },
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

/** The name a part calls its tool: `toolName` on a dynamic one, `type` on the rest. */
export const toolPartName = (part: ToolPart): string =>
  part.type === "dynamic-tool" ? part.toolName : part.type;

export type ToolHeaderProps = Omit<CollapsibleTriggerProps, "title"> & {
  /** The tool, either as the model names it or as a part's `tool-<name>` type. */
  name: string;
  state: ToolPart["state"];
  /** Shown in place of the heading `toolTitle()` reads out of `name`. */
  title?: string;
  /** The call's input. A short one reads as the header subtitle — `toolSummary`. */
  input?: ToolPart["input"];
};

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
 * It takes `style` and forwards it to the sized wrapper, so it reads as an icon
 * wherever one is expected, the same way `ui/spinner.tsx` forwards a
 * ref-bearing span in place of a plain icon.
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
  "approval-requested": <ClockIcon style={sx(u.icon, u.warning)} />,
  "approval-responded": <CheckCircleIcon style={sx(u.icon, u.info)} />,
  "input-available": <PulsingClockIcon style={sx(u.icon, u.muted)} />,
  "input-streaming": <CircleIcon style={sx(u.icon, u.muted)} />,
  "output-available": <CheckCircleIcon style={sx(u.icon, u.success)} />,
  "output-denied": <XCircleIcon style={sx(u.icon, u.notice)} />,
  "output-error": <XCircleIcon style={sx(u.icon, u.danger)} />,
};

/**
 * The status, drawn as the icon alone: the colour and the shape say it, and a
 * word next to them says it a second time in a pill wide enough to crowd the
 * tool name. The word still rides along — `title` for a pointer, and text a
 * screen reader reads out of the header button's own name.
 */
export const getStatusIcon = (status: ToolPart["state"]) => (
  <span style={S.status} title={statusLabels[status]}>
    {statusIcons[status]}
    <span style={u.srOnly}>{statusLabels[status]}</span>
  </span>
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

/** A word the reader knows better than its lowercase form — `DOM`, `URL`, `CSS`. */
const ACRONYM = /^[A-Z\d]{2,}$/;

/**
 * The verbs a tool name may open with. A running call reads in the -ing form,
 * and only a verb on this list is bent — an unknown first word is left alone,
 * because a wrong word reads worse than a plain one.
 */
const VERBS = new Set(
  `add analyze apply browse build call cancel check clear click close copy count
   create delete download edit execute extract fetch fill find generate get insert
   inspect install list load make move navigate open parse press query read refresh
   reload remove render resolve run save scroll search select send set show start
   stop submit summarize take test translate type update upload validate view wait
   write`.split(/\s+/),
);

/** The -ing forms that "drop a final e, or add ing" gets wrong. */
const GERUNDS: Record<string, string> = {
  get: "getting",
  run: "running",
  set: "setting",
  stop: "stopping",
  submit: "submitting",
};

const gerund = (verb: string): string =>
  GERUNDS[verb] ?? (verb.endsWith("e") ? `${verb.slice(0, -1)}ing` : `${verb}ing`);

/**
 * The tool name as a heading: `get_current_page`, `getCurrentPage` and
 * `tool-get_current_page` all read as "Get current page". Only the first word
 * is capitalized, so the heading is a name and not a title bar, and an acronym
 * is left as the tool wrote it.
 *
 * Pass the call's `state` and a running call says what it is doing —
 * "Getting current page" — for as long as it runs.
 */
export const toolTitle = (name: string, state?: ToolPart["state"]): string => {
  const words = name
    .replace(/^tool-/, "")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/[\s_.:/-]+/)
    .filter(Boolean)
    .map((word) => (ACRONYM.test(word) ? word : word.toLowerCase()));

  if (words.length === 0) return name;
  if (state === "input-available" && VERBS.has(words[0])) words[0] = gerund(words[0]);
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);

  return words.join(" ");
};

export const ToolHeader = ({
  className,
  style,
  title,
  input,
  name,
  state,
  ...props
}: ToolHeaderProps) => {
  const { open } = useCollapsible("ToolHeader");
  const summary = toolSummary(input);
  const heading = title ?? toolTitle(name, state);

  return (
    <CollapsibleTrigger className={className} style={sx(S.toolHeader, style)} {...props}>
      <div style={S.toolTitle}>
        {getStatusIcon(state)}
        {/* The heading is a rewrite, so the name the model calls stays reachable. */}
        <span style={S.toolName} title={heading === name ? undefined : name}>
          {heading}
        </span>
        {/* The native `title` carries what the ellipsis cuts — there is no tooltip. */}
        {summary ? (
          <span style={S.toolSummary} title={summary}>
            {summary}
          </span>
        ) : null}
      </div>
      <Chevron open={open} style={sx(u.muted, S.toolChevron)} />
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
        <CodeBlock
          code={JSON.stringify(input, null, 2)}
          language="json"
          style={sx(toolCodeSx, S.toolLabelClear)}
        />
      )}
    </div>
  );
};

export type ToolOutputProps = WithSx<ComponentProps<"div">> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

/**
 * A string result that carries JSON, indented. A tool that answers with a
 * serialized object usually sends it on one line, which reads in the box as one
 * line the width of the whole object.
 *
 * The opening brace or bracket is the signature; anything else is prose, and a
 * string that opens with one but does not parse is prose too — a truncated
 * result, or a sentence about an object. Both are returned as they came, and
 * the caller then highlights nothing.
 */
const formatJson = (text: string): string | undefined => {
  const trimmed = text.trim();

  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return undefined;

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return undefined;
  }
};

/**
 * How much of a result the grammar is read off. A detector needs a sample and
 * not a whole document, and a result can be one — `read_page` hands over the
 * text of a page.
 */
const DETECT_SAMPLE = 4000;

/**
 * A string result, ready for the box: json indented and named as json, and
 * anything else as it came, under whichever grammar rangi scores highest for
 * it — sql, a diff, a stack trace, the yaml a tool wrote its report in.
 *
 * Prose is safe here. rangi scores the whole set and answers `plain` where
 * nothing clears its threshold, so a sentence holding a stray quote or brace
 * is a sentence and not badly coloured code.
 */
const asCode = (text: string): { code: string; language: CodeLanguage } => {
  const json = formatJson(text);

  return json === undefined
    ? { code: text, language: detectLanguage(text.slice(0, DETECT_SAMPLE)) }
    : { code: json, language: "json" };
};

export const ToolOutput = ({ className, style, output, errorText, ...props }: ToolOutputProps) => {
  const text = typeof output === "string" ? output : undefined;
  // A result is re-rendered on every chunk of the turn around it, and both
  // halves of this — the parse and the scoring — read the whole string.
  const code = useMemo(() => (text === undefined ? undefined : asCode(text)), [text]);

  if (!(output || errorText)) {
    return null;
  }

  // Only what comes first in the box sits under the badge. An error line takes
  // that place when there is one, and it clears the badge with its own padding.
  const codeSx = sx(toolCodeSx, !errorText && S.toolLabelClear);

  let Output = <div style={S.toolText}>{output as ComponentChildren}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = <CodeBlock code={JSON.stringify(output, null, 2)} language="json" style={codeSx} />;
  } else if (code) {
    Output = <CodeBlock code={code.code} language={code.language} style={codeSx} />;
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
