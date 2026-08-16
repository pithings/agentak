import type { ComponentProps } from "preact";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "../../ui/collapsible.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger, useTabs } from "../ui/tabs.tsx";
import { Chevron, CodeIcon } from "../../../lib/icons.tsx";
import { u } from "../../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../../styles/sx.ts";
import type { ToolState } from "../../../types.ts";

import { getStatusIcon } from "../../ai-elements/tool.tsx";

// The list and tab overrides are `style` props, passed to TabsList/TabsTrigger,
// which merge them in caller-last.
const S = {
  sandbox: {
    boxSizing: "border-box",
    width: "100%",
    marginBottom: "1rem",
    overflow: "hidden",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  sandboxHeader: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem",
  },
  sandboxTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  sandboxName: {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  sandboxContent: {
    outline: "none",
  },
  sandboxTabs: {
    width: "100%",
    gap: "0",
  },
  sandboxBar: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    borderTop: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
  },
  sandboxPanel: {
    fontSize: "0.875rem",
  },
  sandboxTabsList: {
    boxSizing: "border-box",
    height: "auto",
    borderRadius: "0",
    background: "none",
    padding: "0",
  },
  sandboxTab: {
    borderRadius: "0",
    borderBottom: "2px solid transparent",
    padding: "0.5rem 1rem",
  },
  sandboxTabActive: {
    borderBottomColor: "var(--primary)",
    background: "none",
    boxShadow: "none",
    color: "var(--foreground)",
  },
} satisfies Record<string, Sx>;

export type SandboxProps = WithSx<ComponentProps<typeof Collapsible>>;

export const Sandbox = ({ className, style, defaultOpen = true, ...props }: SandboxProps) => (
  <Collapsible
    className={className}
    defaultOpen={defaultOpen}
    style={sx(S.sandbox, style)}
    {...props}
  />
);

export type SandboxHeaderProps = WithSx<ComponentProps<typeof CollapsibleTrigger>> & {
  title?: string;
  state: ToolState;
};

export const SandboxHeader = ({ className, style, title, state, ...props }: SandboxHeaderProps) => {
  const { open } = useCollapsible("SandboxHeader");

  return (
    <CollapsibleTrigger className={className} style={sx(S.sandboxHeader, style)} {...props}>
      <div style={S.sandboxTitle}>
        <CodeIcon style={sx(u.icon, u.muted)} />
        <span style={S.sandboxName}>{title}</span>
        {getStatusIcon(state)}
      </div>
      <Chevron open={open} style={u.muted} />
    </CollapsibleTrigger>
  );
};

export type SandboxContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const SandboxContent = ({ className, style, ...props }: SandboxContentProps) => (
  <CollapsibleContent className={className} style={sx(S.sandboxContent, style)} {...props} />
);

export type SandboxTabsProps = WithSx<ComponentProps<typeof Tabs>>;

export const SandboxTabs = ({ className, style, ...props }: SandboxTabsProps) => (
  <Tabs className={className} style={sx(S.sandboxTabs, style)} {...props} />
);

export type SandboxTabsBarProps = WithSx<ComponentProps<"div">>;

export const SandboxTabsBar = ({ className, style, ...props }: SandboxTabsBarProps) => (
  <div className={className} style={sx(S.sandboxBar, style)} {...props} />
);

export type SandboxTabsListProps = ComponentProps<typeof TabsList>;

export const SandboxTabsList = ({ style, ...props }: SandboxTabsListProps) => (
  <TabsList style={sx(S.sandboxTabsList, style)} {...props} />
);

export type SandboxTabsTriggerProps = ComponentProps<typeof TabsTrigger>;

export const SandboxTabsTrigger = ({ value, style, ...props }: SandboxTabsTriggerProps) => {
  const { value: current } = useTabs("SandboxTabsTrigger");
  const active = current === value;

  return (
    <TabsTrigger
      value={value}
      style={sx(S.sandboxTab, active && S.sandboxTabActive, style)}
      {...props}
    />
  );
};

export type SandboxTabContentProps = WithSx<ComponentProps<typeof TabsContent>>;

export const SandboxTabContent = ({ className, style, ...props }: SandboxTabContentProps) => (
  <TabsContent className={className} style={sx(S.sandboxPanel, style)} {...props} />
);
