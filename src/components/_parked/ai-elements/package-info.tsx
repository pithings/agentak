import type { ComponentChildren, ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { Badge } from "../../ui/badge.tsx";
import { ArrowRightIcon, MinusIcon, PackageIcon, PlusIcon } from "../../../lib/icons.tsx";
import { reset, u } from "../../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../../styles/sx.ts";

const S = {
  pkg: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
    padding: "1rem",
  },
  pkgHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
  },
  pkgName: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  pkgNameText: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  // Change tints come from the status tokens, so no dark-mode rule is needed.
  pkgChange: {
    textTransform: "capitalize",
  },
  pkgChangeAdded: {
    background: "color-mix(in oklab, var(--info) 15%, transparent)",
    color: "var(--info)",
  },
  pkgChangeMajor: {
    background: "color-mix(in oklab, var(--danger) 15%, transparent)",
    color: "var(--danger)",
  },
  pkgChangeMinor: {
    background: "color-mix(in oklab, var(--warning) 15%, transparent)",
    color: "var(--warning)",
  },
  pkgChangePatch: {
    background: "color-mix(in oklab, var(--success) 15%, transparent)",
    color: "var(--success)",
  },
  pkgChangeRemoved: {
    background: "var(--muted-surface)",
    color: "var(--muted-foreground)",
  },
  pkgVersion: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginTop: "0.5rem",
    color: "var(--muted-foreground)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
  },
  pkgVersionNew: {
    color: "var(--foreground)",
    fontWeight: "500",
  },
  pkgIconSm: {
    width: "0.75rem",
    height: "0.75rem",
  },
  pkgDescription: {
    marginTop: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
  pkgContent: {
    marginTop: "0.75rem",
    borderTop: "1px solid var(--border)",
    paddingTop: "0.75rem",
  },
  pkgDeps: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  pkgDepsList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  pkgDepsLabel: {
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
    fontWeight: "500",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  pkgDep: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "0.875rem",
  },
  pkgDepVersion: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

export type ChangeType = "major" | "minor" | "patch" | "added" | "removed";

interface PackageInfoContextType {
  name: string;
  currentVersion?: string;
  newVersion?: string;
  changeType?: ChangeType;
}

const PackageInfoContext = createContext<PackageInfoContextType>({ name: "" });

// Was a map of class names. Badge's own variant backgrounds are inline now
// (see ui/badge.tsx), so a class can no longer win over them — each tint is a
// style override instead, which lands after Badge's own `secondary` variant.
const CHANGE_STYLES: Record<ChangeType, Sx> = {
  added: S.pkgChangeAdded,
  major: S.pkgChangeMajor,
  minor: S.pkgChangeMinor,
  patch: S.pkgChangePatch,
  removed: S.pkgChangeRemoved,
};

const CHANGE_ICONS: Record<ChangeType, ComponentChildren> = {
  added: <PlusIcon style={S.pkgIconSm} />,
  major: <ArrowRightIcon style={S.pkgIconSm} />,
  minor: <ArrowRightIcon style={S.pkgIconSm} />,
  patch: <ArrowRightIcon style={S.pkgIconSm} />,
  removed: <MinusIcon style={S.pkgIconSm} />,
};

export type PackageInfoHeaderProps = WithSx<ComponentProps<"div">>;

export const PackageInfoHeader = ({
  className,
  children,
  style,
  ...props
}: PackageInfoHeaderProps) => (
  <div className={className} style={sx(S.pkgHeader, style)} {...props}>
    {children}
  </div>
);

export type PackageInfoNameProps = WithSx<ComponentProps<"div">>;

export const PackageInfoName = ({ className, children, style, ...props }: PackageInfoNameProps) => {
  const { name } = useContext(PackageInfoContext);

  return (
    <div className={className} style={sx(S.pkgName, style)} {...props}>
      <PackageIcon style={sx(u.icon, u.muted)} />
      <span style={S.pkgNameText}>{children ?? name}</span>
    </div>
  );
};

export type PackageInfoChangeTypeProps = WithSx<ComponentProps<"span">>;

export const PackageInfoChangeType = ({
  className,
  children,
  style,
  ...props
}: PackageInfoChangeTypeProps) => {
  const { changeType } = useContext(PackageInfoContext);

  if (!changeType) return null;

  return (
    <Badge
      className={className}
      variant="secondary"
      style={sx(S.pkgChange, CHANGE_STYLES[changeType], style)}
      {...props}
    >
      {CHANGE_ICONS[changeType]}
      {children ?? changeType}
    </Badge>
  );
};

export type PackageInfoVersionProps = WithSx<ComponentProps<"div">>;

export const PackageInfoVersion = ({
  className,
  children,
  style,
  ...props
}: PackageInfoVersionProps) => {
  const { currentVersion, newVersion } = useContext(PackageInfoContext);

  if (!(currentVersion || newVersion)) return null;

  return (
    <div className={className} style={sx(S.pkgVersion, style)} {...props}>
      {children ?? (
        <>
          {currentVersion && <span>{currentVersion}</span>}
          {currentVersion && newVersion && <ArrowRightIcon style={S.pkgIconSm} />}
          {newVersion && <span style={S.pkgVersionNew}>{newVersion}</span>}
        </>
      )}
    </div>
  );
};

export type PackageInfoProps = WithSx<ComponentProps<"div">> & {
  name: string;
  currentVersion?: string;
  newVersion?: string;
  changeType?: ChangeType;
};

export const PackageInfo = ({
  name,
  currentVersion,
  newVersion,
  changeType,
  className,
  children,
  style,
  ...props
}: PackageInfoProps) => {
  const contextValue = useMemo(
    () => ({ changeType, currentVersion, name, newVersion }),
    [changeType, currentVersion, name, newVersion],
  );

  return (
    <PackageInfoContext.Provider value={contextValue}>
      <div className={className} style={sx(S.pkg, style)} {...props}>
        {children ?? (
          <>
            <PackageInfoHeader>
              <PackageInfoName />
              <PackageInfoChangeType />
            </PackageInfoHeader>
            <PackageInfoVersion />
          </>
        )}
      </div>
    </PackageInfoContext.Provider>
  );
};

export type PackageInfoDescriptionProps = WithSx<ComponentProps<"p">>;

export const PackageInfoDescription = ({
  className,
  children,
  style,
  ...props
}: PackageInfoDescriptionProps) => (
  <p className={className} style={sx(reset.text, S.pkgDescription, style)} {...props}>
    {children}
  </p>
);

export type PackageInfoContentProps = WithSx<ComponentProps<"div">>;

export const PackageInfoContent = ({
  className,
  children,
  style,
  ...props
}: PackageInfoContentProps) => (
  <div className={className} style={sx(S.pkgContent, style)} {...props}>
    {children}
  </div>
);

export type PackageInfoDependenciesProps = WithSx<ComponentProps<"div">>;

export const PackageInfoDependencies = ({
  className,
  children,
  style,
  ...props
}: PackageInfoDependenciesProps) => (
  <div className={className} style={sx(S.pkgDeps, style)} {...props}>
    <span style={S.pkgDepsLabel}>Dependencies</span>
    <div style={S.pkgDepsList}>{children}</div>
  </div>
);

export type PackageInfoDependencyProps = WithSx<ComponentProps<"div">> & {
  name: string;
  version?: string;
};

export const PackageInfoDependency = ({
  name,
  version,
  className,
  children,
  style,
  ...props
}: PackageInfoDependencyProps) => (
  <div className={className} style={sx(S.pkgDep, style)} {...props}>
    {children ?? (
      <>
        <span style={sx(u.mono, u.muted)}>{name}</span>
        {version && <span style={S.pkgDepVersion}>{version}</span>}
      </>
    )}
  </div>
);
