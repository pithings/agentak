import type { ComponentChildren, ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext, useEffect } from "preact/hooks";

import { Button, type ButtonProps } from "../ui/button.tsx";
import { ArrowDownIcon } from "../../lib/icons.tsx";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";
import { useStickToBottom } from "../../lib/use-stick-to-bottom.ts";

const S = {
  conversation: {
    position: "relative",
    flex: "1",
    minHeight: "0",
    overflow: "hidden",
  },
  conversationScroll: {
    height: "100%",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  conversationContent: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1rem",
  },
  empty: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    padding: "2rem",
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  emptyText: {
    marginTop: "0.25rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
  // Passed as `style`, so the background and radius land after the outline
  // variant's own — Button's colours are inline, which no class could override.
  scrollButton: {
    position: "absolute",
    bottom: "1rem",
    left: "50%",
    transform: "translateX(-50%)",
    borderRadius: "9999px",
    background: "var(--background)",
  },
  scrollButtonHover: { background: "var(--muted)" },
} satisfies Record<string, Sx>;

type StickContext = Pick<
  ReturnType<typeof useStickToBottom>,
  "contentRef" | "isAtBottom" | "scrollRef" | "scrollToBottom"
>;

const ConversationContext = createContext<StickContext | null>(null);

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) throw new Error("Conversation parts must be used within Conversation");
  return context;
};

export type ConversationProps = WithSx<ComponentProps<"div">> & {
  /** Marker that re-pins the region when it changes — the last message id, typically. */
  pin?: unknown;
};

/**
 * Scroll region that follows new messages until the reader scrolls away.
 * This element does not scroll itself — ConversationContent does — so that
 * ConversationScrollButton can anchor to it.
 */
export const Conversation = ({ style, children, pin, ...props }: ConversationProps) => {
  // No pin is nothing to follow — an empty region stays at the top, so what a
  // host puts above the fold is what the reader sees first.
  const stick = useStickToBottom(pin != null);
  const { scrollToBottom } = stick;

  // A new message brings the reader back down, wherever they had scrolled to.
  useEffect(() => {
    if (pin == null) return;
    scrollToBottom("auto");
  }, [pin, scrollToBottom]);

  return (
    <ConversationContext.Provider value={stick}>
      <div role="log" style={sx(S.conversation, style)} {...props}>
        {children}
      </div>
    </ConversationContext.Provider>
  );
};

export type ConversationContentProps = WithSx<ComponentProps<"div">>;

export const ConversationContent = ({ style, ...props }: ConversationContentProps) => {
  const { contentRef, scrollRef } = useConversation();

  return (
    <div ref={scrollRef} style={S.conversationScroll}>
      <div ref={contentRef} style={sx(S.conversationContent, style)} {...props} />
    </div>
  );
};

export type ConversationEmptyStateProps = WithSx<ComponentProps<"div">> & {
  title?: string;
  description?: string;
  icon?: ComponentChildren;
};

export const ConversationEmptyState = ({
  style,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div style={sx(S.empty, style)} {...props}>
    {children ?? (
      <>
        {icon && <div style={u.muted}>{icon}</div>}
        <div>
          <h3 style={sx(reset.text, S.emptyTitle)}>{title}</h3>
          {description && <p style={sx(reset.text, S.emptyText)}>{description}</p>}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ButtonProps;

export const ConversationScrollButton = ({
  className,
  style,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useConversation();
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  if (isAtBottom) return null;

  return (
    <Button
      className={className}
      onClick={() => scrollToBottom()}
      size="icon"
      style={sx(S.scrollButton, hovered && S.scrollButtonHover, style)}
      type="button"
      variant="outline"
      {...props}
      {...handlers}
    >
      <ArrowDownIcon />
    </Button>
  );
};
