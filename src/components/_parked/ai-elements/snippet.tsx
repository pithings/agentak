import type { ComponentProps } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "../../ui/input-group.tsx";
import { CheckIcon, CopyIcon } from "../../../lib/icons.tsx";
import { sx, type Sx } from "../../../styles/sx.ts";

const S = {
  snippet: {
    fontFamily: "var(--font-mono)",
    cursor: "pointer",
  },
  snippetAddon: {
    cursor: "pointer",
  },
  snippetText: {
    paddingLeft: "0.5rem",
    fontWeight: "400",
  },
  // Input sets its own color inline, so this override wins by landing after it
  // in the style attribute — `sx()` merges caller-last.
  snippetInput: {
    color: "var(--foreground)",
    cursor: "pointer",
  },
} satisfies Record<string, Sx>;

interface SnippetContextType {
  code: string;
  copied: boolean;
  copy: () => void;
}

const SnippetContext = createContext<SnippetContextType>({
  code: "",
  copied: false,
  copy: () => {},
});

interface CopyOptions {
  code: string;
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout: number;
}

/**
 * One copy state for the whole snippet: the surface and the button both call it,
 * and a click on the button reaches the surface too, so `busy` swallows the
 * second call before `copied` has repainted.
 */
function useCopy({ code, onCopy, onError, timeout }: CopyOptions): SnippetContextType {
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);
  const timeoutRef = useRef<number>(0);

  const copy = useCallback(async () => {
    if (busy.current) return;

    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    busy.current = true;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.();
      timeoutRef.current = window.setTimeout(() => {
        busy.current = false;
        setCopied(false);
      }, timeout);
    } catch (error) {
      busy.current = false;
      onError?.(error as Error);
    }
  }, [code, onCopy, onError, timeout]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  return useMemo(() => ({ code, copied, copy }), [code, copied, copy]);
}

export type SnippetProps = ComponentProps<typeof InputGroup> & {
  code: string;
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

/** A one-line command, read-only and copyable — a click anywhere on it copies. */
export const Snippet = ({
  code,
  onCopy,
  onError,
  timeout = 2000,
  className,
  style,
  children,
  ...props
}: SnippetProps) => {
  const context = useCopy({ code, onCopy, onError, timeout });

  const handleClick = useCallback(() => {
    // A drag that selects the text is not a click to copy.
    if (window.getSelection()?.isCollapsed === false) return;
    context.copy();
  }, [context]);

  return (
    <SnippetContext.Provider value={context}>
      <InputGroup
        className={className}
        onClick={handleClick}
        style={sx(S.snippet, style)}
        title="Copy"
        {...props}
      >
        {children}
      </InputGroup>
    </SnippetContext.Provider>
  );
};

export type SnippetAddonProps = ComponentProps<typeof InputGroupAddon>;

export const SnippetAddon = ({ style, ...props }: SnippetAddonProps) => (
  <InputGroupAddon style={sx(S.snippetAddon, style)} {...props} />
);

export type SnippetTextProps = ComponentProps<typeof InputGroupText>;

export const SnippetText = ({ className, style, ...props }: SnippetTextProps) => (
  <InputGroupText className={className} style={sx(S.snippetText, style)} {...props} />
);

export type SnippetInputProps = Omit<ComponentProps<typeof InputGroupInput>, "readOnly" | "value">;

export const SnippetInput = ({ className, style, ...props }: SnippetInputProps) => {
  const { code } = useContext(SnippetContext);

  return (
    <InputGroupInput
      className={className}
      readOnly
      style={sx(S.snippetInput, style)}
      value={code}
      {...props}
    />
  );
};

export type SnippetCopyButtonProps = ComponentProps<typeof InputGroupButton>;

/**
 * The named control for the same copy the surface does. `onCopy`, `onError` and
 * `timeout` are the `Snippet`'s, since one state serves both.
 */
export const SnippetCopyButton = ({ children, ...props }: SnippetCopyButtonProps) => {
  const { copied, copy } = useContext(SnippetContext);
  const Icon = copied ? CheckIcon : CopyIcon;

  return (
    <InputGroupButton aria-label="Copy" onClick={copy} size="icon-sm" title="Copy" {...props}>
      {children ?? <Icon />}
    </InputGroupButton>
  );
};
