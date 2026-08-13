import type { ComponentProps } from "preact";
import { createContext } from "preact";
import { memo } from "preact/compat";
import { useContext } from "preact/hooks";

import { Markdown } from "@/components/markdown";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { MessageRole } from "@/types";
import { u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const MessageContext = createContext<MessageRole>("user");

const S = {
  message: {
    display: "flex",
    width: "100%",
    maxWidth: "95%",
    flexDirection: "column",
    gap: "0.5rem",
  },
  messageUser: {
    marginLeft: "auto",
    justifyContent: "flex-end",
  },
  messageContent: {
    boxSizing: "border-box",
    display: "flex",
    width: "fit-content",
    minWidth: "0",
    maxWidth: "100%",
    flexDirection: "column",
    gap: "0.5rem",
    overflow: "hidden",
    color: "var(--foreground)",
    fontSize: "0.875rem",
  },
  // The user turn is the only one in a bubble.
  messageContentUser: {
    marginLeft: "auto",
    borderRadius: "var(--radius-lg)",
    background: "var(--secondary)",
    padding: "0.75rem 1rem",
  },
  messageResponse: {
    width: "100%",
  },
  messageActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  messageToolbar: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    marginTop: "1rem",
  },
} satisfies Record<string, Sx>;

export type MessageProps = WithSx<ComponentProps<"div">> & {
  from: MessageRole;
};

export const Message = ({ className, from, style, ...props }: MessageProps) => (
  <MessageContext.Provider value={from}>
    <div
      className={className}
      data-from={from}
      style={sx(S.message, from === "user" && S.messageUser, style)}
      {...props}
    />
  </MessageContext.Provider>
);

export type MessageContentProps = WithSx<ComponentProps<"div">>;

export const MessageContent = ({ children, className, style, ...props }: MessageContentProps) => {
  const isUser = useContext(MessageContext) === "user";

  return (
    <div
      className={className}
      style={sx(S.messageContent, isUser && S.messageContentUser, style)}
      {...props}
    >
      {children}
    </div>
  );
};

export type MessageActionsProps = WithSx<ComponentProps<"div">>;

export const MessageActions = ({ className, children, style, ...props }: MessageActionsProps) => (
  <div className={className} style={sx(S.messageActions, style)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ButtonProps & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => (
  <Button size={size} title={tooltip} type="button" variant={variant} {...props}>
    {children}
    <span style={u.srOnly}>{label || tooltip}</span>
  </Button>
);

export type MessageResponseProps = WithSx<ComponentProps<"div">> & {
  children: string;
  /** This text is still arriving — each new word fades in. */
  animate?: boolean;
};

/** Assistant text, rendered as markdown. */
export const MessageResponse = memo(
  ({ className, children, style, animate, ...props }: MessageResponseProps) => (
    <Markdown
      animate={animate}
      className={className}
      style={sx(S.messageResponse, style)}
      {...props}
    >
      {children}
    </Markdown>
  ),
  (prev, next) =>
    prev.children === next.children &&
    prev.className === next.className &&
    prev.animate === next.animate,
);

export type MessageToolbarProps = WithSx<ComponentProps<"div">>;

export const MessageToolbar = ({ className, children, style, ...props }: MessageToolbarProps) => (
  <div className={className} style={sx(S.messageToolbar, style)} {...props}>
    {children}
  </div>
);
