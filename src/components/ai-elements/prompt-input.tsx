import type { ComponentProps, JSX } from "preact";
import { useCallback, useState } from "preact/hooks";

import type { ChatStatus } from "@/types";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import type { ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CornerDownLeftIcon, SquareIcon, XIcon } from "@/lib/icons";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  prompt: {
    width: "100%",
  },
  // Never `overflow: hidden`: the footer holds the model picker, whose popover
  // is an absolutely positioned child and would be clipped by the composer.
  promptGroup: {
    overflow: "visible",
  },
  // Adds no box — the group lays the composer out.
  promptBody: {
    display: "contents",
  },
  promptTools: {
    display: "flex",
    minWidth: "0",
    alignItems: "center",
    gap: "0.25rem",
  },
  // The three overrides below were compound selectors. Every property they take
  // is inline on the primitive now, so each has to reach it as `style`.
  promptTextarea: {
    minHeight: "4rem",
    maxHeight: "12rem",
  },
  promptHeader: {
    order: "-1",
    flexWrap: "wrap",
    gap: "0.25rem",
  },
  promptFooter: {
    justifyContent: "space-between",
    gap: "0.25rem",
  },
} satisfies Record<string, Sx>;

export interface PromptInputMessage {
  text: string;
}

export type PromptInputProps = Omit<WithSx<ComponentProps<"form">>, "onSubmit"> & {
  onSubmit: (message: PromptInputMessage, event: JSX.TargetedSubmitEvent<HTMLFormElement>) => void;
};

/**
 * Uncontrolled composer form. The textarea is read by name on submit, so no
 * value has to be threaded through the parent.
 */
export const PromptInput = ({
  className,
  style,
  onSubmit,
  children,
  ...props
}: PromptInputProps) => {
  const handleSubmit = useCallback(
    (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
      event.preventDefault();

      const form = event.currentTarget;
      const text = (new FormData(form).get("message") as string) || "";
      // Reset before the handler runs so fast typing is never swallowed.
      form.reset();
      onSubmit({ text }, event);
    },
    [onSubmit],
  );

  return (
    <form className={className} onSubmit={handleSubmit} style={sx(S.prompt, style)} {...props}>
      <InputGroup style={S.promptGroup}>{children}</InputGroup>
    </form>
  );
};

export type PromptInputBodyProps = WithSx<ComponentProps<"div">>;

export const PromptInputBody = ({ className, style, ...props }: PromptInputBodyProps) => (
  <div className={className} style={sx(S.promptBody, style)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>;

export const PromptInputTextarea = ({
  onKeyDown,
  className,
  style,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) => {
  const [isComposing, setIsComposing] = useState(false);

  const handleKeyDown = useCallback(
    (event: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key !== "Enter" || event.shiftKey) return;
      // IME candidate selection also fires Enter.
      if (isComposing || event.isComposing) return;

      event.preventDefault();

      const { form } = event.currentTarget;
      const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submit?.disabled) return;

      form?.requestSubmit();
    },
    [onKeyDown, isComposing],
  );

  return (
    <InputGroupTextarea
      className={className}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      style={sx(S.promptTextarea, style)}
      {...props}
    />
  );
};

export type PromptInputHeaderProps = Omit<ComponentProps<typeof InputGroupAddon>, "align">;

export const PromptInputHeader = ({ className, style, ...props }: PromptInputHeaderProps) => (
  <InputGroupAddon
    align="block-end"
    className={className}
    style={sx(S.promptHeader, style)}
    {...props}
  />
);

export type PromptInputFooterProps = Omit<ComponentProps<typeof InputGroupAddon>, "align">;

export const PromptInputFooter = ({ className, style, ...props }: PromptInputFooterProps) => (
  <InputGroupAddon
    align="block-end"
    className={className}
    style={sx(S.promptFooter, style)}
    {...props}
  />
);

export type PromptInputToolsProps = WithSx<ComponentProps<"div">>;

export const PromptInputTools = ({ className, style, ...props }: PromptInputToolsProps) => (
  <div className={className} style={sx(S.promptTools, style)} {...props} />
);

export type PromptInputButtonProps = ButtonProps & {
  tooltip?: string;
};

export const PromptInputButton = ({
  variant = "ghost",
  size = "icon-sm",
  tooltip,
  ...props
}: PromptInputButtonProps) => (
  <InputGroupButton size={size} title={tooltip} type="button" variant={variant} {...props} />
);

export type PromptInputSubmitProps = ButtonProps & {
  status?: ChatStatus;
  onStop?: () => void;
};

export const PromptInputSubmit = ({
  variant = "default",
  size = "icon-sm",
  status,
  onStop,
  onClick,
  children,
  ...props
}: PromptInputSubmitProps) => {
  const isGenerating = status === "submitted" || status === "streaming";

  let icon = <CornerDownLeftIcon />;
  if (status === "submitted") {
    icon = <Spinner />;
  } else if (status === "streaming") {
    icon = <SquareIcon />;
  } else if (status === "error") {
    icon = <XIcon />;
  }

  const handleClick = (event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    if (isGenerating && onStop) {
      event.preventDefault();
      onStop();
      return;
    }
    onClick?.(event);
  };

  return (
    <InputGroupButton
      aria-label={isGenerating ? "Stop" : "Submit"}
      onClick={handleClick}
      size={size}
      type={isGenerating && onStop ? "button" : "submit"}
      variant={variant}
      {...props}
    >
      {children ?? icon}
    </InputGroupButton>
  );
};
