import type { ComponentProps } from "preact";
import { createContext } from "preact";
import { memo } from "preact/compat";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { Button } from "../../ui/button.tsx";
import { Collapsible, CollapsibleContent } from "../../ui/collapsible.tsx";
import { AlertTriangleIcon, CheckIcon, Chevron, CopyIcon } from "../../../lib/icons.tsx";
import { useControllableState } from "../../../lib/use-controllable-state.ts";
import { useInteraction } from "../../../lib/use-interaction.ts";
import { reset, u } from "../../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../../styles/sx.ts";

const S = {
  stack: {
    boxSizing: "border-box",
    width: "100%",
    overflow: "hidden",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
    fontSize: "0.875rem",
  },
  stackHeader: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem",
    textAlign: "left",
    cursor: "pointer",
    transition: "background-color var(--transition)",
  },
  stackHeaderHover: {
    background: "var(--muted-surface)",
  },
  stackHeaderFocus: {
    outline: "none",
    boxShadow: "var(--focus-ring)",
  },
  stackError: {
    display: "flex",
    flex: "1",
    alignItems: "center",
    gap: "0.5rem",
    overflow: "hidden",
  },
  stackErrorType: {
    flexShrink: "0",
    color: "var(--destructive)",
    fontWeight: "600",
  },
  stackErrorMessage: {
    overflow: "hidden",
    color: "var(--foreground)",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  stackActions: {
    display: "flex",
    flexShrink: "0",
    alignItems: "center",
    gap: "0.25rem",
  },
  stackExpand: {
    display: "flex",
    width: "1.75rem",
    height: "1.75rem",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
  },
  stackContent: {
    boxSizing: "border-box",
    overflow: "auto",
    borderTop: "1px solid var(--border)",
    background: "var(--muted-surface)",
  },
  stackFrames: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    padding: "0.75rem",
  },
  stackFrame: {
    color: "var(--foreground)",
    fontSize: "0.75rem",
  },
  // An internal frame is still readable, but it steps back.
  stackFrameInternal: {
    color: "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  stackFn: {
    color: "var(--foreground)",
  },
  stackPath: {
    textDecoration: "underline",
    textDecorationStyle: "dotted",
  },
  stackPathEnabled: {
    cursor: "pointer",
  },
  stackPathHover: {
    color: "var(--primary)",
  },
  stackEmpty: {
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

const STACK_FRAME_WITH_PARENS_REGEX = /^at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/;
const STACK_FRAME_WITHOUT_FN_REGEX = /^at\s+(.+):(\d+):(\d+)$/;
const ERROR_TYPE_REGEX = /^(\w+Error|Error):\s*(.*)$/;
const AT_PREFIX_REGEX = /^at\s+/;

interface StackFrame {
  raw: string;
  functionName: string | null;
  filePath: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  isInternal: boolean;
}

interface ParsedStackTrace {
  errorType: string | null;
  errorMessage: string;
  frames: StackFrame[];
  raw: string;
}

interface StackTraceContextValue {
  trace: ParsedStackTrace;
  raw: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onFilePathClick?: (filePath: string, line?: number, column?: number) => void;
}

const StackTraceContext = createContext<StackTraceContextValue | null>(null);

const useStackTrace = () => {
  const context = useContext(StackTraceContext);
  if (!context) {
    throw new Error("StackTrace components must be used within StackTrace");
  }
  return context;
};

const isInternalPath = (filePath: string) =>
  filePath.includes("node_modules") ||
  filePath.startsWith("node:") ||
  filePath.includes("internal/");

const parseStackFrame = (line: string): StackFrame => {
  const trimmed = line.trim();

  // at functionName (filePath:line:column)
  const withParens = trimmed.match(STACK_FRAME_WITH_PARENS_REGEX);
  if (withParens) {
    const [, functionName, filePath, lineNum, colNum] = withParens;
    return {
      columnNumber: colNum ? Number.parseInt(colNum, 10) : null,
      filePath: filePath ?? null,
      functionName: functionName ?? null,
      isInternal: isInternalPath(filePath ?? ""),
      lineNumber: lineNum ? Number.parseInt(lineNum, 10) : null,
      raw: trimmed,
    };
  }

  // at filePath:line:column
  const withoutFn = trimmed.match(STACK_FRAME_WITHOUT_FN_REGEX);
  if (withoutFn) {
    const [, filePath, lineNum, colNum] = withoutFn;
    return {
      columnNumber: colNum ? Number.parseInt(colNum, 10) : null,
      filePath: filePath ?? null,
      functionName: null,
      isInternal: isInternalPath(filePath ?? ""),
      lineNumber: lineNum ? Number.parseInt(lineNum, 10) : null,
      raw: trimmed,
    };
  }

  // Unparseable line.
  return {
    columnNumber: null,
    filePath: null,
    functionName: null,
    isInternal: trimmed.includes("node_modules") || trimmed.includes("node:"),
    lineNumber: null,
    raw: trimmed,
  };
};

const parseStackTrace = (trace: string): ParsedStackTrace => {
  const lines = trace.split("\n").filter((line) => line.trim());

  if (lines.length === 0) {
    return { errorMessage: trace, errorType: null, frames: [], raw: trace };
  }

  const firstLine = lines[0]?.trim() ?? "";
  let errorType: string | null = null;
  let errorMessage = firstLine;

  const errorMatch = firstLine.match(ERROR_TYPE_REGEX);
  if (errorMatch) {
    const [, type, message] = errorMatch;
    errorType = type ?? null;
    errorMessage = message ?? "";
  }

  const frames = lines
    .slice(1)
    .filter((line) => line.trim().startsWith("at "))
    .map(parseStackFrame);

  return { errorMessage, errorType, frames, raw: trace };
};

export type StackTraceProps = WithSx<Omit<ComponentProps<"div">, "onToggle">> & {
  trace: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onFilePathClick?: (filePath: string, line?: number, column?: number) => void;
};

/**
 * The root is the collapsible itself, so the header and the frames share one
 * open state. Upstream nested a second collapsible in each half, which needed
 * radix `asChild` to keep the header from being a button around a button.
 */
export const StackTrace = memo(
  ({
    trace,
    className,
    style,
    open,
    defaultOpen = false,
    onOpenChange,
    onFilePathClick,
    children,
    ...props
  }: StackTraceProps) => {
    const [isOpen, setIsOpen] = useControllableState<boolean>({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    });

    const parsedTrace = useMemo(() => parseStackTrace(trace), [trace]);

    const contextValue = useMemo(
      () => ({
        isOpen,
        onFilePathClick,
        raw: trace,
        setIsOpen,
        trace: parsedTrace,
      }),
      [parsedTrace, trace, isOpen, setIsOpen, onFilePathClick],
    );

    return (
      <StackTraceContext.Provider value={contextValue}>
        <Collapsible
          className={className}
          onOpenChange={setIsOpen}
          open={isOpen}
          style={sx(S.stack, u.mono, style)}
          {...props}
        >
          {children ?? (
            <>
              <StackTraceHeader>
                <StackTraceError>
                  {parsedTrace.errorType && <StackTraceErrorType />}
                  <StackTraceErrorMessage />
                </StackTraceError>
                <StackTraceActions>
                  <StackTraceCopyButton />
                </StackTraceActions>
                <StackTraceExpandButton />
              </StackTraceHeader>
              <StackTraceContent>
                <StackTraceFrames />
              </StackTraceContent>
            </>
          )}
        </Collapsible>
      </StackTraceContext.Provider>
    );
  },
);

export type StackTraceHeaderProps = WithSx<ComponentProps<"div">>;

/** A div, not a button — the actions inside it are buttons of their own. */
export const StackTraceHeader = memo(
  ({ className, style, children, onClick, onKeyDown, ...props }: StackTraceHeaderProps) => {
    const { isOpen, setIsOpen } = useStackTrace();
    const { hovered, focusVisible, handlers } = useInteraction<HTMLDivElement>(props);

    return (
      <div
        aria-expanded={isOpen}
        className={className}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setIsOpen(!isOpen);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        role="button"
        style={sx(
          S.stackHeader,
          hovered && S.stackHeaderHover,
          focusVisible && S.stackHeaderFocus,
          style,
        )}
        tabIndex={0}
        {...props}
        {...handlers}
      >
        {children}
      </div>
    );
  },
);

export type StackTraceErrorProps = WithSx<ComponentProps<"div">>;

export const StackTraceError = memo(
  ({ className, style, children, ...props }: StackTraceErrorProps) => (
    <div className={className} style={sx(S.stackError, style)} {...props}>
      <AlertTriangleIcon style={sx(u.icon, u.danger)} />
      {children}
    </div>
  ),
);

export type StackTraceErrorTypeProps = WithSx<ComponentProps<"span">>;

export const StackTraceErrorType = memo(
  ({ className, style, children, ...props }: StackTraceErrorTypeProps) => {
    const { trace } = useStackTrace();

    return (
      <span className={className} style={sx(S.stackErrorType, style)} {...props}>
        {children ?? trace.errorType}
      </span>
    );
  },
);

export type StackTraceErrorMessageProps = WithSx<ComponentProps<"span">>;

export const StackTraceErrorMessage = memo(
  ({ className, style, children, ...props }: StackTraceErrorMessageProps) => {
    const { trace } = useStackTrace();

    return (
      <span className={className} style={sx(S.stackErrorMessage, style)} {...props}>
        {children ?? trace.errorMessage}
      </span>
    );
  },
);

export type StackTraceActionsProps = WithSx<ComponentProps<"div">>;

const stopMouse = (event: MouseEvent) => event.stopPropagation();
const stopKeys = (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === " ") {
    event.stopPropagation();
  }
};

