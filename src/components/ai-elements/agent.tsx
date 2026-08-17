import type { ComponentProps } from "preact";
import { toChildArray } from "preact";
import { memo } from "preact/compat";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion.tsx";
import { Badge } from "../ui/badge.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "../ui/collapsible.tsx";
import { BotIcon, Chevron, WrenchIcon } from "../../lib/icons.tsx";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";
import type { ToolDefinition } from "../../types.ts";

import { CodeBlock } from "./code-block.tsx";
import { toolBodySx, toolCodeSx, toolTitle } from "./tool.tsx";

const S = {
  agent: {
    boxSizing: "border-box",
    width: "100%",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  // No bottom padding: the content below supplies the gap, so the card reads the
  // same whether or not a caller renders this row.
  agentHeader: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem 0.75rem 0",
    color: "var(--muted-foreground)",
    textAlign: "left",
    transition: "color var(--transition)",
  },
  agentHeaderHover: {
    color: "var(--foreground)",
  },
  agentTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  // The header dims as a whole on the way to its hover state; the name is the
  // title, so it stays at full contrast throughout.
  agentName: {
    color: "var(--foreground)",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  agentContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    padding: "0.75rem",
  },
  // The body is a `CollapsibleContent`, which hides itself with the `hidden`
  // attribute. The inline `display` above would outrank the UA `[hidden]` rule,
  // so closing has to be driven from here too, in the same expression.
  agentContentHidden: { display: "none" },
  agentSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  // A caption, not a heading: it names the block under it and stays out of the
  // way of the words a person came to read.
  agentLabel: {
    display: "block",
    color: "var(--muted-foreground)",
    fontSize: "0.6875rem",
    fontWeight: "500",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  // The prompt keeps the line breaks it was written with — a prompt is a set of
  // lines, and reflowed into one paragraph it reads as prose it is not.
  agentInstructions: {
    whiteSpace: "pre-wrap",
  },
  // Overrides AccordionTrigger's own padding and weight, so this has to be a
  // `style` prop on AccordionTrigger — it is inline there too, and inline cannot
  // lose to a class.
  agentRow: {
    paddingBlock: "0.5rem",
    fontSize: "0.8125rem",
  },
  // The icon leads, so a closed row is read by its shape before its words. It
  // is muted: the word is the label, and the icon only points at it.
  agentRowTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  agentRowIcon: {
    width: "0.875rem",
    height: "0.875rem",
    color: "var(--muted-foreground)",
  },
  agentCount: {
    color: "var(--muted-foreground)",
    fontWeight: "400",
  },
  // The rows sit under the row that opened them, and the indent is what says
  // so: the icon's width and the gap after it, so a tool name starts where the
  // word "Tools" above it starts.
  agentToolsBody: {
    paddingBottom: "0",
    paddingLeft: "1.375rem",
  },
  // Same reasoning as the trigger, for the accordion body.
  agentBody: {
    paddingBottom: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.8125rem",
    lineHeight: "1.5",
  },
  agentToolSchema: {
    marginTop: "0.5rem",
  },
} satisfies Record<string, Sx>;

export type AgentProps = WithSx<ComponentProps<typeof Collapsible>>;

// The card is the `Collapsible` itself, so the header is its trigger and the
// body its content. It starts closed, for a card that names an agent among
// others; a caller that renders no header opens it instead — see
// `chat/empty.tsx`.
export const Agent = memo(({ className, style, ...props }: AgentProps) => (
  <Collapsible className={className} style={sx(S.agent, style)} {...props} />
));

export type AgentHeaderProps = WithSx<ComponentProps<typeof CollapsibleTrigger>> & {
  name: string;
  model?: string;
};

// The whole row is the button — upstream reached the same shape with `asChild`.
export const AgentHeader = memo(({ className, name, model, style, ...props }: AgentHeaderProps) => {
  const { open } = useCollapsible("AgentHeader");
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <CollapsibleTrigger
      className={className}
      style={sx(S.agentHeader, hovered && S.agentHeaderHover, style)}
      {...props}
      {...handlers}
    >
      <div style={S.agentTitle}>
        <BotIcon style={u.icon} />
        <span style={S.agentName}>{name}</span>
        {model && (
          <Badge style={u.mono} variant="secondary">
            {model}
          </Badge>
        )}
      </div>
      <Chevron open={open} />
    </CollapsibleTrigger>
  );
});

