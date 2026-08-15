import type { ComponentChild, ComponentChildren, ComponentProps, VNode } from "preact";
import { cloneElement, createContext, isValidElement, toChildArray } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { Badge } from "../ui/badge.tsx";
import { Button } from "../ui/button.tsx";
import { Switch } from "../ui/switch.tsx";
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "../../lib/icons.tsx";
import { useControllableState } from "../../lib/use-controllable-state.ts";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

/** A line between rows — a flex `gap` cannot draw one. */
const DIVIDER: Sx = { borderTop: "1px solid var(--border)" };

/** Narrows `isValidElement` so the clone below can type the `style` it adds. */
function hasStyle(child: ComponentChild): child is VNode<{ style?: Sx }> {
  return isValidElement(child);
}

function withDividers(children: ComponentChildren): ComponentChildren {
  return toChildArray(children).map((child, index) =>
    index > 0 && hasStyle(child)
      ? cloneElement(child, { style: sx(DIVIDER, child.props.style) })
      : child,
  );
}

const S = {
  env: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
  },
  envHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--border)",
    padding: "0.75rem 1rem",
  },
  envTitle: {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  envToggle: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  envRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem 1rem",
  },
  envGroup: {
    display: "flex",
    minWidth: "0",
    alignItems: "center",
    gap: "0.5rem",
  },
  envName: {
    fontSize: "0.875rem",
  },
  envValue: {
    overflow: "hidden",
    color: "var(--muted-foreground)",
    textOverflow: "ellipsis",
    fontSize: "0.875rem",
  },
  envValueMasked: {
    userSelect: "none",
  },
} satisfies Record<string, Sx>;

interface EnvironmentVariablesContextValue {
  showValues: boolean;
  setShowValues: (show: boolean) => void;
}

const EnvironmentVariablesContext = createContext<EnvironmentVariablesContextValue>({
  setShowValues: () => {},
  showValues: false,
});

export interface EnvironmentVariableData {
  name: string;
  value: string;
  required?: boolean;
}

export type EnvironmentVariablesProps = WithSx<ComponentProps<"div">> & {
  showValues?: boolean;
  defaultShowValues?: boolean;
  onShowValuesChange?: (show: boolean) => void;
  /** Rows for the default layout. Ignored when `children` are given. */
  variables?: EnvironmentVariableData[];
};

export const EnvironmentVariables = ({
  showValues: controlledShowValues,
  defaultShowValues = false,
  onShowValuesChange,
  variables = [],
  style,
  children,
  ...props
}: EnvironmentVariablesProps) => {
  const [showValues, setShowValues] = useControllableState({
    defaultProp: defaultShowValues,
    onChange: onShowValuesChange,
    prop: controlledShowValues,
  });

  const contextValue = useMemo(() => ({ setShowValues, showValues }), [setShowValues, showValues]);

  return (
    <EnvironmentVariablesContext.Provider value={contextValue}>
      <div data-slot="environment-variables" style={sx(S.env, style)} {...props}>
        {children ?? (
          <>
            <EnvironmentVariablesHeader>
              <EnvironmentVariablesTitle />
              <EnvironmentVariablesToggle />
            </EnvironmentVariablesHeader>
            <EnvironmentVariablesContent>
              {variables.map((variable) => (
                <EnvironmentVariable key={variable.name} {...variable} />
              ))}
            </EnvironmentVariablesContent>
          </>
        )}
      </div>
    </EnvironmentVariablesContext.Provider>
  );
};

export type EnvironmentVariablesHeaderProps = WithSx<ComponentProps<"div">>;

export const EnvironmentVariablesHeader = ({
  style,
  ...props
}: EnvironmentVariablesHeaderProps) => <div style={sx(S.envHeader, style)} {...props} />;

export type EnvironmentVariablesTitleProps = WithSx<ComponentProps<"h3">>;

export const EnvironmentVariablesTitle = ({
  style,
  children,
  ...props
}: EnvironmentVariablesTitleProps) => (
  <h3 style={sx(reset.text, S.envTitle, style)} {...props}>
    {children ?? "Environment Variables"}
  </h3>
);

export type EnvironmentVariablesToggleProps = ComponentProps<typeof Switch>;

