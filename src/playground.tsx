import { Catalog, catalogStyles } from "@/catalog";
import { WebAgent } from "@/web-agent";
import { tokens, u } from "@/styles/base";
import { css } from "@/lib/css";
import type { Sx } from "@/styles/sx";

/**
 * Playground-only styles. Nothing here ships, so they carry a `pg-` prefix and
 * ride in a `<style>` of their own, next to the tokens the page declares the way
 * a host page would.
 *
 * `.pg` needs a fixed grid-template-columns and `.pg-side` a border on the wide
 * layout, but both are rewritten by the narrow-viewport media query below —
 * there is no inline form of `@media`, so both stay CSS.
 */
export const playgroundStyles = css`
  .pg {
    grid-template-columns: minmax(0, 1fr) clamp(21rem, 28vw, 30rem);
  }
  .pg-side {
    border-left: 1px solid var(--wa-border);
  }

  /* Too narrow to sit side by side: stack, chat first. */
  @media (max-width: 60rem) {
    .pg {
      grid-template-columns: 1fr;
      grid-template-rows: 60vh 1fr;
    }
    .pg-side {
      grid-row: 1;
      border-left: 0;
      border-bottom: 1px solid var(--wa-border);
    }
  }
`;

const S = {
  pg: {
    display: "grid",
    height: "100dvh",
    background: "var(--wa-background)",
    color: "var(--wa-foreground)",
    fontFamily: "var(--wa-font-sans)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    WebkitFontSmoothing: "antialiased",
  },
  pgMain: {
    minWidth: "0",
    overflowY: "auto",
  },
  // Grid, so the single child stretches to the full pane on both axes.
  // `minWidth` is what keeps the track fixed: a grid item sizes to its own
  // content by default, so anything wide inside the chat would push the pane
  // past the column and scroll the whole page sideways.
  pgSide: {
    display: "grid",
    minWidth: "0",
    minHeight: "0",
    overflow: "hidden",
  },
} satisfies Record<string, Sx>;

/**
 * The playground page: the catalog on the left, the chat on the right.
 *
 * The chat runs the real loop — it asks for an API key on first load. Swap in
 * `<WebAgent autoStart demo/>` to replay the canned turns instead.
 */
export function Playground() {
  return (
    <div className="pg" style={S.pg}>
      <style>{tokens + playgroundStyles + catalogStyles}</style>
      <main style={S.pgMain}>
        <Catalog />
      </main>
      <aside className="pg-side" style={S.pgSide}>
        <WebAgent style={u.fill} />
      </aside>
    </div>
  );
}
