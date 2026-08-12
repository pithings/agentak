import type { ComponentProps, ComponentType } from "preact";

import { Button, type ButtonProps } from "@/components/ui/button";
import type { IconProps } from "@/lib/icons";
import { XIcon } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  artifact: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid var(--wa-border)",
    borderRadius: "var(--wa-radius-lg)",
    background: "var(--wa-background)",
    boxShadow: "var(--wa-shadow-xs)",
  },
  artifactHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--wa-border)",
    background: "var(--wa-muted-surface)",
    padding: "0.75rem 1rem",
  },
  artifactTitle: {
    color: "var(--wa-foreground)",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  artifactDescription: {
    color: "var(--wa-muted-foreground)",
    fontSize: "0.875rem",
  },
  artifactActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  // Passed as `style`, so it still outranks the ghost variant's own colours —
  // that is what the `.wa-btn.wa-artifact-action` compound used to do.
  artifactAction: { color: "var(--wa-muted-foreground)" },
  artifactActionHover: { color: "var(--wa-foreground)" },
  artifactContent: {
    flex: "1",
    overflow: "auto",
    padding: "1rem",
  },
} satisfies Record<string, Sx>;

export type ArtifactProps = WithSx<ComponentProps<"div">>;

export const Artifact = ({ className, style, ...props }: ArtifactProps) => (
  <div className={className} style={sx(S.artifact, style)} {...props} />
);

export type ArtifactHeaderProps = WithSx<ComponentProps<"div">>;

export const ArtifactHeader = ({ className, style, ...props }: ArtifactHeaderProps) => (
  <div className={className} style={sx(S.artifactHeader, style)} {...props} />
);

export type ArtifactCloseProps = ButtonProps;

export const ArtifactClose = ({
  className,
  children,
  style,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: ArtifactCloseProps) => {
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <Button
      className={className}
      size={size}
      style={sx(S.artifactAction, hovered && S.artifactActionHover, style)}
      title="Close"
      type="button"
      variant={variant}
      {...props}
      {...handlers}
    >
      {children ?? <XIcon style={u.icon} />}
      <span style={u.srOnly}>Close</span>
    </Button>
  );
};

export type ArtifactTitleProps = WithSx<ComponentProps<"p">>;

export const ArtifactTitle = ({ className, style, ...props }: ArtifactTitleProps) => (
  <p className={className} style={sx(reset.text, S.artifactTitle, style)} {...props} />
);

export type ArtifactDescriptionProps = WithSx<ComponentProps<"p">>;

export const ArtifactDescription = ({ className, style, ...props }: ArtifactDescriptionProps) => (
  <p className={className} style={sx(reset.text, S.artifactDescription, style)} {...props} />
);

export type ArtifactActionsProps = WithSx<ComponentProps<"div">>;

export const ArtifactActions = ({ className, style, ...props }: ArtifactActionsProps) => (
  <div className={className} style={sx(S.artifactActions, style)} {...props} />
);

export type ArtifactActionProps = ButtonProps & {
  tooltip?: string;
  label?: string;
  icon?: ComponentType<IconProps>;
};

/** `tooltip` is the native `title` — this project carries no tooltip primitive. */
export const ArtifactAction = ({
  tooltip,
  label,
  icon: Icon,
  children,
  className,
  style,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: ArtifactActionProps) => {
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <Button
      className={className}
      size={size}
      style={sx(S.artifactAction, hovered && S.artifactActionHover, style)}
      title={tooltip}
      type="button"
      variant={variant}
      {...props}
      {...handlers}
    >
      {Icon ? <Icon style={u.icon} /> : children}
      <span style={u.srOnly}>{label || tooltip}</span>
    </Button>
  );
};

export type ArtifactContentProps = WithSx<ComponentProps<"div">>;

export const ArtifactContent = ({ className, style, ...props }: ArtifactContentProps) => (
  <div className={className} style={sx(S.artifactContent, style)} {...props} />
);