export const EnvironmentVariablesToggle = ({
  className,
  ...props
}: EnvironmentVariablesToggleProps) => {
  const { showValues, setShowValues } = useContext(EnvironmentVariablesContext);
  const Icon = showValues ? EyeIcon : EyeOffIcon;

  return (
    <div className={className} style={S.envToggle}>
      <Icon style={sx(u.icon, u.muted)} />
      <Switch
        aria-label="Toggle value visibility"
        checked={showValues}
        onCheckedChange={setShowValues}
        {...props}
      />
    </div>
  );
};

export type EnvironmentVariablesContentProps = ComponentProps<"div">;

export const EnvironmentVariablesContent = ({
  className,
  children,
  ...props
}: EnvironmentVariablesContentProps) => (
  <div className={className} {...props}>
    {withDividers(children)}
  </div>
);

const EnvironmentVariableContext = createContext<EnvironmentVariableData>({
  name: "",
  value: "",
});

export type EnvironmentVariableGroupProps = WithSx<ComponentProps<"div">>;

export const EnvironmentVariableGroup = ({ style, ...props }: EnvironmentVariableGroupProps) => (
  <div style={sx(S.envGroup, style)} {...props} />
);

export type EnvironmentVariableNameProps = WithSx<ComponentProps<"span">>;

export const EnvironmentVariableName = ({
  className,
  style,
  children,
  ...props
}: EnvironmentVariableNameProps) => {
  const { name } = useContext(EnvironmentVariableContext);

  return (
    <span className={className} style={sx(u.mono, S.envName, style)} {...props}>
      {children ?? name}
    </span>
  );
};

export type EnvironmentVariableValueProps = WithSx<ComponentProps<"span">>;

const MASK_LENGTH = 20;

export const EnvironmentVariableValue = ({
  className,
  style,
  children,
  ...props
}: EnvironmentVariableValueProps) => {
  const { value } = useContext(EnvironmentVariableContext);
  const { showValues } = useContext(EnvironmentVariablesContext);

  const displayValue = showValues ? value : "•".repeat(Math.min(value.length, MASK_LENGTH));

  return (
    <span
      className={className}
      style={sx(u.mono, S.envValue, !showValues && S.envValueMasked, style)}
      {...props}
    >
      {children ?? displayValue}
    </span>
  );
};

export type EnvironmentVariableProps = WithSx<Omit<ComponentProps<"div">, "name">> &
  EnvironmentVariableData;

export const EnvironmentVariable = ({
  name,
  value,
  required,
  style,
  children,
  ...props
}: EnvironmentVariableProps) => {
  const contextValue = useMemo(() => ({ name, value }), [name, value]);

  return (
    <EnvironmentVariableContext.Provider value={contextValue}>
      <div data-slot="environment-variable" style={sx(S.envRow, style)} {...props}>
        {children ?? (
          <>
            <EnvironmentVariableGroup>
              <EnvironmentVariableName />
              {required && <EnvironmentVariableRequired />}
            </EnvironmentVariableGroup>
            <EnvironmentVariableGroup>
              <EnvironmentVariableValue />
              <EnvironmentVariableCopyButton />
            </EnvironmentVariableGroup>
          </>
        )}
      </div>
    </EnvironmentVariableContext.Provider>
  );
};

export type EnvironmentVariableCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
  copyFormat?: "name" | "value" | "export";
};

const COPY_TIMEOUT = 2000;

export const EnvironmentVariableCopyButton = ({
  onCopy,
  onError,
  timeout = COPY_TIMEOUT,
  copyFormat = "value",
  children,
  ...props
}: EnvironmentVariableCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef(0);
  const { name, value } = useContext(EnvironmentVariableContext);

  const copyToClipboard = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    const text = { export: `export ${name}="${value}"`, name, value }[copyFormat];

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setIsCopied(true);
        onCopy?.();
        timeoutRef.current = window.setTimeout(() => setIsCopied(false), timeout);
      })
      .catch((error: Error) => onError?.(error));
  }, [name, value, copyFormat, onCopy, onError, timeout]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      onClick={copyToClipboard}
      size="icon-xs"
      title="Copy"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon />}
    </Button>
  );
};

export type EnvironmentVariableRequiredProps = ComponentProps<typeof Badge>;

export const EnvironmentVariableRequired = ({
  children,
  ...props
}: EnvironmentVariableRequiredProps) => (
  <Badge variant="secondary" {...props}>
    {children ?? "Required"}
  </Badge>
);
