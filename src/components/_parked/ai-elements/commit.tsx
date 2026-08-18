import type { ComponentChildren, ComponentProps } from "preact";
import { cloneElement, toChildArray } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { Avatar, AvatarFallback } from "../ui/avatar.tsx";
import { Button, type ButtonProps } from "../../ui/button.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible.tsx";
import {
  CheckIcon,
  CopyIcon,
  FileIcon,
  GitCommitIcon,
  isIconChild,
  MinusIcon,
  PlusIcon,
} from "../../../lib/icons.tsx";
import { useInteraction } from "../../../lib/use-interaction.ts";
import { sx, type Sx, type WithSx } from "../../../styles/sx.ts";

const S = {
  commit: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
  },
  commitHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.75rem",
    textAlign: "left",
  },
  commitHeaderTrigger: {
    display: "flex",
    minWidth: "0",
    alignItems: "center",
    gap: "0.75rem",
    textAlign: "left",
    transition: "opacity var(--transition)",
  },
  commitHeaderTriggerHover: {
    opacity: "0.8",
  },
  commitInfo: {
    display: "flex",
    minWidth: "0",
    flex: "1",
    flexDirection: "column",
  },
  commitMessage: {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  commitMetadata: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  commitHash: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
  },
  commitHashIcon: {
    display: "inline-block",
    width: "0.75rem",
    height: "0.75rem",
    marginRight: "0.25rem",
    verticalAlign: "-0.125rem",
  },
  commitTime: {
    fontSize: "0.75rem",
  },
  commitAuthor: {
    display: "flex",
    alignItems: "center",
  },
  commitActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
  },
  // Size is `icon-xs` on the Button — the metadata line it sits on is 0.75rem.
  // The negative margin pulls it back against the hash it copies.
  commitCopy: {
    flexShrink: "0",
    marginInlineStart: "-0.25rem",
  },
  commitContent: {
    borderTop: "1px solid var(--border)",
    padding: "0.75rem",
  },
  commitFiles: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  commitFile: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    borderRadius: "var(--radius-sm)",
    padding: "0.25rem 0.5rem",
    fontSize: "0.875rem",
  },
  commitFileHover: {
    background: "var(--muted-surface)",
  },
  commitFileInfo: {
    display: "flex",
    minWidth: "0",
    alignItems: "center",
    gap: "0.5rem",
  },
  commitFileIcon: {
    width: "0.875rem",
    height: "0.875rem",
    flexShrink: "0",
    color: "var(--muted-foreground)",
  },
  commitFilePath: {
    overflow: "hidden",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  commitFileStatus: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: "500",
  },
  commitFileChanges: {
    display: "flex",
    flexShrink: "0",
    alignItems: "center",
    gap: "0.25rem",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
  },
  // Inline-flex, not inline: the count must never wrap under the icon when the
  // row is tight.
  commitChange: {
    display: "inline-flex",
    flexShrink: "0",
    alignItems: "center",
    gap: "0.125rem",
    whiteSpace: "nowrap",
  },
  commitChangeIcon: {
    width: "0.75rem",
    height: "0.75rem",
    flexShrink: "0",
  },
  // Status hues, not theme colours — the same tokens the tool badges use.
  commitAdded: {
    color: "var(--success)",
  },
  commitDeleted: {
    color: "var(--danger)",
  },
  commitModified: {
    color: "var(--warning)",
  },
  commitRenamed: {
    color: "var(--info)",
  },
} satisfies Record<string, Sx>;

export type CommitProps = WithSx<ComponentProps<typeof Collapsible>>;

export const Commit = ({ className, style, ...props }: CommitProps) => (
  <Collapsible className={className} style={sx(S.commit, style)} {...props} />
);

export type CommitHeaderProps = WithSx<ComponentProps<"div">>;

/**
 * Upstream makes the whole header the collapsible trigger. Here the trigger is
 * a real `<button>`, so anything with a button of its own — `CommitActions`, or
 * `CommitCopyButton` beside the hash — stays outside `CommitHeaderTrigger`. The
 * trigger wraps the message line alone.
 */
export const CommitHeader = ({ className, style, ...props }: CommitHeaderProps) => (
  <div className={className} style={sx(S.commitHeader, style)} {...props} />
);

