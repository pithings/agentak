import type { ComponentChildren, ComponentProps, JSX } from "preact";
import { createContext } from "preact";
import { useCallback, useContext, useMemo, useState } from "preact/hooks";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Chevron, FileIcon, FolderIcon, FolderOpenIcon } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  tree: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
  },
  treeBody: {
    padding: "0.5rem",
  },
  treeItem: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "0.25rem",
    borderRadius: "var(--radius-sm)",
    padding: "0.25rem 0.5rem",
    textAlign: "left",
    transition: "background-color var(--transition)",
  },
  // `:hover`'s pseudo-class raised its old CSS specificity above the
  // selected rule's single class, so hover always painted over selected
  // regardless of sheet order — verified with a specificity probe, since the
  // rule text alone reads the other way. Hover applies last to match.
  treeItemSelected: {
    background: "var(--muted)",
  },
  treeItemHover: {
    background: "var(--muted-surface)",
  },
  treeFile: {
    cursor: "pointer",
  },
  treeToggle: {
    display: "flex",
    flexShrink: "0",
    alignItems: "center",
    color: "var(--muted-foreground)",
  },
  treeLabel: {
    display: "flex",
    minWidth: "0",
    flex: "1",
    alignItems: "center",
    gap: "0.25rem",
    textAlign: "left",
  },
  treeIcon: {
    display: "flex",
    flexShrink: "0",
  },
  treeName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Keeps a file name in line with the folder names above it.
  treeSpacer: {
    width: "1rem",
    height: "1rem",
    flexShrink: "0",
  },
  treeChildren: {
    marginLeft: "1rem",
    borderLeft: "1px solid var(--border)",
    paddingLeft: "0.5rem",
  },
  treeActions: {
    display: "flex",
    marginLeft: "auto",
    alignItems: "center",
    gap: "0.25rem",
  },
} satisfies Record<string, Sx>;

interface FileTreeContextType {
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  selectedPath?: string;
  onSelect?: (path: string) => void;
}

const noop = () => {};

const FileTreeContext = createContext<FileTreeContextType>({
  expandedPaths: new Set(),
  togglePath: noop,
});

export type FileTreeProps = WithSx<Omit<ComponentProps<"div">, "onSelect">> & {
  expanded?: Set<string>;
  defaultExpanded?: Set<string>;
  selectedPath?: string;
  onSelect?: (path: string) => void;
  onExpandedChange?: (expanded: Set<string>) => void;
};

export const FileTree = ({
  expanded: controlledExpanded,
  defaultExpanded,
  selectedPath,
  onSelect,
  onExpandedChange,
  style,
  children,
  ...props
}: FileTreeProps) => {
  const [internalExpanded, setInternalExpanded] = useState(
    () => defaultExpanded ?? new Set<string>(),
  );
  const expandedPaths = controlledExpanded ?? internalExpanded;

  const togglePath = useCallback(
    (path: string) => {
      const next = new Set(expandedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      setInternalExpanded(next);
      onExpandedChange?.(next);
    },
    [expandedPaths, onExpandedChange],
  );

  const contextValue = useMemo(
    () => ({ expandedPaths, onSelect, selectedPath, togglePath }),
    [expandedPaths, onSelect, selectedPath, togglePath],
  );

  return (
    <FileTreeContext.Provider value={contextValue}>
      <div role="tree" style={sx(S.tree, style)} {...props}>
        <div style={S.treeBody}>{children}</div>
      </div>
    </FileTreeContext.Provider>
  );
};

export type FileTreeIconProps = WithSx<ComponentProps<"span">>;

export const FileTreeIcon = ({ style, children, ...props }: FileTreeIconProps) => (
  <span style={sx(S.treeIcon, style)} {...props}>
    {children}
  </span>
);

export type FileTreeNameProps = WithSx<ComponentProps<"span">>;

export const FileTreeName = ({ style, children, ...props }: FileTreeNameProps) => (
  <span style={sx(S.treeName, style)} {...props}>
    {children}
  </span>
);

export type FileTreeFolderProps = WithSx<ComponentProps<"div">> & {
  path: string;
  name: string;
};

export const FileTreeFolder = ({ path, name, style, children, ...props }: FileTreeFolderProps) => {
  const { expandedPaths, togglePath, selectedPath, onSelect } = useContext(FileTreeContext);
  const isExpanded = expandedPaths.has(path);
  const isSelected = selectedPath === path;
  const { hovered, handlers } = useInteraction<HTMLDivElement>();

  const handleOpenChange = useCallback(() => togglePath(path), [togglePath, path]);
  const handleSelect = useCallback(() => onSelect?.(path), [onSelect, path]);

  return (
    <Collapsible onOpenChange={handleOpenChange} open={isExpanded}>
      <div role="treeitem" style={style} tabIndex={0} {...props}>
        <div
          style={sx(S.treeItem, isSelected && S.treeItemSelected, hovered && S.treeItemHover)}
          {...handlers}
        >
          <CollapsibleTrigger style={S.treeToggle}>
            <Chevron open={isExpanded} turn={90} />
          </CollapsibleTrigger>
          <button onClick={handleSelect} style={sx(reset.button, S.treeLabel)} type="button">
            <FileTreeIcon>
              {isExpanded ? (
                <FolderOpenIcon style={sx(u.icon, u.info)} />
              ) : (
                <FolderIcon style={sx(u.icon, u.info)} />
              )}
            </FileTreeIcon>
            <FileTreeName>{name}</FileTreeName>
          </button>
        </div>
        <CollapsibleContent>
          <div style={S.treeChildren}>{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export type FileTreeFileProps = WithSx<ComponentProps<"div">> & {
  path: string;
  name: string;
  icon?: ComponentChildren;
};

export const FileTreeFile = ({
  path,
  name,
  icon,
  className,
  style,
  children,
  ...props
}: FileTreeFileProps) => {
  const { selectedPath, onSelect } = useContext(FileTreeContext);
  const isSelected = selectedPath === path;
  const { hovered, handlers } = useInteraction<HTMLDivElement>(props);

  const handleClick = useCallback(() => onSelect?.(path), [onSelect, path]);

  const handleKeyDown = useCallback(
    (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") onSelect?.(path);
    },
    [onSelect, path],
  );

  return (
    <div
      className={className}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="treeitem"
      style={sx(
        S.treeItem,
        S.treeFile,
        isSelected && S.treeItemSelected,
        hovered && S.treeItemHover,
        style,
      )}
      tabIndex={0}
      {...props}
      {...handlers}
    >
      {children ?? (
        <>
          <span style={S.treeSpacer} />
          <FileTreeIcon>{icon ?? <FileIcon style={sx(u.icon, u.muted)} />}</FileTreeIcon>
          <FileTreeName>{name}</FileTreeName>
        </>
      )}
    </div>
  );
};

export type FileTreeActionsProps = WithSx<ComponentProps<"div">>;

const stopPropagation = (event: Event) => event.stopPropagation();

/** Row buttons. Stops the click so the row is not selected as well. */
export const FileTreeActions = ({ style, children, ...props }: FileTreeActionsProps) => (
  <div
    onClick={stopPropagation}
    onKeyDown={stopPropagation}
    role="group"
    style={sx(S.treeActions, style)}
    {...props}
  >
    {children}
  </div>
);