/** Stops a click on an action from toggling the header. */
export const StackTraceActions = memo(
  ({ className, style, children, ...props }: StackTraceActionsProps) => (
    <div
      className={className}
      onClick={stopMouse}
      onKeyDown={stopKeys}
      role="group"
      style={sx(S.stackActions, style)}
      {...props}
    >
      {children}
    </div>
  ),
);

export type StackTraceCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const StackTraceCopyButton = memo(
  ({ onCopy, onError, timeout = 2000, children, ...props }: StackTraceCopyButtonProps) => {
    const [isCopied, setIsCopied] = useState(false);
    const timeoutRef = useRef<number>(0);
    const { raw } = useStackTrace();

    const copyToClipboard = useCallback(async () => {
      if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
        onError?.(new Error("Clipboard API not available"));
        return;
      }

      try {
        await navigator.clipboard.writeText(raw);
        setIsCopied(true);
        onCopy?.();
        timeoutRef.current = window.setTimeout(() => setIsCopied(false), timeout);
      } catch (error) {
        onError?.(error as Error);
      }
    }, [raw, onCopy, onError, timeout]);

    useEffect(
      () => () => {
        window.clearTimeout(timeoutRef.current);
      },
      [],
    );

    const Icon = isCopied ? CheckIcon : CopyIcon;

    return (
      <Button
        onClick={copyToClipboard}
        size="icon-sm"
        title="Copy stack trace"
        variant="ghost"
        {...props}
      >
        {children ?? <Icon />}
      </Button>
    );
  },
);

