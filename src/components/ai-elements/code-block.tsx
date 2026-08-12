import type { ComponentProps, JSX } from "preact";
import { createContext } from "preact";
import { memo } from "preact/compat";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ShjToken } from "rangi/core";
import { tokenize } from "rangi/core";
import { bash, diff, json, ts, tsx } from "rangi/languages";

import { Button, type ButtonProps } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "@/lib/icons";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

// Only the grammars listed here are bundled. Everything else falls back to
// plain text, which rangi returns as a single untyped token.
const LANGUAGES = { bash, diff, json, ts, tsx };

// Fence tags a model is likely to write for a grammar that is bundled.
const ALIASES: Record<string, keyof typeof LANGUAGES> = {
  javascript: "ts",
  js: "ts",
  json5: "json",
  jsonc: "json",
  jsx: "tsx",
  patch: "diff",
  sh: "bash",
  shell: "bash",
  typescript: "ts",
  zsh: "bash",
};

export type CodeLanguage = keyof typeof LANGUAGES | (string & {});

// Token colors come from --shj-* in styles/base.ts, so the class-based `.dark`
// variant switches themes without a second pass over the tokens.
const tokenColor = (type: ShjToken | undefined) => (type ? `var(--shj-${type})` : undefined);

interface KeyedToken {
  text: string;
  type?: ShjToken;
  key: string;
}
interface KeyedLine {
  tokens: KeyedToken[];
  key: string;
}

// A token may span line breaks, so split on "\n" instead of tokenizing per line.
const tokenizeLines = (code: string, language: CodeLanguage): KeyedLine[] => {
  const lines: KeyedToken[][] = [[]];

  const lang = ALIASES[language] ?? language;

  for (const { text, type } of tokenize(code, { lang, languages: LANGUAGES })) {
    const parts = text.split("\n");
    for (const [index, part] of parts.entries()) {
      if (index > 0) {
        lines.push([]);
      }
      const line = lines.at(-1);
      if (part && line) {
        line.push({ key: `${lines.length - 1}-${line.length}`, text: part, type });
      }
    }
  }

  return lines.map((tokens, index) => ({ key: `line-${index}`, tokens }));
};

const S = {
  code: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-md)",
    background: "var(--wa-background)",
    color: "var(--wa-foreground)",
    contentVisibility: "auto",
    containIntrinsicSize: "auto 200px",
  },
  codeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    borderBottom: "1px solid var(--wa-border)",
    background: "color-mix(in oklab, var(--wa-muted) 80%, transparent)",
    padding: "0.5rem 0.75rem",
    color: "var(--wa-muted-foreground)",
    fontSize: "0.75rem",
  },
  codeTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  codeActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    margin: "-0.25rem -0.25rem -0.25rem 0",
  },
  codeScroll: {
    position: "relative",
    overflow: "auto",
  },
  codePre: {
    margin: "0",
    padding: "1rem",
    color: "var(--shj-fg)",
    fontSize: "0.875rem",
  },
  codeBody: {
    fontFamily: "var(--wa-font-mono)",
    fontSize: "0.875rem",
  },
  codeLine: {
    display: "block",
  },
  lineNumber: {
    display: "inline-block",
    width: "2rem",
    marginRight: "1rem",
    color: "color-mix(in oklab, var(--wa-muted-foreground) 50%, transparent)",
    fontFamily: "var(--wa-font-mono)",
    textAlign: "right",
    userSelect: "none",
  },
} satisfies Record<string, Sx>;

const TokenSpan = ({ text, type }: { text: string; type?: ShjToken }) => (
  <span
    style={
      {
        color: tokenColor(type),
        fontStyle: type === "cmnt" ? "italic" : undefined,
      } as JSX.CSSProperties
    }
  >
    {text}
  </span>
);

const LineSpan = ({
  keyedLine,
  index,
  showLineNumbers,
}: {
  keyedLine: KeyedLine;
  index: number;
  showLineNumbers: boolean;
}) => (
  <span style={S.codeLine}>
    {showLineNumbers && <span style={S.lineNumber}>{index + 1}</span>}
    {keyedLine.tokens.length === 0
      ? "\n"
      : keyedLine.tokens.map(({ key, text, type }) => (
          <TokenSpan key={key} text={text} type={type} />
        ))}
  </span>
);

type CodeBlockProps = WithSx<ComponentProps<"div">> & {
  code: string;
  language: CodeLanguage;
  showLineNumbers?: boolean;
};

interface CodeBlockContextType {
  code: string;
}

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

const CodeBlockBody = memo(
  ({
    lines,
    showLineNumbers,
    className,
  }: {
    lines: KeyedLine[];
    showLineNumbers: boolean;
    className?: string;
  }) => (
    <pre className={className} style={sx(reset.pre, S.codePre)}>
      <code style={sx(reset.code, S.codeBody)}>
        {lines.map((keyedLine, index) => (
          <LineSpan
            key={keyedLine.key}
            keyedLine={keyedLine}
            index={index}
            showLineNumbers={showLineNumbers}
          />
        ))}
      </code>
    </pre>
  ),
  (prevProps, nextProps) =>
    prevProps.lines === nextProps.lines &&
    prevProps.showLineNumbers === nextProps.showLineNumbers &&
    prevProps.className === nextProps.className,
);

export const CodeBlockContainer = ({
  className,
  language,
  style,
  ...props
}: WithSx<ComponentProps<"div">> & { language: string }) => (
  <div className={className} data-language={language} style={sx(S.code, style)} {...props} />
);

export const CodeBlockHeader = ({
  children,
  className,
  style,
  ...props
}: WithSx<ComponentProps<"div">>) => (
  <div className={className} style={sx(S.codeHeader, style)} {...props}>
    {children}
  </div>
);

export const CodeBlockTitle = ({
  children,
  className,
  style,
  ...props
}: WithSx<ComponentProps<"div">>) => (
  <div className={className} style={sx(S.codeTitle, style)} {...props}>
    {children}
  </div>
);

export const CodeBlockFilename = ({
  children,
  className,
  style,
  ...props
}: WithSx<ComponentProps<"span">>) => (
  <span className={className} style={sx(u.mono, style)} {...props}>
    {children}
  </span>
);

export const CodeBlockActions = ({
  children,
  className,
  style,
  ...props
}: WithSx<ComponentProps<"div">>) => (
  <div className={className} style={sx(S.codeActions, style)} {...props}>
    {children}
  </div>
);

export const CodeBlockContent = ({
  code,
  language,
  showLineNumbers = false,
}: {
  code: string;
  language: CodeLanguage;
  showLineNumbers?: boolean;
}) => {
  // rangi is synchronous — no loading state, no placeholder pass.
  const lines = useMemo(() => tokenizeLines(code, language), [code, language]);

  return (
    <div style={S.codeScroll}>
      <CodeBlockBody lines={lines} showLineNumbers={showLineNumbers} />
    </div>
  );
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  style,
  ...props
}: CodeBlockProps) => {
  const contextValue = useMemo(() => ({ code }), [code]);

  return (
    <CodeBlockContext.Provider value={contextValue}>
      <CodeBlockContainer className={className} language={language} style={style} {...props}>
        {children}
        <CodeBlockContent code={code} language={language} showLineNumbers={showLineNumbers} />
      </CodeBlockContainer>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ButtonProps & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { code } = useContext(CodeBlockContext);

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
    <Button onClick={copyToClipboard} size="icon-sm" variant="ghost" {...props}>
      {children ?? <Icon />}
    </Button>
  );
};
