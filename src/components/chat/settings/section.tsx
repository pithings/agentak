// Docs: @docs/3.widget.md
import type { ComponentChildren, Ref } from "preact";

import { isTouch } from "../../../lib/utils.ts";
import { reset, u } from "../../../styles/base.ts";
import { sx, type Sx } from "../../../styles/sx.ts";

/** What more than one section of the page is drawn with. */
export const S = {
  section: {
    display: "flex",
    minWidth: "0",
    flexDirection: "column",
    gap: "0.5rem",
  },
  heading: {
    color: "var(--muted-foreground)",
    fontSize: "0.6875rem",
    fontWeight: "600",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  note: {
    margin: "0",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // A refusal is still a note, in the one colour that says it went wrong.
  noteBad: { color: "var(--destructive)" },
  // A field and its button, or the buttons a section offers instead. Either way
  // the row is the section's width and the children take what they need.
  buttons: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  rowName: {
    flex: "0 1 auto",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Keeps the far side to itself, whatever the name does.
  rowMeta: {
    marginLeft: "auto",
    flexShrink: "0",
    paddingLeft: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.6875rem",
  },
  // Leading, so the names line up in a column whether or not a row is ticked.
  check: { width: "0.875rem", height: "0.875rem", flexShrink: "0" },
  // `visibility`, not `display`: the box stays, so nothing shifts on a tick.
  checkOff: { visibility: "hidden" },
} satisfies Record<string, Sx>;

/** iOS zooms the page in on a field under 16px and never zooms back out. */
export const noZoom = isTouch() ? u.noZoom : undefined;

/**
 * One section of the page: a heading, and whatever it is about under it.
 *
 * Preact forwards no ref through a component, so a section with a field to
 * focus takes `elementRef` and reads the field off its own box.
 */
export function SettingsSection({
  elementRef,
  title,
  children,
}: {
  elementRef?: Ref<HTMLElement>;
  title: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <section ref={elementRef} style={S.section}>
      <h3 style={sx(reset.text, S.heading)}>{title}</h3>
      {children}
    </section>
  );
}