export type StackTraceExpandButtonProps = WithSx<ComponentProps<"div">>;

export const StackTraceExpandButton = memo(
  ({ className, style, ...props }: StackTraceExpandButtonProps) => {
    const { isOpen } = useStackTrace();

    return (
      <div className={className} style={sx(S.stackExpand, style)} {...props}>
        <Chevron open={isOpen} style={u.muted} />
      </div>
    );
  },
);

export type StackTraceContentProps = WithSx<ComponentProps<typeof CollapsibleContent>> & {
  maxHeight?: number;
};

export const StackTraceContent = memo(
  ({ className, maxHeight = 400, style, children, ...props }: StackTraceContentProps) => (
    <CollapsibleContent
      className={className}
      style={sx(S.stackContent, { maxHeight: `${maxHeight}px` }, style)}
      {...props}
    >
      {children}
    </CollapsibleContent>
  ),
);

interface FilePathButtonProps {
  frame: StackFrame;
  onFilePathClick?: (filePath: string, lineNumber?: number, columnNumber?: number) => void;
}

const FilePathButton = memo(({ frame, onFilePathClick }: FilePathButtonProps) => {
  // `:enabled` used to gate the cursor and hover color in CSS; the component
  // already knows whether it is interactive, so the state moves here too.
  const enabled = Boolean(onFilePathClick);
  const { hovered, handlers } = useInteraction<HTMLButtonElement>();

  const handleClick = useCallback(() => {
    if (frame.filePath) {
      onFilePathClick?.(
        frame.filePath,
        frame.lineNumber ?? undefined,
        frame.columnNumber ?? undefined,
      );
    }
  }, [frame, onFilePathClick]);

  return (
    <button
      disabled={!enabled}
      onClick={handleClick}
      style={sx(
        reset.button,
        S.stackPath,
        enabled && S.stackPathEnabled,
        enabled && hovered && S.stackPathHover,
      )}
      type="button"
      {...handlers}
    >
      {frame.filePath}
      {frame.lineNumber !== null && `:${frame.lineNumber}`}
      {frame.columnNumber !== null && `:${frame.columnNumber}`}
    </button>
  );
});

export type StackTraceFramesProps = WithSx<ComponentProps<"div">> & {
  showInternalFrames?: boolean;
};

export const StackTraceFrames = memo(
  ({ className, style, showInternalFrames = true, ...props }: StackTraceFramesProps) => {
    const { trace, onFilePathClick } = useStackTrace();

    const framesToShow = showInternalFrames
      ? trace.frames
      : trace.frames.filter((frame) => !frame.isInternal);

    return (
      <div className={className} style={sx(S.stackFrames, style)} {...props}>
        {framesToShow.map((frame) => (
          <div key={frame.raw} style={sx(S.stackFrame, frame.isInternal && S.stackFrameInternal)}>
            <span style={u.muted}>at </span>
            {frame.functionName && (
              <span style={sx(!frame.isInternal && S.stackFn)}>{frame.functionName} </span>
            )}
            {frame.filePath && (
              <>
                <span style={u.muted}>(</span>
                <FilePathButton frame={frame} onFilePathClick={onFilePathClick} />
                <span style={u.muted}>)</span>
              </>
            )}
            {!(frame.filePath || frame.functionName) && (
              <span>{frame.raw.replace(AT_PREFIX_REGEX, "")}</span>
            )}
          </div>
        ))}
        {framesToShow.length === 0 && <div style={S.stackEmpty}>No stack frames</div>}
      </div>
    );
  },
);
