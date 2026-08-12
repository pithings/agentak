import type { ComponentProps } from "preact";
import { memo } from "preact/compat";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { BotIcon } from "@/lib/icons";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";
import type { ToolDefinition } from "@/types";

import { CodeBlock } from "./code-block";
import { toolBodySx } from "./tool";

const S = {
  agent: {
    boxSizing: "border-box",
    width: "100%",
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-md)",
  },
  agentHeader: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem",
  },
  agentTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  agentName: {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  agentContent: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "0 1rem 1rem",
  },
  agentSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  agentLabel: {
    display: "block",
    color: "var(--wa-muted-foreground)",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  agentInstructions: {
    borderRadius: "var(--wa-radius-md)",
    background: "var(--wa-muted-surface)",
    padding: "0.75rem",
    color: "var(--wa-muted-foreground)",
    fontSize: "0.875rem",
  },
  agentTools: {
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-md)",
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

export type AgentProps = WithSx<ComponentProps<"div">>;

export const Agent = memo(({ className, style, ...props }: AgentProps) => (
  <div className={className} style={sx(S.agent, style)} {...props} />
));

export type AgentHeaderProps = WithSx<ComponentProps<"div">> & {
  name: string;
  model?: string;
};

export const AgentHeader = memo(({ className, name, model, style, ...props }: AgentHeaderProps) => (
  <div className={className} style={sx(S.agentHeader, style)} {...props}>
    <div style={S.agentTitle}>
      <BotIcon style={sx(u.icon, u.muted)} />
      <span style={S.agentName}>{name}</span>
      {model && (
        <Badge style={u.mono} variant="secondary">
          {model}
        </Badge>
      )}
    </div>
  </div>
));

export type AgentContentProps = WithSx<ComponentProps<"div">>;

export const AgentContent = memo(({ className, style, ...props }: AgentContentProps) => (
  <div className={className} style={sx(S.agentContent, style)} {...props} />
));

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
          <CodeBlock code={JSON.stringify(schema, null, 2)} language="json" />
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
      <CodeBlock code={schema} language="ts" />
    </div>
  </div>
));