export type AgentContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const AgentContent = memo(({ className, style, ...props }: AgentContentProps) => {
  const { open } = useCollapsible("AgentContent");

  return (
    <CollapsibleContent
      className={className}
      style={sx(S.agentContent, !open && S.agentContentHidden, style)}
      {...props}
    />
  );
});

export type AgentInstructionsProps = WithSx<Omit<ComponentProps<typeof Accordion>, "children">> & {
  children: string;
};

// A row of its own rather than a section, so the prompt is closed like a tool is
// and the card is a list of things to open, all of one kind. It carries its own
// `Accordion`, because a caller places it where there is none.
export const AgentInstructions = memo(
  ({ className, children, style, ...props }: AgentInstructionsProps) => (
    <Accordion className={className} style={style} {...props}>
      <AccordionItem value="instructions">
        <AccordionTrigger style={S.agentRow}>
          <span style={S.agentRowTitle}>
            <BotIcon style={S.agentRowIcon} />
            Agent Instructions
          </span>
        </AccordionTrigger>
        <AccordionContent style={S.agentBody}>
          <p style={sx(reset.text, S.agentInstructions)}>{children}</p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
);

export type AgentToolsProps = ComponentProps<typeof Accordion>;

// The tools are a row too, and the rows they hold are what it opens. The count
// is on the closed row, because how many there are is the part worth reading
// without opening anything.
export const AgentTools = memo(({ className, children, ...props }: AgentToolsProps) => (
  <Accordion>
    <AccordionItem value="tools">
      <AccordionTrigger style={S.agentRow}>
        {/* The space is written in, so the row is read out as two words. */}
        <span style={S.agentRowTitle}>
          <WrenchIcon style={S.agentRowIcon} />
          Tools <span style={S.agentCount}>{toChildArray(children).length}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent style={S.agentToolsBody}>
        <Accordion className={className} {...props}>
          {children}
        </Accordion>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
));

export type AgentToolProps = ComponentProps<typeof AccordionItem> & {
  tool: ToolDefinition & { name?: string };
  /** Print the input schema under the description. Off by default: a person
   * reading an idle chat wants what a tool does, not the shape of its arguments. */
  schema?: boolean;
};

// The name is the row, because the name is what the model calls. It is read as
// `toolTitle()` reads it, so a tool is called the same thing here as in the
// header of the call it makes; the name as written rides along for a pointer.
// What the tool does is a line down, where a person who does not recognise the
// name goes looking.
export const AgentTool = memo(({ className, schema, tool, value, ...props }: AgentToolProps) => {
  const input = tool.jsonSchema ?? tool.inputSchema;
  const name = tool.name ?? value;
  const heading = toolTitle(name);

  return (
    <AccordionItem className={className} value={value} {...props}>
      <AccordionTrigger style={S.agentRow} title={heading === name ? undefined : name}>
        {heading}
      </AccordionTrigger>
      <AccordionContent style={S.agentBody}>
        <p style={reset.text}>{tool.description ?? "No description"}</p>
        {schema && input !== undefined && (
          <div style={sx(toolBodySx, S.agentToolSchema)}>
            <CodeBlock code={JSON.stringify(input, null, 2)} language="json" style={toolCodeSx} />
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
});

export type AgentOutputProps = WithSx<ComponentProps<"div">> & {
  schema: string;
};

export const AgentOutput = memo(({ className, schema, style, ...props }: AgentOutputProps) => (
  <div className={className} style={sx(S.agentSection, style)} {...props}>
    <span style={S.agentLabel}>Output Schema</span>
    <div style={toolBodySx}>
      <CodeBlock code={schema} language="ts" style={toolCodeSx} />
    </div>
  </div>
));
