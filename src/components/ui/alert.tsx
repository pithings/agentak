import type { ComponentProps } from "preact";
import { cloneElement, createContext, toChildArray } from "preact";
import { useContext } from "preact/hooks";

import { isIconChild } from "@/lib/icons";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  alert: {
    boxSizing: "border-box",
    position: "relative",
    display: "grid",
    width: "100%",
    alignItems: "start",
    rowGap: "0.125rem",
    gridTemplateColumns: "0 1fr",
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-lg)",
    background: "var(--wa-background)",
    padding: "0.75rem 1rem",
    color: "var(--wa-foreground)",
    fontSize: "0.875rem",
  },
  // A leading icon claims its own column — set only once one is actually there.
  alertColumns: { gridTemplateColumns: "1rem 1fr", columnGap: "0.75rem" },
  alertIcon: { width: "1rem", height: "1rem", color: "currentColor", translate: "0 0.125rem" },
  destructive: { color: "var(--wa-destructive)" },
  title: {
    gridColumnStart: "2",
    minHeight: "1rem",
    fontWeight: "500",
    letterSpacing: "-0.01em",
  },
  description: {
    display: "grid",
    gridColumnStart: "2",
    justifyItems: "start",
    gap: "0.25rem",
    fontSize: "0.875rem",
    color: "var(--wa-muted-foreground)",
  },
  descriptionDestructive: { color: "currentColor" },
} satisfies Record<string, Sx>;

export type AlertVariant = "default" | "destructive";

const AlertContext = createContext<AlertVariant>("default");

export type AlertProps = WithSx<ComponentProps<"div">> & { variant?: AlertVariant };

function Alert({ className, style, variant = "default", children, ...props }: AlertProps) {
  const isDestructive = variant === "destructive";
  const items = toChildArray(children);
  const hasIcon = items.some(isIconChild);

  return (
    <AlertContext.Provider value={variant}>
      <div
        className={className}
        data-slot="alert"
        data-variant={variant}
        role="alert"
        style={sx(S.alert, hasIcon && S.alertColumns, isDestructive && S.destructive, style)}
        {...props}
      >
        {items.map((child) =>
          isIconChild(child)
            ? cloneElement(child, { style: sx(S.alertIcon, child.props.style) })
            : child,
        )}
      </div>
    </AlertContext.Provider>
  );
}

export type AlertTitleProps = WithSx<ComponentProps<"div">>;

function AlertTitle({ className, style, ...props }: AlertTitleProps) {
  return (
    <div className={className} data-slot="alert-title" style={sx(S.title, style)} {...props} />
  );
}

export type AlertDescriptionProps = WithSx<ComponentProps<"div">>;

function AlertDescription({ className, style, ...props }: AlertDescriptionProps) {
  const isDestructive = useContext(AlertContext) === "destructive";

  return (
    <div
      className={className}
      data-slot="alert-description"
      style={sx(S.description, isDestructive && S.descriptionDestructive, style)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
