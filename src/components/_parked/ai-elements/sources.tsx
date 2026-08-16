import type { ComponentProps } from "preact";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "../../ui/collapsible.tsx";
import { BookIcon, Chevron } from "../../../lib/icons.tsx";
import { reset, u } from "../../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../../styles/sx.ts";

const S = {
  sources: {
    marginBottom: "1rem",
    color: "var(--primary)",
    fontSize: "0.75rem",
  },
  sourcesTrigger: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: "500",
  },
  sourcesContent: {
    display: "flex",
    width: "fit-content",
    flexDirection: "column",
    gap: "0.5rem",
    marginTop: "0.75rem",
    outline: "none",
  },
  source: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  sourceTitle: {
    display: "block",
    fontWeight: "500",
  },
} satisfies Record<string, Sx>;

export type SourcesProps = WithSx<ComponentProps<typeof Collapsible>>;

export const Sources = ({ className, style, ...props }: SourcesProps) => (
  // No "sources" class: nothing selects it now that the chevron rule
  // is gone — it was only ever the anchor for that one rule.
  <Collapsible className={className} style={sx(S.sources, style)} {...props} />
);

export type SourcesTriggerProps = WithSx<ComponentProps<typeof CollapsibleTrigger>> & {
  count: number;
};

export const SourcesTrigger = ({
  className,
  style,
  count,
  children,
  ...props
}: SourcesTriggerProps) => {
  const { open } = useCollapsible("SourcesTrigger");

  return (
    <CollapsibleTrigger className={className} style={sx(S.sourcesTrigger, style)} {...props}>
      {children ?? (
        <>
          <p style={reset.text}>Used {count} sources</p>
          <Chevron open={open} />
        </>
      )}
    </CollapsibleTrigger>
  );
};

export type SourcesContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const SourcesContent = ({ className, style, ...props }: SourcesContentProps) => (
  <CollapsibleContent className={className} style={sx(S.sourcesContent, style)} {...props} />
);

export type SourceProps = WithSx<ComponentProps<"a">>;

/** One citation. Opens in a new tab, so `rel` keeps the opener private. */
export const Source = ({ className, style, href, title, children, ...props }: SourceProps) => (
  <a
    className={className}
    href={href}
    rel="noreferrer"
    style={sx(reset.link, S.source, style)}
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <BookIcon style={u.icon} />
        <span style={S.sourceTitle}>{title}</span>
      </>
    )}
  </a>
);
