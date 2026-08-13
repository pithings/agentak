import type { ComponentChildren, ComponentProps } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useMemo, useState } from "preact/hooks";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Chevron } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/** Same specificity as the base color; only the level actually shown matters. */
const LOG_COLOR = {
  log: { color: "var(--foreground)" },
  warn: { color: "var(--warning)" },
  error: { color: "var(--destructive)" },
} satisfies Record<WebPreviewLog["level"], Sx>;

const S = {
  webPreview: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
  },
  webPreviewNav: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    borderBottom: "1px solid var(--border)",
    padding: "0.5rem",
  },
  // Reaches Button as `style`, so it lands after the ghost variant's own
  // hover colour.
  webPreviewNavButtonHover: { color: "var(--foreground)" },
  webPreviewBody: {
    flex: "1",
  },
  webPreviewFrame: { boxSizing: "border-box", width: "100%", height: "100%", border: "0" },
  webPreviewConsole: {
    borderTop: "1px solid var(--border)",
    background: "var(--muted-surface)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
  },
  webPreviewConsoleTrigger: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem",
    fontWeight: "500",
    textAlign: "left",
  },
  webPreviewConsoleTriggerHover: {
    background: "var(--hover)",
  },
  webPreviewConsoleBody: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    maxHeight: "12rem",
    padding: "0 1rem 1rem",
    overflowY: "auto",
    outline: "none",
  },
  // The console body is a `CollapsibleContent`, which hides itself with the
  // `hidden` attribute. An inline `display` would outrank the UA `[hidden]`
  // rule, so closing has to be driven from here too, in the same expression.
  webPreviewConsoleBodyHidden: { display: "none" },
  webPreviewLog: {
    fontSize: "0.75rem",
  },
  // Was `.input.web-preview-url` — Input's own height is inline now
  // (see ui/input.tsx), so this has to reach it as `style` to still win.
  webPreviewUrl: { height: "2rem", flex: "1" },
} satisfies Record<string, Sx>;

interface WebPreviewContextValue {
  url: string;
  setUrl: (url: string) => void;
  consoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
}

const WebPreviewContext = createContext<WebPreviewContextValue | null>(null);

const useWebPreview = () => {
  const context = useContext(WebPreviewContext);
  if (!context) throw new Error("WebPreview components must be used within a WebPreview");
  return context;
};

export type WebPreviewProps = WithSx<ComponentProps<"div">> & {
  defaultUrl?: string;
  onUrlChange?: (url: string) => void;
};

export const WebPreview = ({
  className,
  style,
  children,
  defaultUrl = "",
  onUrlChange,
  ...props
}: WebPreviewProps) => {
  const [url, setUrl] = useState(defaultUrl);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const handleUrlChange = useCallback(
    (next: string) => {
      setUrl(next);
      onUrlChange?.(next);
    },
    [onUrlChange],
  );

  const contextValue = useMemo<WebPreviewContextValue>(
    () => ({ consoleOpen, setConsoleOpen, setUrl: handleUrlChange, url }),
    [consoleOpen, handleUrlChange, url],
  );

  return (
    <WebPreviewContext.Provider value={contextValue}>
      <div className={className} style={sx(S.webPreview, style)} {...props}>
        {children}
      </div>
    </WebPreviewContext.Provider>
  );
};

export type WebPreviewNavigationProps = WithSx<ComponentProps<"div">>;

export const WebPreviewNavigation = ({ className, style, ...props }: WebPreviewNavigationProps) => (
  <div className={className} style={sx(S.webPreviewNav, style)} {...props} />
);

export type WebPreviewNavigationButtonProps = ButtonProps & {
  tooltip?: string;
};

/** `tooltip` is the native `title` — this project carries no tooltip primitive. */
export const WebPreviewNavigationButton = ({
  className,
  style,
  tooltip,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: WebPreviewNavigationButtonProps) => {
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <Button
      className={className}
      size={size}
      style={sx(hovered && S.webPreviewNavButtonHover, style)}
      title={tooltip}
      type="button"
      variant={variant}
      {...props}
      {...handlers}
    />
  );
};

type InputHandler = NonNullable<ComponentProps<"input">["onInput"]>;
type KeyHandler = NonNullable<ComponentProps<"input">["onKeyDown"]>;

export type WebPreviewUrlProps = ComponentProps<typeof Input>;

export const WebPreviewUrl = ({
  className,
  style,
  value,
  onInput,
  onKeyDown,
  ...props
}: WebPreviewUrlProps) => {
  const { url, setUrl } = useWebPreview();
  const [prevUrl, setPrevUrl] = useState(url);
  const [inputValue, setInputValue] = useState(url);

  // Derived state: follow the context url when something else changes it.
  if (url !== prevUrl) {
    setPrevUrl(url);
    setInputValue(url);
  }

  const handleInput: InputHandler = (event) => {
    setInputValue(event.currentTarget.value);
  };

  const handleKeyDown: KeyHandler = (event) => {
    if (event.key === "Enter") setUrl(event.currentTarget.value);
    onKeyDown?.(event);
  };

  return (
    <Input
      className={className}
      onInput={onInput ?? handleInput}
      onKeyDown={handleKeyDown}
      placeholder="Enter URL..."
      style={sx(S.webPreviewUrl, style)}
      value={value ?? inputValue}
      {...props}
    />
  );
};

export type WebPreviewBodyProps = WithSx<ComponentProps<"iframe">> & {
  loading?: ComponentChildren;
};

/**
 * Presentational only. The sandbox attribute is passed through as upstream
 * writes it, and nothing bridges the frame to the host page.
 */
export const WebPreviewBody = ({
  className,
  style,
  loading,
  src,
  ...props
}: WebPreviewBodyProps) => {
  const { url } = useWebPreview();

  return (
    <div style={S.webPreviewBody}>
      <iframe
        className={className}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        src={(src ?? url) || undefined}
        style={sx(S.webPreviewFrame, style)}
        title="Preview"
        {...props}
      />
      {loading}
    </div>
  );
};

export interface WebPreviewLog {
  level: "log" | "warn" | "error";
  message: string;
  timestamp: Date;
}

export type WebPreviewConsoleProps = WithSx<ComponentProps<"div">> & {
  logs?: WebPreviewLog[];
};

export const WebPreviewConsole = ({
  className,
  style,
  logs = [],
  children,
  ...props
}: WebPreviewConsoleProps) => {
  const { consoleOpen, setConsoleOpen } = useWebPreview();
  const consoleHover = useInteraction<HTMLButtonElement>();

  return (
    <Collapsible
      className={className}
      onOpenChange={setConsoleOpen}
      open={consoleOpen}
      style={sx(S.webPreviewConsole, style)}
      {...props}
    >
      <CollapsibleTrigger
        style={sx(
          S.webPreviewConsoleTrigger,
          consoleHover.hovered && S.webPreviewConsoleTriggerHover,
        )}
        {...consoleHover.handlers}
      >
        Console
        <Chevron open={consoleOpen} />
      </CollapsibleTrigger>
      <CollapsibleContent
        style={sx(S.webPreviewConsoleBody, !consoleOpen && S.webPreviewConsoleBodyHidden)}
      >
        {logs.length === 0 ? (
          <p style={sx(reset.text, u.muted)}>No console output</p>
        ) : (
          logs.map((log) => (
            <div
              key={`${log.timestamp.getTime()}-${log.level}-${log.message}`}
              style={sx(S.webPreviewLog, LOG_COLOR[log.level])}
            >
              <span style={u.muted}>{log.timestamp.toLocaleTimeString()}</span> {log.message}
            </div>
          ))
        )}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};