export type CommitHeaderTriggerProps = WithSx<ComponentProps<typeof CollapsibleTrigger>>;

export const CommitHeaderTrigger = ({ className, style, ...props }: CommitHeaderTriggerProps) => {
  const { hovered, handlers } = useInteraction<HTMLButtonElement>(props);

  return (
    <CollapsibleTrigger
      className={className}
      style={sx(S.commitHeaderTrigger, hovered && S.commitHeaderTriggerHover, style)}
      {...props}
      {...handlers}
    />
  );
};

/**
 * Size a caller's own icon. Only for caller children — `toChildArray` flattens
 * arrays but not fragments, so a fragment built here would arrive as one opaque
 * child and never match. The defaults below carry their style themselves.
 */
const sizeIcons = (children: ComponentChildren, iconSx: Sx) =>
  toChildArray(children).map((child) =>
    isIconChild(child) ? cloneElement(child, { style: sx(iconSx, child.props.style) }) : child,
  );

export type CommitHashProps = WithSx<ComponentProps<"span">>;

export const CommitHash = ({ className, children, style, ...props }: CommitHashProps) => (
  <span className={className} style={sx(S.commitHash, style)} {...props}>
    <GitCommitIcon style={S.commitHashIcon} />
    {sizeIcons(children, S.commitHashIcon)}
  </span>
);

export type CommitMessageProps = WithSx<ComponentProps<"span">>;

export const CommitMessage = ({ className, style, ...props }: CommitMessageProps) => (
  <span className={className} style={sx(S.commitMessage, style)} {...props} />
);

export type CommitMetadataProps = WithSx<ComponentProps<"div">>;

export const CommitMetadata = ({ className, style, ...props }: CommitMetadataProps) => (
  <div className={className} style={sx(S.commitMetadata, style)} {...props} />
);

export type CommitSeparatorProps = ComponentProps<"span">;

export const CommitSeparator = ({ children, ...props }: CommitSeparatorProps) => (
  <span {...props}>{children ?? "•"}</span>
);

export type CommitInfoProps = WithSx<ComponentProps<"div">>;

export const CommitInfo = ({ className, style, ...props }: CommitInfoProps) => (
  <div className={className} style={sx(S.commitInfo, style)} {...props} />
);

export type CommitAuthorProps = WithSx<ComponentProps<"div">>;

export const CommitAuthor = ({ className, style, ...props }: CommitAuthorProps) => (
  <div className={className} style={sx(S.commitAuthor, style)} {...props} />
);

export type CommitAuthorAvatarProps = ComponentProps<typeof Avatar> & { initials: string };

export const CommitAuthorAvatar = ({ initials, ...props }: CommitAuthorAvatarProps) => (
  <Avatar {...props}>
    <AvatarFallback>{initials}</AvatarFallback>
  </Avatar>
);

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const MS_IN_DAY = 1000 * 60 * 60 * 24;

const formatRelativeDate = (date: Date) =>
  relativeTimeFormat.format(Math.round((date.getTime() - Date.now()) / MS_IN_DAY), "day");

export type CommitTimestampProps = Omit<WithSx<ComponentProps<"time">>, "dateTime"> & {
  date: Date;
};

/** Formatted after mount: "now" differs between a server render and the client. */
export const CommitTimestamp = ({
  date,
  className,
  children,
  style,
  ...props
}: CommitTimestampProps) => {
  const [formatted, setFormatted] = useState("");

  useEffect(() => setFormatted(formatRelativeDate(date)), [date]);

  return (
    <time
      className={className}
      dateTime={date.toISOString()}
      style={sx(S.commitTime, style)}
      {...props}
    >
      {children ?? formatted}
    </time>
  );
};

export type CommitActionsProps = WithSx<ComponentProps<"div">>;

export const CommitActions = ({ className, style, ...props }: CommitActionsProps) => (
  <div className={className} role="group" style={sx(S.commitActions, style)} {...props} />
);

