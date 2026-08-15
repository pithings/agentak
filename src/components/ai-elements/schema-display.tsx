import type { ComponentChild, ComponentChildren, ComponentProps, VNode } from "preact";
import { cloneElement, createContext, isValidElement, toChildArray } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { Badge } from "../ui/badge.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "../ui/collapsible.tsx";
import { Chevron } from "../../lib/icons.tsx";
import { useInteraction } from "../../lib/use-interaction.ts";
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
  schema: {
    overflow: "hidden",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
  },
  schemaHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    borderBottom: "1px solid var(--border)",
    padding: "0.75rem 1rem",
  },
  schemaDescription: {
    borderBottom: "1px solid var(--border)",
    padding: "0.75rem 1rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
  schemaList: {
    borderTop: "1px solid var(--border)",
  },
  schemaPath: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
  },
  schemaPathParam: {
    color: "var(--info)",
  },
  schemaSectionTrigger: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    textAlign: "left",
    transition: "background-color var(--transition)",
  },
  schemaSectionTriggerHover: {
    background: "var(--muted-surface)",
  },
  schemaSectionTitle: {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  schemaCount: {
    marginLeft: "auto",
  },
  schemaParameter: {
    padding: "0.75rem 1rem 0.75rem 2.5rem",
  },
  schemaProperty: {
    padding: "0.75rem 1rem 0.75rem 0",
  },
  schemaRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  schemaName: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
  },
  // Keeps a leaf row aligned with the rows that carry a chevron.
  schemaSpacer: {
    width: "1rem",
    height: "1rem",
  },
  schemaNote: {
    marginTop: "0.25rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
  // Was `.schema-property > .schema-note` — only the branch-free leaf
  // row shifts its note this far, to sit under the name past the spacer.
  schemaPropertyNote: {
    paddingLeft: "1.5rem",
  },
  schemaBranchNote: {
    paddingBottom: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
  schemaExample: {
    margin: "0 1rem 1rem",
    overflow: "auto",
    borderRadius: "var(--radius-md)",
    background: "var(--muted)",
    padding: "1rem",
    fontFamily: "var(--font-mono)",
    fontSize: "0.875rem",
  },
} satisfies Record<string, Sx>;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface SchemaParameter {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  location?: "path" | "query" | "header";
}

export interface SchemaProperty {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  properties?: SchemaProperty[];
  items?: SchemaProperty;
}

interface SchemaDisplayContextValue {
  method: HttpMethod;
  path: string;
  description?: string;
  parameters?: SchemaParameter[];
  requestBody?: SchemaProperty[];
  responseBody?: SchemaProperty[];
}

const SchemaDisplayContext = createContext<SchemaDisplayContextValue>({
  method: "GET",
  path: "",
});

/**
 * Method badge colors. Badge's own background and color are inline (its
 * `variant="secondary"`), so a class can no longer take them away — this has
 * to reach the badge as `style`. The delete color is reused by `RequiredBadge`.
 */
const METHOD_SX: Record<HttpMethod, Sx> = {
  GET: {
    background: "color-mix(in oklab, var(--success) 15%, transparent)",
    color: "var(--success)",
  },
  POST: {
    background: "color-mix(in oklab, var(--info) 15%, transparent)",
    color: "var(--info)",
  },
  PUT: {
    background: "color-mix(in oklab, var(--notice) 15%, transparent)",
    color: "var(--notice)",
  },
  PATCH: {
    background: "color-mix(in oklab, var(--warning) 15%, transparent)",
    color: "var(--warning)",
  },
  DELETE: { background: "var(--destructive-surface)", color: "var(--destructive)" },
};

/**
 * Was `.badge.schema-method` — Badge's own font-size is inline now (see
 * ui/badge.tsx), so this has to reach the badge as `style` too; font-family
 * has nowhere else to live.
 */
const METHOD_FONT: Sx = { fontFamily: "var(--font-mono)", fontSize: "0.75rem" };

/** Path parameters, kept by `split` because the group is captured. */
const PATH_PARAM = /(\{[^}]+\})/;

const RequiredBadge = () => (
  <Badge style={METHOD_SX.DELETE} variant="secondary">
    required
  </Badge>
);

const SectionChevron = () => {
  const { open } = useCollapsible("SectionChevron");
  return <Chevron open={open} style={u.muted} turn={90} />;
};

type SchemaSectionTriggerProps = WithSx<ComponentProps<typeof CollapsibleTrigger>>;

/** Was `.schema-section-trigger:hover`. */
const SchemaSectionTrigger = ({ className, style, ...props }: SchemaSectionTriggerProps) => {
  const { handlers, hovered } = useInteraction<HTMLButtonElement>(props);

  return (
    <CollapsibleTrigger
      className={className}
      style={sx(S.schemaSectionTrigger, hovered && S.schemaSectionTriggerHover, style)}
      {...props}
      {...handlers}
    />
  );
};

