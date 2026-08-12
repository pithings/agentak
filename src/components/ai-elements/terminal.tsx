import type { ComponentProps } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { Button, type ButtonProps } from "@/components/ui/button";
import { type AnsiStyle, ansiCss, parseAnsi } from "@/lib/ansi";
import { CheckIcon, CopyIcon, TerminalIcon, TrashIcon } from "@/lib/icons";
import { useAnimation } from "@/lib/use-animation";
import { useInteraction } from "@/lib/use-interaction";
import { pulseKeyframes, pulseOptions, reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  terminal: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-lg)",
    background: "var(--wa-terminal-bg)",
    color: "var(--wa-terminal-fg)",
  },
  terminalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    borderBottom: "1px solid var(--wa-border)",
    padding: "0.375rem 0.5rem 0.375rem 0.75rem",
  },
  terminalTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--wa-terminal-muted)",
    fontSize: "0.875rem",
  },
  terminalStatus: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--wa-terminal-muted)",
    fontSize: "0.75rem",
  },
  terminalActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  // Reaches Button as `style`, so the terminal palette still lands after the
  // ghost variant — on hover as well as at rest.
  terminalAction: { color: "var(--wa-terminal-muted)" },
  terminalActionHover: {
    background: "color-mix(in oklab, var(--wa-terminal-fg) 12%, transparent)",
    color: "var(--wa-terminal-fg)",
  },
  terminalContent: {
    boxSizing: "border-box",
    maxHeight: "24rem",
    overflow: "auto",
    padding: "0.75rem 1rem",
    fontFamily: "var(--wa-font-mono)",
    fontSize: "0.8125rem",
    lineHeight: "1.6",
  },
  terminalPre: {
    margin: "0",
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
  },
  // Block cursor while output is still arriving.
  terminalCursor: {
    display: "inline-block",
    width: "0.5rem",
    height: "1em",
    marginLeft: "0.125rem",
    background: "var(--wa-terminal-fg)",
    verticalAlign: "text-bottom",
  },
} satisfies Record<string, Sx>;

interface TerminalContextType {
  output: string;
  isStreaming: boolean;
  autoScroll: boolean;
  onClear?: () => void;
}

const TerminalContext = createContext<TerminalContextType>({
  autoScroll: true,
  isStreaming: false,
  output: "",
});

export type TerminalHeaderProps = WithSx<ComponentProps<"div">>;

export const TerminalHeader = ({ className, style, children, ...props }: TerminalHeaderProps) => (
  <div className={className} style={sx(S.terminalHeader, style)} {...props}>
    {children}
  </div>
);

export type TerminalTitleProps = WithSx<ComponentProps<"div">>;

export const TerminalTitle = ({ className, style, children, ...props }: TerminalTitleProps) => (
  <div className={className} style={sx(S.terminalTitle, style)} {...props}>
    <TerminalIcon style={u.icon} />
    {children ?? "Terminal"}
  </div>
);

export type TerminalStatusProps = WithSx<ComponentProps<"div">>;

/** Nothing at all once the command has finished. */
export const TerminalStatus = ({ className, style, children, ...props }: TerminalStatusProps) => {
  const { isStreaming } = useContext(TerminalContext);

  if (!isStreaming) return null;

  return (
    <div className={className} style={sx(S.terminalStatus, style)} {...props}>
      {children ?? "Running"}
    </div>
  );
};

export type TerminalActionsProps = WithSx<ComponentProps<"div">>;

export const TerminalActions = ({ className, style, children, ...props }: TerminalActionsProps) => (
  <div className={className} style={sx(S.terminalActions, style)} {...props}>
    {children}
  </div>
);

export type TerminalCopyButtonProps = ButtonProps & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const TerminalCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  style,
  ...props
}: TerminalCopyButtonProps) => {
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { output } = useContext(TerminalContext);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      setIsCopied(true);
      onCopy?.();
      timeoutRef.current = window.setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  }, [output, onCopy, onError, timeout]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      aria-label="Copy"
      className={className}
      onClick={copyToClipboard}
      size="icon-sm"
      style={sx(S.terminalAction, hovered && S.terminalActionHover, style)}
      title="Copy"
      variant="ghost"
      {...props}
      {...handlers}
    >
      {children ?? <Icon />}
    </Button>
  );
};

export type TerminalClearButtonProps = ButtonProps;

/** Renders only when the terminal was given an `onClear`. */
export const TerminalClearButton = ({
  children,
  className,
  style,
  ...props
}: TerminalClearButtonProps) => {
  const { onClear } = useContext(TerminalContext);
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  if (!onClear) return null;

  return (
    <Button
      aria-label="Clear"
      className={className}
      onClick={onClear}
      size="icon-sm"
      style={sx(S.terminalAction, hovered && S.terminalActionHover, style)}
      title="Clear"
      variant="ghost"
      {...props}
      {...handlers}
    >
      {children ?? <TrashIcon />}
    </Button>
  );
};

/**
 * Terminal output, styled from its ANSI escapes.
 *
 * Spans, never `dangerouslySetInnerHTML` — this text comes from a command the
 * model ran, so it is untrusted.
 */
const AnsiText = ({ text }: { text: string }) => {
  const spans = useMemo(() => parseAnsi(text), [text]);

  return (
    <>
      {spans.map(({ key, style, text: run }) => (
        <AnsiSpan key={key} style={style} text={run} />
      ))}
    </>
  );
};

const AnsiSpan = ({ style, text }: { style: AnsiStyle; text: string }) =>
  Object.keys(style).length === 0 ? <>{text}</> : <span style={ansiCss(style)}>{text}</span>;

export type TerminalContentProps = WithSx<ComponentProps<"div">>;

export const TerminalContent = ({ className, style, children, ...props }: TerminalContentProps) => {
  const { output, isStreaming, autoScroll } = useContext(TerminalContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useAnimation<HTMLSpanElement>(pulseKeyframes, pulseOptions);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  return (
    <div className={className} ref={containerRef} style={sx(S.terminalContent, style)} {...props}>
      {children ?? (
        // Tag selector, not a class — nothing in the sheet needs one.
        <pre style={sx(reset.pre, S.terminalPre)}>
          <AnsiText text={output} />
          {isStreaming && (
            <span data-slot="terminal-cursor" ref={cursorRef} style={S.terminalCursor} />
          )}
        </pre>
      )}
    </div>
  );
};

export type TerminalProps = WithSx<ComponentProps<"div">> & {
  output: string;
  isStreaming?: boolean;
  autoScroll?: boolean;
  onClear?: () => void;
};

/** Command output, with a header and a copy button by default. */
export const Terminal = ({
  output,
  isStreaming = false,
  autoScroll = true,
  onClear,
  className,
  style,
  children,
  ...props
}: TerminalProps) => {
  const contextValue = useMemo(
    () => ({ autoScroll, isStreaming, onClear, output }),
    [autoScroll, isStreaming, onClear, output],
  );

  return (
    <TerminalContext.Provider value={contextValue}>
      <div className={className} style={sx(S.terminal, style)} {...props}>
        {children ?? (
          <>
            <TerminalHeader>
              <TerminalTitle />
              <TerminalActions>
                <TerminalStatus />
                <TerminalCopyButton />
                <TerminalClearButton />
              </TerminalActions>
            </TerminalHeader>
            <TerminalContent />
          </>
        )}
      </div>
    </TerminalContext.Provider>
  );
};