export type CommitCopyButtonProps = ButtonProps & {
  hash: string;
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CommitCopyButton = ({
  hash,
  onCopy,
  onError,
  timeout = 2000,
  children,
  style,
  ...props
}: CommitCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef(0);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const copy = async () => {
    if (!navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }
    if (isCopied) return;

    try {
      await navigator.clipboard.writeText(hash);
      setIsCopied(true);
      onCopy?.();
      timeoutRef.current = setTimeout(() => setIsCopied(false), timeout) as unknown as number;
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      onClick={copy}
      size="icon-xs"
      style={sx(S.commitCopy, style)}
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon />}
    </Button>
  );
};

export type CommitContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const CommitContent = ({ className, style, ...props }: CommitContentProps) => (
  <CollapsibleContent className={className} style={sx(S.commitContent, style)} {...props} />
);

export type CommitFilesProps = WithSx<ComponentProps<"div">>;

export const CommitFiles = ({ className, style, ...props }: CommitFilesProps) => (
  <div className={className} style={sx(S.commitFiles, style)} {...props} />
);

export type CommitFileProps = WithSx<ComponentProps<"div">>;

export const CommitFile = ({ className, style, ...props }: CommitFileProps) => {
  const { hovered, handlers } = useInteraction<HTMLDivElement>(props);

  return (
    <div
      className={className}
      style={sx(S.commitFile, hovered && S.commitFileHover, style)}
      {...props}
      {...handlers}
    />
  );
};

export type CommitFileInfoProps = WithSx<ComponentProps<"div">>;

export const CommitFileInfo = ({ className, style, ...props }: CommitFileInfoProps) => (
  <div className={className} style={sx(S.commitFileInfo, style)} {...props} />
);

const FILE_STATUS = {
  added: { sx: S.commitAdded, label: "A" },
  deleted: { sx: S.commitDeleted, label: "D" },
  modified: { sx: S.commitModified, label: "M" },
  renamed: { sx: S.commitRenamed, label: "R" },
} as const;

export type CommitFileStatusValue = keyof typeof FILE_STATUS;

export type CommitFileStatusProps = WithSx<ComponentProps<"span">> & {
  status: CommitFileStatusValue;
};

export const CommitFileStatus = ({
  status,
  className,
  children,
  style,
  ...props
}: CommitFileStatusProps) => (
  <span
    className={className}
    style={sx(S.commitFileStatus, FILE_STATUS[status].sx, style)}
    {...props}
  >
    {children ?? FILE_STATUS[status].label}
  </span>
);

export type CommitFileIconProps = WithSx<ComponentProps<typeof FileIcon>>;

export const CommitFileIcon = ({ className, style, ...props }: CommitFileIconProps) => (
  <FileIcon className={className} style={sx(S.commitFileIcon, style)} {...props} />
);

export type CommitFilePathProps = WithSx<ComponentProps<"span">>;

export const CommitFilePath = ({ className, style, ...props }: CommitFilePathProps) => (
  <span className={className} style={sx(S.commitFilePath, style)} {...props} />
);

export type CommitFileChangesProps = WithSx<ComponentProps<"div">>;

export const CommitFileChanges = ({ className, style, ...props }: CommitFileChangesProps) => (
  <div className={className} style={sx(S.commitFileChanges, style)} {...props} />
);

export type CommitFileCountProps = WithSx<ComponentProps<"span">> & { count: number };

export const CommitFileAdditions = ({
  count,
  className,
  children,
  style,
  ...props
}: CommitFileCountProps) => {
  if (count <= 0) return null;

  return (
    <span className={className} style={sx(S.commitChange, S.commitAdded, style)} {...props}>
      {children === undefined ? (
        <>
          <PlusIcon style={S.commitChangeIcon} />
          {count}
        </>
      ) : (
        sizeIcons(children, S.commitChangeIcon)
      )}
    </span>
  );
};

export const CommitFileDeletions = ({
  count,
  className,
  children,
  style,
  ...props
}: CommitFileCountProps) => {
  if (count <= 0) return null;

  return (
    <span className={className} style={sx(S.commitChange, S.commitDeleted, style)} {...props}>
      {children === undefined ? (
        <>
          <MinusIcon style={S.commitChangeIcon} />
          {count}
        </>
      ) : (
        sizeIcons(children, S.commitChangeIcon)
      )}
    </span>
  );
};
