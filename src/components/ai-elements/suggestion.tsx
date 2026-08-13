import { Button, type ButtonProps } from "@/components/ui/button";
import { ScrollArea, type ScrollAreaProps } from "@/components/ui/scroll-area";
import { sx, type Sx } from "@/styles/sx";

const S = {
  suggestions: {
    width: "100%",
    whiteSpace: "nowrap",
  },
  suggestionsRow: {
    display: "flex",
    width: "max-content",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: "0.5rem",
  },
  // Reaches Button as `style`, so it still outranks the size's own padding.
  suggestion: { borderRadius: "9999px", paddingInline: "1rem", cursor: "pointer" },
} satisfies Record<string, Sx>;

export type SuggestionsProps = Omit<ScrollAreaProps, "orientation">;

// `className`/`style` land on the row, not the scroll area — unchanged from
// before, when the row carried `.suggestions-row` and the area carried
// `.suggestions`.
export const Suggestions = ({ className, style, children, ...props }: SuggestionsProps) => (
  <ScrollArea hideScrollbar orientation="horizontal" style={S.suggestions} {...props}>
    <div className={className} style={sx(S.suggestionsRow, style)}>
      {children}
    </div>
  </ScrollArea>
);

export type SuggestionProps = Omit<ButtonProps, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  style,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => (
  <Button
    className={className}
    onClick={() => onClick?.(suggestion)}
    size={size}
    style={sx(S.suggestion, style)}
    type="button"
    variant={variant}
    {...props}
  >
    {children || suggestion}
  </Button>
);
