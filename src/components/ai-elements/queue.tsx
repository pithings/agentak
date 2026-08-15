import type { ComponentChildren, ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

import { Button, type ButtonProps } from "../ui/button.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "../ui/collapsible.tsx";
import { ScrollArea, type ScrollAreaProps } from "../ui/scroll-area.tsx";
import { Chevron, PaperclipIcon } from "../../lib/icons.tsx";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

const S = {
  queue: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
    padding: "0.5rem 0.75rem",
    boxShadow: "var(--shadow-xs)",
  },
  // A row — indicator, text, actions. The description and the attachments carry
  // `width: 100%` and an `order`, so they wrap onto their own line below whatever
  // their place in the source is.
  queueItem: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.25rem 0.5rem",
    borderRadius: "var(--radius-md)",
    padding: "0.25rem 0.75rem",
    fontSize: "0.875rem",
    transition: "background-color var(--transition)",
  },
  queueItemHover: { background: "var(--muted)" },
  queueIndicator: {
    boxSizing: "border-box",
    display: "inline-block",
    flexShrink: "0",
    width: "0.625rem",
    height: "0.625rem",
    border: "1px solid color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
    borderRadius: "9999px",
  },
  queueIndicatorDone: {
    borderColor: "color-mix(in oklab, var(--muted-foreground) 20%, transparent)",
    background: "color-mix(in oklab, var(--muted-foreground) 10%, transparent)",
  },
  queueText: {
    flexGrow: "1",
    minWidth: "0",
    overflow: "hidden",
    overflowWrap: "break-word",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  queueDescription: {
    order: "1",
    width: "100%",
    marginLeft: "1.125rem",
    fontSize: "0.75rem",
  },
  // The "done" state repaints the color on both, so the plain-state color has
  // to be conditional too — otherwise the inline value would always win.
  mutedText: { color: "var(--muted-foreground)" },
  doneText: {
    color: "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
    textDecoration: "line-through",
  },
  queueActions: {
    display: "flex",
    flexShrink: "0",
    alignItems: "center",
    gap: "0.25rem",
  },
  // Overrides the icon button's own size, radius, colour and transition. It
  // reaches Button as `style`, so it still lands after the ghost variant.
  queueAction: {
    boxSizing: "border-box",
    width: "auto",
    height: "auto",
    borderRadius: "var(--radius-sm)",
    padding: "0.25rem",
    color: "var(--muted-foreground)",
    opacity: "0",
    transition: "opacity var(--transition)",
  },
  queueActionShown: { opacity: "1" },
  queueAttachment: {
    order: "2",
    display: "flex",
    flexWrap: "wrap",
    width: "100%",
    gap: "0.5rem",
    marginLeft: "1.125rem",
  },
  queueImage: {
    boxSizing: "border-box",
    width: "2rem",
    height: "2rem",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    objectFit: "cover",
  },
  queueFile: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--muted)",
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
  },
  queueFileName: {
    maxWidth: "100px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  queueList: {
    marginTop: "0.5rem",
    maxHeight: "10rem",
  },
  queueListInner: {
    paddingRight: "1rem",
  },
  queueTrigger: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: "var(--radius-md)",
    background: "var(--muted-surface)",
    padding: "0.5rem 0.75rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    fontWeight: "500",
    textAlign: "left",
    transition: "background-color var(--transition)",
  },
  queueTriggerHover: { background: "var(--muted)" },
  queueLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
} satisfies Record<string, Sx>;

/**
 * True while the pointer is over the item.
 *
 * The action's opacity was `.queue-item:hover .btn.queue-action`, a
 * state of one element painting another. No prop on the action can see that,
 * so the item owns the state and publishes it here.
 */
const QueueItemHoverContext = createContext(false);

/** `UIMessage["parts"]` as the queue reads it — the preview fields only. */
export interface QueueMessagePart {
  type: string;
  text?: string;
  url?: string;
  filename?: string;
  mediaType?: string;
}

export interface QueueMessage {
  id: string;
  parts: QueueMessagePart[];
}

export interface QueueTodo {
  id: string;
  title: string;
  description?: string;
  status?: "pending" | "completed";
}

export type QueueProps = WithSx<ComponentProps<"div">>;

export const Queue = ({ className, style, ...props }: QueueProps) => (
  <div className={className} style={sx(S.queue, style)} {...props} />
);

export type QueueItemProps = WithSx<ComponentProps<"li">>;

export const QueueItem = ({ className, style, children, ...props }: QueueItemProps) => {
  const { handlers, hovered } = useInteraction<HTMLLIElement>(props);

  return (
    <QueueItemHoverContext.Provider value={hovered}>
      <li
        className={className}
        style={sx(S.queueItem, hovered && S.queueItemHover, style)}
        {...props}
        {...handlers}
      >
        {children}
      </li>
    </QueueItemHoverContext.Provider>
  );
};

