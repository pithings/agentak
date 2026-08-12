import type { ComponentProps } from "preact";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "@/components/ui/collapsible";
import { Chevron, SearchIcon } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  taskTrigger: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--wa-muted-foreground)",
    fontSize: "0.875rem",
    transition: "color var(--wa-transition)",
  },
  taskTriggerHover: {
    color: "var(--wa-foreground)",
  },
  taskContent: {
    outline: "none",
  },
  taskBody: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    marginTop: "1rem",
    borderLeft: "2px solid var(--wa-muted)",
    paddingLeft: "1rem",
  },
  taskItem: {
    color: "var(--wa-muted-foreground)",
    fontSize: "0.875rem",
  },
  taskFile: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-md)",
    background: "var(--wa-secondary)",
    padding: "0.125rem 0.375rem",
    color: "var(--wa-foreground)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

export type TaskItemFileProps = WithSx<ComponentProps<"div">>;

export const TaskItemFile = ({ children, className, style, ...props }: TaskItemFileProps) => (
  <div className={className} style={sx(S.taskFile, style)} {...props}>
    {children}
  </div>
);

export type TaskItemProps = WithSx<ComponentProps<"div">>;

export const TaskItem = ({ children, className, style, ...props }: TaskItemProps) => (
  <div className={className} style={sx(S.taskItem, style)} {...props}>
    {children}
  </div>
);

export type TaskProps = ComponentProps<typeof Collapsible>;

export const Task = ({ defaultOpen = true, ...props }: TaskProps) => (
  <Collapsible defaultOpen={defaultOpen} {...props} />
);

export type TaskTriggerProps = WithSx<ComponentProps<typeof CollapsibleTrigger>> & {
  title: string;
};

// The trigger is the button itself — upstream reached the same shape with `asChild`.
export const TaskTrigger = ({ children, className, style, title, ...props }: TaskTriggerProps) => {
  const { open } = useCollapsible("TaskTrigger");
  const { hovered, handlers } = useInteraction<HTMLButtonElement>(props);

  return (
    <CollapsibleTrigger
      className={className}
      style={sx(S.taskTrigger, hovered && S.taskTriggerHover, style)}
      {...props}
      {...handlers}
    >
      {children ?? (
        <>
          <SearchIcon style={u.icon} />
          <p style={reset.text}>{title}</p>
          <Chevron open={open} />
        </>
      )}
    </CollapsibleTrigger>
  );
};

export type TaskContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const TaskContent = ({ children, className, style, ...props }: TaskContentProps) => (
  <CollapsibleContent className={className} style={sx(S.taskContent, style)} {...props}>
    <div style={S.taskBody}>{children}</div>
  </CollapsibleContent>
);
