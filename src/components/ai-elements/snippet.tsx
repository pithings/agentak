import type { ComponentProps } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { CheckIcon, CopyIcon } from "@/lib/icons";
import { sx, type Sx } from "@/styles/sx";

const S = {
  snippet: {
    fontFamily: "var(--wa-font-mono)",
  },
  snippetText: {
    paddingLeft: "0.5rem",
    fontWeight: "400",
  },
  // Input sets its own color inline, so this override wins by landing after it
  // in the style attribute — `sx()` merges caller-last.
  snippetInput: {
    color: "var(--wa-foreground)",
  },
} satisfies Record<string, Sx>;

interface SnippetContextType {
  code: string;
}

const SnippetContext = createContext<SnippetContextType>({ code: "" });

export type SnippetProps = ComponentProps<typeof InputGroup> & {
  code: string;
};

/** A one-line command, read-only and copyable. */
export const Snippet = ({ code, className, style, children, ...props }: SnippetProps) => {
  const contextValue = useMemo(() => ({ code }), [code]);

  return (
    <SnippetContext.Provider value={contextValue}>
      <InputGroup className={className} style={sx(S.snippet, style)} {...props}>
        {children}
      </InputGroup>
    </SnippetContext.Provider>
  );
};

export type SnippetAddonProps = ComponentProps<typeof InputGroupAddon>;

export const SnippetAddon = (props: SnippetAddonProps) => <InputGroupAddon {...props} />;

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

export type SnippetCopyButtonProps = ComponentProps<typeof InputGroupButton> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const SnippetCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  ...props
}: SnippetCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { code } = useContext(SnippetContext);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      if (!isCopied) {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        onCopy?.();
        timeoutRef.current = window.setTimeout(() => setIsCopied(false), timeout);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [code, onCopy, onError, timeout, isCopied]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <InputGroupButton
      aria-label="Copy"
      onClick={copyToClipboard}
      size="icon-sm"
      title="Copy"
      {...props}
    >
      {children ?? <Icon />}
    </InputGroupButton>
  );
};
