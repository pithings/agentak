import type { ComponentProps, JSX } from "preact";
import { createContext } from "preact";
import { memo } from "preact/compat";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ShjToken } from "rangi/core";
import { tokenize } from "rangi/core";
import { languages as LANGUAGES } from "rangi/languages";

import { Button, type ButtonProps } from "../ui/button.tsx";
import { CheckIcon, CopyIcon } from "../../lib/icons.tsx";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

// Every grammar rangi ships, under its own name and its aliases, so a fence tag
// needs no table of ours. A name that is still not in here falls back to plain
// text, which rangi returns as a single untyped token. A grammar that embeds
// another — vue, astro, html, markdown — resolves it out of this same registry,
// so the whole set has to be here for a `<script>` block to colour.
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

  for (const { text, type } of tokenize(code, { lang: language, languages: LANGUAGES })) {
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
  // A surface in the flow, not a card on it: the tint alone sets the code off
  // from the text around it, at the width of that text.
  code: {
    boxSizing: "border-box",
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderRadius: "var(--radius-md)",
    background: "var(--muted-surface)",
    color: "var(--foreground)",
    contentVisibility: "auto",
    containIntrinsicSize: "auto 200px",
  },
  // The header floats on that surface — it labels the fence, it does not head
  // a panel, so it takes no rule and no bar of its own.
  codeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    padding: "0.5rem 0.75rem 0",
    color: "var(--muted-foreground)",
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
    padding: "0.75rem",
    color: "var(--shj-fg)",
    fontSize: "0.8125rem",
  },
  codeBody: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8125rem",
  },
  codeLine: {
    display: "block",
  },
  lineNumber: {
    display: "inline-block",
    width: "2rem",
    marginRight: "1rem",
    color: "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
    fontFamily: "var(--font-mono)",
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