/** Was `.schema-list`, plus the `> * + *` divider between its rows. */
const SchemaList = ({ children }: { children: ComponentChildren }) => (
  <div style={S.schemaList}>{withDividers(children)}</div>
);

export type SchemaDisplayHeaderProps = WithSx<ComponentProps<"div">>;

export const SchemaDisplayHeader = ({ className, style, ...props }: SchemaDisplayHeaderProps) => (
  <div className={className} style={sx(S.schemaHeader, style)} {...props} />
);

export type SchemaDisplayMethodProps = WithSx<ComponentProps<typeof Badge>>;

export const SchemaDisplayMethod = ({
  className,
  style,
  children,
  ...props
}: SchemaDisplayMethodProps) => {
  const { method } = useContext(SchemaDisplayContext);

  return (
    <Badge
      className={className}
      style={sx(METHOD_SX[method], METHOD_FONT, style)}
      variant="secondary"
      {...props}
    >
      {children ?? method}
    </Badge>
  );
};

export type SchemaDisplayPathProps = WithSx<ComponentProps<"span">>;

/** Path parameters are highlighted by splitting the text, never by raw HTML. */
export const SchemaDisplayPath = ({
  className,
  style,
  children,
  ...props
}: SchemaDisplayPathProps) => {
  const { path } = useContext(SchemaDisplayContext);

  return (
    <span className={className} style={sx(S.schemaPath, style)} {...props}>
      {children ??
        path.split(PATH_PARAM).map((part, index) =>
          part.startsWith("{") ? (
            <span data-slot="schema-path-param" key={`${index}-${part}`} style={S.schemaPathParam}>
              {part}
            </span>
          ) : (
            part
          ),
        )}
    </span>
  );
};

export type SchemaDisplayDescriptionProps = WithSx<ComponentProps<"p">>;

export const SchemaDisplayDescription = ({
  className,
  style,
  children,
  ...props
}: SchemaDisplayDescriptionProps) => {
  const { description } = useContext(SchemaDisplayContext);

  return (
    <p className={className} style={sx(reset.text, S.schemaDescription, style)} {...props}>
      {children ?? description}
    </p>
  );
};

export type SchemaDisplayContentProps = WithSx<ComponentProps<"div">>;

export const SchemaDisplayContent = ({
  className,
  children,
  ...props
}: SchemaDisplayContentProps) => (
  <div className={className} {...props}>
    {withDividers(children)}
  </div>
);

export type SchemaDisplayParameterProps = Omit<WithSx<ComponentProps<"div">>, "name"> &
  SchemaParameter;

export const SchemaDisplayParameter = ({
  name,
  type,
  required,
  description,
  location,
  className,
  style,
  ...props
}: SchemaDisplayParameterProps) => (
  <div className={className} style={sx(S.schemaParameter, style)} {...props}>
    <div style={S.schemaRow}>
      <span style={S.schemaName}>{name}</span>
      <Badge variant="outline">{type}</Badge>
      {location && <Badge variant="secondary">{location}</Badge>}
      {required && <RequiredBadge />}
    </div>
    {description && <p style={sx(reset.text, S.schemaNote)}>{description}</p>}
  </div>
);

export type SchemaDisplayParametersProps = ComponentProps<typeof Collapsible>;

export const SchemaDisplayParameters = ({
  className,
  children,
  defaultOpen = true,
  ...props
}: SchemaDisplayParametersProps) => {
  const { parameters } = useContext(SchemaDisplayContext);

  return (
    <Collapsible className={className} defaultOpen={defaultOpen} {...props}>
      <SchemaSectionTrigger>
        <SectionChevron />
        <span style={S.schemaSectionTitle}>Parameters</span>
        <Badge style={S.schemaCount} variant="secondary">
          {parameters?.length}
        </Badge>
      </SchemaSectionTrigger>
      <CollapsibleContent>
        <SchemaList>
          {children ??
            parameters?.map((parameter) => (
              <SchemaDisplayParameter key={parameter.name} {...parameter} />
            ))}
        </SchemaList>
      </CollapsibleContent>
    </Collapsible>
  );
};

export type SchemaDisplayPropertyProps = Omit<WithSx<ComponentProps<"div">>, "name"> &
  SchemaProperty & { depth?: number };

const INDENT = 40;
const STEP = 16;

