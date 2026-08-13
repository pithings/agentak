import type { ComponentProps } from "preact";
import { isValidElement, toChildArray } from "preact";

import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
    paddingBlock: "1.5rem",
    color: "var(--foreground)",
    boxShadow: "var(--shadow-xs)",
  },
  header: {
    display: "grid",
    alignItems: "start",
    gridAutoRows: "min-content",
    gridTemplateRows: "auto auto",
    gap: "0.5rem",
    paddingInline: "1.5rem",
  },
  // An action takes a column of its own, spanning title and description.
  headerWithAction: {
    gridTemplateColumns: "1fr auto",
  },
  title: { fontWeight: "600", lineHeight: "1" },
  description: { color: "var(--muted-foreground)", fontSize: "0.875rem" },
  action: { gridColumn: "2", gridRow: "1 / span 2", alignSelf: "start", justifySelf: "end" },
  content: { paddingInline: "1.5rem" },
  footer: { display: "flex", alignItems: "center", paddingInline: "1.5rem" },
} satisfies Record<string, Sx>;

export type CardProps = WithSx<ComponentProps<"div">>;

function Card({ className, style, ...props }: CardProps) {
  return <div className={className} data-slot="card" style={sx(S.card, style)} {...props} />;
}

function CardHeader({ className, style, children, ...props }: CardProps) {
  // CardAction takes a grid column of its own — no `:has()` needed once the
  // header renders its own children.
  const hasAction = toChildArray(children).some(
    (child) => isValidElement(child) && child.type === CardAction,
  );

  return (
    <div
      className={className}
      data-slot="card-header"
      style={sx(S.header, hasAction && S.headerWithAction, style)}
      {...props}
    >
      {children}
    </div>
  );
}

function CardTitle({ className, style, ...props }: CardProps) {
  return <div className={className} data-slot="card-title" style={sx(S.title, style)} {...props} />;
}

function CardDescription({ className, style, ...props }: CardProps) {
  return (
    <div
      className={className}
      data-slot="card-description"
      style={sx(S.description, style)}
      {...props}
    />
  );
}

function CardAction({ className, style, ...props }: CardProps) {
  return (
    <div className={className} data-slot="card-action" style={sx(S.action, style)} {...props} />
  );
}

function CardContent({ className, style, ...props }: CardProps) {
  return (
    <div className={className} data-slot="card-content" style={sx(S.content, style)} {...props} />
  );
}

function CardFooter({ className, style, ...props }: CardProps) {
  return (
    <div className={className} data-slot="card-footer" style={sx(S.footer, style)} {...props} />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
