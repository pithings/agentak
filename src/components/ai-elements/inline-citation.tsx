import type { ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

import {
  Carousel,
  CarouselContent,
  CarouselIndex,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  type HoverCardContentProps,
  type HoverCardProps,
  type HoverCardTriggerProps,
} from "@/components/ui/hover-card";
import { useInteraction } from "@/lib/use-interaction";
import { reset } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * True while the pointer is over the citation.
 *
 * The highlight was `.inline-citation:hover .inline-citation-text`, a
 * state of one element painting another. No prop on the text can see that,
 * so the citation owns the state and publishes it here — same pattern as
 * `QueueItemHoverContext` in `queue.tsx`.
 */
const InlineCitationHoverContext = createContext(false);

const S = {
  inlineCitation: {
    display: "inline",
    alignItems: "center",
    gap: "0.25rem",
  },
  inlineCitationText: {
    transition: "background var(--transition)",
  },
  inlineCitationTextHover: {
    background: "var(--accent)",
  },
  // Badge's own box and its secondary-variant colours are inline now (see
  // ui/badge.tsx), so borrowing the badge classes no longer reproduces the
  // look — they are reproduced directly here instead, font size included.
  inlineCitationTrigger: {
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: "0",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.25rem",
    overflow: "hidden",
    border: "1px solid transparent",
    borderRadius: "9999px",
    padding: "0.125rem 0.5rem",
    fontWeight: "500",
    lineHeight: "1rem",
    fontSize: "0.75rem",
    whiteSpace: "nowrap",
    background: "var(--secondary)",
    color: "var(--secondary-foreground)",
    marginLeft: "0.25rem",
    cursor: "pointer",
  },
  // Was the `.popover-content.inline-citation-card` compound: wider and
  // unpadded than both the popover base and the hover-card width, so this must
  // reach PopoverContent as `style` to keep outranking them.
  inlineCitationCard: { boxSizing: "border-box", width: "20rem", padding: "0", overflow: "hidden" },
  inlineCitationCarousel: {
    width: "100%",
  },
  inlineCitationCarouselItem: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "1rem 1rem 1rem 2rem",
  },
  inlineCitationCarouselHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    borderRadius: "var(--radius-md) var(--radius-md) 0 0",
    background: "var(--secondary)",
    padding: "0.5rem",
  },
  inlineCitationCarouselIndex: {
    display: "flex",
    flex: "1",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: "0.25rem 0.75rem",
  },
  inlineCitationSource: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  inlineCitationSourceTitle: {
    overflow: "hidden",
    fontSize: "0.875rem",
    fontWeight: "500",
    lineHeight: "1.25",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  inlineCitationSourceUrl: {
    overflow: "hidden",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  inlineCitationSourceDescription: {
    display: "-webkit-box",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: "3",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    lineHeight: "1.6",
  },
  inlineCitationQuote: {
    borderLeft: "2px solid var(--muted)",
    paddingLeft: "0.75rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    fontStyle: "italic",
  },
} satisfies Record<string, Sx>;

export type InlineCitationProps = WithSx<ComponentProps<"span">>;

export const InlineCitation = ({ className, style, ...props }: InlineCitationProps) => {
  const { handlers, hovered } = useInteraction<HTMLSpanElement>(props);

  return (
    <InlineCitationHoverContext.Provider value={hovered}>
      <span className={className} style={sx(S.inlineCitation, style)} {...props} {...handlers} />
    </InlineCitationHoverContext.Provider>
  );
};

export type InlineCitationTextProps = WithSx<ComponentProps<"span">>;

/** The cited passage. Highlights while the pointer is over the citation. */
export const InlineCitationText = ({ className, style, ...props }: InlineCitationTextProps) => {
  const hovered = useContext(InlineCitationHoverContext);

  return (
    <span
      className={className}
      style={sx(S.inlineCitationText, hovered && S.inlineCitationTextHover, style)}
      {...props}
    />
  );
};

export type InlineCitationCardProps = HoverCardProps;

export const InlineCitationCard = (props: InlineCitationCardProps) => (
  <HoverCard closeDelay={0} openDelay={0} {...props} />
);

export type InlineCitationCardTriggerProps = HoverCardTriggerProps & {
  sources: string[];
};

/** A URL that is not one renders as itself, rather than throwing. */
const hostname = (source: string) => {
  try {
    return new URL(source).hostname;
  } catch {
    return source;
  }
};

// The trigger carries the badge look rather than wrapping a `Badge`: this
// project has no `asChild`, and a badge inside a button would be two boxes.
// `S.inlineCitationTrigger` above reproduces the whole look, font size
// included — Badge's own `badge` class carries no style any more (see
// ui/badge.tsx), so there is nothing left to borrow from it.
export const InlineCitationCardTrigger = ({
  sources,
  className,
  children,
  style,
  ...props
}: InlineCitationCardTriggerProps) => (
  <HoverCardTrigger className={className} style={sx(S.inlineCitationTrigger, style)} {...props}>
    {children ??
      (sources[0]
        ? `${hostname(sources[0])}${sources.length > 1 ? ` +${sources.length - 1}` : ""}`
        : "unknown")}
  </HoverCardTrigger>
);

export type InlineCitationCardBodyProps = HoverCardContentProps;

export const InlineCitationCardBody = ({
  className,
  style,
  ...props
}: InlineCitationCardBodyProps) => (
  <HoverCardContent className={className} style={sx(S.inlineCitationCard, style)} {...props} />
);

export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>;

export const InlineCitationCarousel = ({
  className,
  style,
  ...props
}: InlineCitationCarouselProps) => (
  <Carousel className={className} style={sx(S.inlineCitationCarousel, style)} {...props} />
);

export type InlineCitationCarouselContentProps = ComponentProps<typeof CarouselContent>;

export const InlineCitationCarouselContent = (props: InlineCitationCarouselContentProps) => (
  <CarouselContent {...props} />
);

export type InlineCitationCarouselItemProps = ComponentProps<typeof CarouselItem>;

export const InlineCitationCarouselItem = ({
  className,
  style,
  ...props
}: InlineCitationCarouselItemProps) => (
  <CarouselItem className={className} style={sx(S.inlineCitationCarouselItem, style)} {...props} />
);

export type InlineCitationCarouselHeaderProps = WithSx<ComponentProps<"div">>;

export const InlineCitationCarouselHeader = ({
  className,
  style,
  ...props
}: InlineCitationCarouselHeaderProps) => (
  <div className={className} style={sx(S.inlineCitationCarouselHeader, style)} {...props} />
);

export type InlineCitationCarouselIndexProps = ComponentProps<typeof CarouselIndex>;

export const InlineCitationCarouselIndex = ({
  className,
  style,
  ...props
}: InlineCitationCarouselIndexProps) => (
  <CarouselIndex
    className={className}
    style={sx(S.inlineCitationCarouselIndex, style)}
    {...props}
  />
);

export type InlineCitationCarouselPrevProps = ComponentProps<typeof CarouselPrevious>;

export const InlineCitationCarouselPrev = (props: InlineCitationCarouselPrevProps) => (
  <CarouselPrevious {...props} />
);

export type InlineCitationCarouselNextProps = ComponentProps<typeof CarouselNext>;

export const InlineCitationCarouselNext = (props: InlineCitationCarouselNextProps) => (
  <CarouselNext {...props} />
);

export type InlineCitationSourceProps = WithSx<ComponentProps<"div">> & {
  title?: string;
  url?: string;
  description?: string;
};

export const InlineCitationSource = ({
  title,
  url,
  description,
  className,
  style,
  children,
  ...props
}: InlineCitationSourceProps) => (
  <div className={className} style={sx(S.inlineCitationSource, style)} {...props}>
    {title && <h4 style={sx(reset.text, S.inlineCitationSourceTitle)}>{title}</h4>}
    {url && <p style={sx(reset.text, S.inlineCitationSourceUrl)}>{url}</p>}
    {description && <p style={sx(reset.text, S.inlineCitationSourceDescription)}>{description}</p>}
    {children}
  </div>
);

export type InlineCitationQuoteProps = WithSx<ComponentProps<"blockquote">>;

export const InlineCitationQuote = ({ className, style, ...props }: InlineCitationQuoteProps) => (
  <blockquote
    className={className}
    style={sx(reset.text, S.inlineCitationQuote, style)}
    {...props}
  />
);
