import type { ComponentProps } from "preact";
import { memo } from "preact/compat";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion.tsx";
import { Badge } from "../ui/badge.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "../ui/collapsible.tsx";
import { BotIcon, Chevron } from "../../lib/icons.tsx";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";
import type { ToolDefinition } from "../../types.ts";

import { CodeBlock } from "./code-block.tsx";
import { toolBodySx, toolCodeSx } from "./tool.tsx";

const S = {
  agent: {
    boxSizing: "border-box",
    width: "100%",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  agentHeader: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem",
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
    gap: "1rem",
    padding: "0 1rem 1rem",
  },
  // The body is a `CollapsibleContent`, which hides itself with the `hidden`
  // attribute. The inline `display` above would outrank the UA `[hidden]` rule,
  // so closing has to be driven from here too, in the same expression.
  agentContentHidden: { display: "none" },
  agentSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  agentLabel: {
    display: "block",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  agentInstructions: {
    borderRadius: "var(--radius-md)",
    background: "var(--muted-surface)",
    padding: "0.75rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
  agentTools: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  // Overrides AccordionTrigger's own padding, so this has to be a `style` prop
  // on AccordionTrigger — it is inline there too, and inline cannot lose to a
  // class.
  agentToolTrigger: {
    padding: "0.5rem 0.75rem",
  },
  // Same reasoning, for the accordion body's padding.
  agentToolBody: {
    padding: "0 0.75rem 0.75rem",
  },
} satisfies Record<string, Sx>;

export type AgentProps = WithSx<ComponentProps<typeof Collapsible>>;

// The card is the `Collapsible` itself, so the header is its trigger and the
// body its content. It starts closed: the instructions and the tool schemas are
// reference, not the first thing to read.
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

export type AgentInstructionsProps = WithSx<ComponentProps<"div">> & {
  children: string;
};

export const AgentInstructions = memo(
  ({ className, children, style, ...props }: AgentInstructionsProps) => (
    <div className={className} style={sx(S.agentSection, style)} {...props}>
      <span style={S.agentLabel}>Instructions</span>
      <div style={S.agentInstructions}>
        <p style={reset.text}>{children}</p>
      </div>
    </div>
  ),
);

export type AgentToolsProps = ComponentProps<typeof Accordion>;

export const AgentTools = memo(({ className, ...props }: AgentToolsProps) => (
  <div style={S.agentSection}>
    <span style={S.agentLabel}>Tools</span>
    <Accordion className={className} style={S.agentTools} {...props} />
  </div>
));

export type AgentToolProps = ComponentProps<typeof AccordionItem> & {
  tool: ToolDefinition;
};

export const AgentTool = memo(({ className, tool, value, ...props }: AgentToolProps) => {
  const schema = tool.jsonSchema ?? tool.inputSchema;

  return (
    <AccordionItem className={className} value={value} {...props}>
      <AccordionTrigger style={S.agentToolTrigger}>
        {tool.description ?? "No description"}
      </AccordionTrigger>
      <AccordionContent style={S.agentToolBody}>
        <div style={toolBodySx}>
          <CodeBlock code={JSON.stringify(schema, null, 2)} language="json" style={toolCodeSx} />
        </div>
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