export const SchemaDisplayProperty = ({
  name,
  type,
  required,
  description,
  properties,
  items,
  depth = 0,
  className,
  style,
  ...props
}: SchemaDisplayPropertyProps) => {
  const paddingLeft = `${INDENT + depth * STEP}px`;

  if (properties || items) {
    return (
      // No open/onOpenChange in this props type — a leaf of the recursion
      // never needs to be driven from outside, only its initial depth.
      // `className`/`style` land on this outer element, not the trigger —
      // it is the one a divider clone from `SchemaList` above targets.
      <Collapsible className={className} defaultOpen={depth < 2} style={style}>
        <SchemaSectionTrigger style={{ paddingLeft }}>
          <SectionChevron />
          <span style={S.schemaName}>{name}</span>
          <Badge variant="outline">{type}</Badge>
          {required && <RequiredBadge />}
        </SchemaSectionTrigger>
        {description && (
          <p
            style={sx(reset.text, S.schemaBranchNote, {
              paddingLeft: `${INDENT + depth * STEP + 24}px`,
            })}
          >
            {description}
          </p>
        )}
        <CollapsibleContent>
          <SchemaList>
            {properties?.map((property) => (
              <SchemaDisplayProperty depth={depth + 1} key={property.name} {...property} />
            ))}
            {items && <SchemaDisplayProperty {...items} depth={depth + 1} name={`${name}[]`} />}
          </SchemaList>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className={className} style={sx(S.schemaProperty, { paddingLeft }, style)} {...props}>
      <div style={S.schemaRow}>
        <span style={S.schemaSpacer} />
        <span style={S.schemaName}>{name}</span>
        <Badge variant="outline">{type}</Badge>
        {required && <RequiredBadge />}
      </div>
      {description && (
        <p style={sx(reset.text, S.schemaNote, S.schemaPropertyNote)}>{description}</p>
      )}
    </div>
  );
};

export type SchemaDisplayRequestProps = ComponentProps<typeof Collapsible>;

export const SchemaDisplayRequest = ({
  className,
  children,
  defaultOpen = true,
  ...props
}: SchemaDisplayRequestProps) => {
  const { requestBody } = useContext(SchemaDisplayContext);

  return (
    <Collapsible className={className} defaultOpen={defaultOpen} {...props}>
      <SchemaSectionTrigger>
        <SectionChevron />
        <span style={S.schemaSectionTitle}>Request Body</span>
      </SchemaSectionTrigger>
      <CollapsibleContent>
        <SchemaList>
          {children ??
            requestBody?.map((property) => (
              <SchemaDisplayProperty depth={0} key={property.name} {...property} />
            ))}
        </SchemaList>
      </CollapsibleContent>
    </Collapsible>
  );
};

export type SchemaDisplayResponseProps = ComponentProps<typeof Collapsible>;

export const SchemaDisplayResponse = ({
  className,
  children,
  defaultOpen = true,
  ...props
}: SchemaDisplayResponseProps) => {
  const { responseBody } = useContext(SchemaDisplayContext);

  return (
    <Collapsible className={className} defaultOpen={defaultOpen} {...props}>
      <SchemaSectionTrigger>
        <SectionChevron />
        <span style={S.schemaSectionTitle}>Response</span>
      </SchemaSectionTrigger>
      <CollapsibleContent>
        <SchemaList>
          {children ??
            responseBody?.map((property) => (
              <SchemaDisplayProperty depth={0} key={property.name} {...property} />
            ))}
        </SchemaList>
      </CollapsibleContent>
    </Collapsible>
  );
};

export type SchemaDisplayBodyProps = WithSx<ComponentProps<"div">>;

export const SchemaDisplayBody = ({ className, children, ...props }: SchemaDisplayBodyProps) => (
  <div className={className} {...props}>
    {withDividers(children)}
  </div>
);

export type SchemaDisplayExampleProps = WithSx<ComponentProps<"pre">>;

export const SchemaDisplayExample = ({ className, style, ...props }: SchemaDisplayExampleProps) => (
  <pre className={className} style={sx(reset.pre, S.schemaExample, style)} {...props} />
);

export type SchemaDisplayProps = WithSx<ComponentProps<"div">> & {
  method: HttpMethod;
  path: string;
  description?: string;
  parameters?: SchemaParameter[];
  requestBody?: SchemaProperty[];
  responseBody?: SchemaProperty[];
};

export const SchemaDisplay = ({
  method,
  path,
  description,
  parameters,
  requestBody,
  responseBody,
  className,
  style,
  children,
  ...props
}: SchemaDisplayProps) => {
  const contextValue = useMemo(
    () => ({ description, method, parameters, path, requestBody, responseBody }),
    [description, method, parameters, path, requestBody, responseBody],
  );

  return (
    <SchemaDisplayContext.Provider value={contextValue}>
      <div className={className} style={sx(S.schema, style)} {...props}>
        {children ?? (
          <>
            <SchemaDisplayHeader>
              <SchemaDisplayMethod />
              <SchemaDisplayPath />
            </SchemaDisplayHeader>
            {description && <SchemaDisplayDescription />}
            <SchemaDisplayContent>
              {parameters && parameters.length > 0 && <SchemaDisplayParameters />}
              {requestBody && requestBody.length > 0 && <SchemaDisplayRequest />}
              {responseBody && responseBody.length > 0 && <SchemaDisplayResponse />}
            </SchemaDisplayContent>
          </>
        )}
      </div>
    </SchemaDisplayContext.Provider>
  );
};