export type QueueItemIndicatorProps = WithSx<ComponentProps<"span">> & { completed?: boolean };

export const QueueItemIndicator = ({
  completed = false,
  className,
  style,
  ...props
}: QueueItemIndicatorProps) => (
  <span
    className={className}
    style={sx(S.queueIndicator, completed && S.queueIndicatorDone, style)}
    {...props}
  />
);

export type QueueItemContentProps = WithSx<ComponentProps<"span">> & { completed?: boolean };

export const QueueItemContent = ({
  completed = false,
  className,
  style,
  ...props
}: QueueItemContentProps) => (
  <span
    className={className}
    style={sx(S.queueText, completed ? S.doneText : S.mutedText, style)}
    {...props}
  />
);

export type QueueItemDescriptionProps = WithSx<ComponentProps<"div">> & { completed?: boolean };

export const QueueItemDescription = ({
  completed = false,
  className,
  style,
  ...props
}: QueueItemDescriptionProps) => (
  <div
    className={className}
    style={sx(S.queueDescription, completed ? S.doneText : S.mutedText, style)}
    {...props}
  />
);

export type QueueItemActionsProps = WithSx<ComponentProps<"div">>;

export const QueueItemActions = ({ className, style, ...props }: QueueItemActionsProps) => (
  <div className={className} style={sx(S.queueActions, style)} {...props} />
);

export type QueueItemActionProps = Omit<ButtonProps, "variant" | "size">;

/** Shown while the pointer is over the item, or while it holds the focus ring. */
export const QueueItemAction = ({ className, style, ...props }: QueueItemActionProps) => {
  const itemHovered = useContext(QueueItemHoverContext);
  const { focusVisible, handlers } = useInteraction<HTMLButtonElement>(props);

  return (
    <Button
      className={className}
      size="icon"
      style={sx(S.queueAction, (itemHovered || focusVisible) && S.queueActionShown, style)}
      type="button"
      variant="ghost"
      {...props}
      {...handlers}
    />
  );
};

export type QueueItemAttachmentProps = WithSx<ComponentProps<"div">>;

export const QueueItemAttachment = ({ className, style, ...props }: QueueItemAttachmentProps) => (
  <div className={className} style={sx(S.queueAttachment, style)} {...props} />
);

export type QueueItemImageProps = WithSx<ComponentProps<"img">>;

export const QueueItemImage = ({ className, style, ...props }: QueueItemImageProps) => (
  <img
    alt=""
    className={className}
    height={32}
    style={sx(S.queueImage, style)}
    width={32}
    {...props}
  />
);

export type QueueItemFileProps = WithSx<ComponentProps<"span">>;

export const QueueItemFile = ({ children, className, style, ...props }: QueueItemFileProps) => (
  <span className={className} style={sx(S.queueFile, style)} {...props}>
    <PaperclipIcon size={12} />
    <span style={S.queueFileName}>{children}</span>
  </span>
);

export type QueueListProps = Omit<ScrollAreaProps, "orientation">;

export const QueueList = ({ children, className, style, ...props }: QueueListProps) => (
  <ScrollArea className={className} style={sx(S.queueList, style)} {...props}>
    <div style={S.queueListInner}>
      <ul style={reset.list}>{children}</ul>
    </div>
  </ScrollArea>
);

export type QueueSectionProps = ComponentProps<typeof Collapsible>;

export const QueueSection = ({ defaultOpen = true, ...props }: QueueSectionProps) => (
  <Collapsible defaultOpen={defaultOpen} {...props} />
);

export type QueueSectionTriggerProps = WithSx<ComponentProps<typeof CollapsibleTrigger>>;

export const QueueSectionTrigger = ({ className, style, ...props }: QueueSectionTriggerProps) => {
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <CollapsibleTrigger
      className={className}
      style={sx(S.queueTrigger, hovered && S.queueTriggerHover, style)}
      {...props}
      {...handlers}
    />
  );
};

export type QueueSectionLabelProps = WithSx<ComponentProps<"span">> & {
  count?: number;
  label: string;
  icon?: ComponentChildren;
};

export const QueueSectionLabel = ({
  count,
  label,
  icon,
  className,
  style,
  ...props
}: QueueSectionLabelProps) => {
  const { open } = useCollapsible("QueueSectionLabel");

  return (
    <span className={className} style={sx(S.queueLabel, style)} {...props}>
      <Chevron open={open} turn={90} />
      {icon}
      <span>
        {count} {label}
      </span>
    </span>
  );
};

export type QueueSectionContentProps = ComponentProps<typeof CollapsibleContent>;

export const QueueSectionContent = (props: QueueSectionContentProps) => (
  <CollapsibleContent {...props} />
);
