// Docs: @docs/3.widget.md
import type { ComarkElementAttributes, ComarkNode } from "md4x/standalone";
import type { ComponentChild, ComponentChildren, ComponentProps, VNode } from "preact";
import { cloneElement, h, isValidElement, toChildArray } from "preact";
import { memo } from "preact/compat";
import { useMemo } from "preact/hooks";

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockTitle,
} from "./ai-elements/code-block.tsx";
import { resolveUrl, useLinkBase } from "../lib/links.ts";
import { parseMarkdown, useMarkdown } from "../lib/markdown.ts";
import { animateOnMount, isLowPowerDevice, prefersReducedMotion } from "../lib/use-animation.ts";
import { fadeInKeyframes, fadeInOptions, reset } from "../styles/base.ts";
import { sx, type Sx, type WithSx } from "../styles/sx.ts";

const S = {
  md: {
    overflowWrap: "break-word",
    wordBreak: "break-word",
  },
  // Until the parser is ready the text is printed as it arrived.
  mdPlain: {
    whiteSpace: "pre-wrap",
  },
  mdP: {
    lineHeight: "1.625",
  },
  mdA: {
    fontWeight: "500",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  mdImg: {
    maxWidth: "100%",
    borderRadius: "0.25rem",
  },
  // Raw HTML is text, and reads as text.
  mdHtml: {
    color: "var(--muted-foreground)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    whiteSpace: "pre-wrap",
  },
  mdBlockquote: {
    borderLeft: "2px solid var(--border)",
    paddingLeft: "0.75rem",
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  mdCode: {
    borderRadius: "0.25rem",
    background: "var(--muted)",
    padding: "0.125rem 0.25rem",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
  },
  mdDel: {
    textDecoration: "line-through",
  },
  mdEm: {
    fontStyle: "italic",
  },
  mdStrong: {
    fontWeight: "600",
  },
  // `fontWeight` has to be restated per heading: the reset's own
  // `fontWeight: inherit` is inline, and would otherwise flatten them.
  mdH1: {
    fontSize: "1.125rem",
    fontWeight: "600",
  },
  mdH2: {
    fontSize: "1rem",
    fontWeight: "600",
  },
  mdH3: {
    fontSize: "0.875rem",
    fontWeight: "600",
  },
  // `paddingLeft` for the same reason: the reset's `padding: 0` is inline.
  mdUl: {
    listStyle: "disc",
    paddingLeft: "1.25rem",
  },
  mdOl: {
    listStyle: "decimal",
    paddingLeft: "1.25rem",
  },
  mdTask: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    listStyle: "none",
  },
  // Lifts the checkbox onto the first text line. `reset.control`'s `margin: 0`
  // is inline, so this has to be inline too.
  mdTaskInput: {
    marginTop: "0.25rem",
  },
  // The gaps `withGap()` below hands to every sibling but the first: top-level
  // blocks, and list items inside a `ul`/`ol`. Every block tag's own `margin: 0`
  // comes from the reset inline, so a sibling rule could not have won.
  mdGap: {
    marginTop: "0.75rem",
  },
  mdLiGap: {
    marginTop: "0.25rem",
  },
  mdTableScroll: {
    overflowX: "auto",
  },
  mdTable: {
    width: "100%",
  },
  mdTh: {
    fontWeight: "500",
  },
  mdCell: {
    border: "1px solid var(--border)",
    padding: "0.25rem 0.5rem",
  },
  alignLeft: {
    textAlign: "left",
  },
  alignCenter: {
    textAlign: "center",
  },
  alignRight: {
    textAlign: "right",
  },
} satisfies Record<string, Sx>;

/**
 * Tags rendered as themselves. Anything outside this map falls through to its
 * children, so a new md4x tag degrades to its text instead of reaching the DOM
 * unstyled.
 *
 * Every look is `sx` alone — no `md-*` class is left, because no rule selects
 * one any more. A tag with no styling of its own still needs an entry, to say it
 * may reach the DOM.
 *
 * `sx` carries the matching reset preset first, where the tag has one — see
 * `styles/base.ts`. It is baked in here rather than at the call site so the
 * generic renderer below does not need a tag-keyed lookup of its own.
 */
type TagLook = { sx?: Sx };

const TAGS: Record<string, TagLook> = {
  blockquote: { sx: sx(reset.text, S.mdBlockquote) },
  code: { sx: sx(reset.code, S.mdCode) },
  del: { sx: S.mdDel },
  em: { sx: S.mdEm },
  h1: { sx: sx(reset.text, S.mdH1) },
  h2: { sx: sx(reset.text, S.mdH2) },
  h3: { sx: sx(reset.text, S.mdH3) },
  h4: { sx: sx(reset.text, S.mdH3) },
  h5: { sx: sx(reset.text, S.mdH3) },
  h6: { sx: sx(reset.text, S.mdH3) },
  hr: { sx: reset.hr },
  li: {},
  ol: { sx: sx(reset.list, S.mdOl) },
  strong: { sx: S.mdStrong },
  table: { sx: sx(reset.table, S.mdTable) },
  tbody: {},
  // `S.mdCell` first, so `th` keeps its own heavier weight.
  td: { sx: S.mdCell },
  th: { sx: sx(S.mdCell, S.mdTh) },
  thead: {},
  tr: {},
  ul: { sx: sx(reset.list, S.mdUl) },
};

// A cell's alignment comes from the markdown table header, so it is a style and
// nothing else — no rule ever selected it.
const ALIGN: Record<string, Sx> = {
  center: S.alignCenter,
  left: S.alignLeft,
  right: S.alignRight,
};

// Model output is untrusted — a page can talk the agent into emitting a link.
// Browsers ignore whitespace and control characters inside a scheme, so drop
// everything non-printable before looking at it.
const isSafeUrl = (url: string, allowImageData = false) => {
  const bare = url.replaceAll(/[^!-~]/g, "");
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(bare);
  if (!scheme) return true; // relative, anchor or query
  const protocol = scheme[1].toLowerCase();
  if (allowImageData && protocol === "data") return /^data:image\//i.test(bare);
  return protocol === "http" || protocol === "https" || protocol === "mailto" || protocol === "tel";
};

/**
 * A link the model wrote. The host's base is read here rather than threaded
 * through the walk, so a panel that follows another tab redraws its links and
 * nothing else. Resolved first and checked second: a relative link under a
 * `chrome:` or `file:` base becomes an url no click could open, and drops back
 * to its own text like any other unsafe one.
 */
const MdLink = ({ href, children }: { href: string; children: ComponentChildren }) => {
  const url = resolveUrl(href, useLinkBase());
  if (!isSafeUrl(url)) return <>{children}</>;
  return (
    <a href={url} rel="noreferrer" style={sx(reset.link, S.mdA)} target="_blank">
      {children}
    </a>
  );
};

/** An image, on the same terms — a relative `src` needs the same base. */
const MdImage = ({ alt, src }: { alt: string; src: string }) => {
  const url = resolveUrl(src, useLinkBase());
  if (!isSafeUrl(url, true)) return null;
  return <img alt={alt} loading="lazy" src={url} style={S.mdImg} />;
};

const text = (nodes: ComarkNode[]): string =>
  nodes
    .map((node) => (typeof node === "string" ? node : text(node.slice(2) as ComarkNode[])))
    .join("");

const attr = (props: ComarkElementAttributes, name: string): string | undefined => {
  const value = props[name];
  return typeof value === "string" ? value : undefined;
};

/** A ```lang [file.ts] fence, through the shared CodeBlock so rangi colours it. */
const Fence = ({ props, nodes }: { props: ComarkElementAttributes; nodes: ComarkNode[] }) => {
  const language = attr(props, "language") ?? "text";
  const filename = attr(props, "filename");
  const code = text(nodes).replace(/\n$/, "");

  return (
    <CodeBlock code={code} language={language}>
      <CodeBlockHeader>
        <CodeBlockTitle>
          <CodeBlockFilename>{filename ?? language}</CodeBlockFilename>
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton />
        </CodeBlockActions>
      </CodeBlockHeader>
    </CodeBlock>
  );
};

/**
 * The fade played by every word that arrives while `animate` is set — one
 * module-scope callback for the whole tree, because the renderer emits an
 * unknown number of them and cannot call a hook per word. See
 * `lib/use-animation.ts`.
 */
const fadeIn = animateOnMount<HTMLSpanElement>(fadeInKeyframes, fadeInOptions);

/** A word with the whitespace that follows it, so no space is lost between spans. */
const WORD = /\S+\s*|\s+/g;

/**
 * Each word in its own span, so only the words that just arrived animate: a
 * word already on screen keeps its key, so preact leaves that element alone
 * and its mount-time fade never plays again. Streaming text otherwise grows a
 * single text node, which no animation can reach.
 *
 * The spans exist only while the text streams — `animate` goes false at the
 * end of the message, and the whole block renders as plain text again.
 *
 * Whitespace alone stays a bare string: the only text nodes under a `ul` or a
 * `table` are the gaps between their rows, where a span would be invalid HTML.
 */
function fadeWords(value: string, key: string): ComponentChildren {
  const words = /\S/.test(value) ? value.match(WORD) : undefined;
  if (!words) return value;

  return words.map((word, index) => (
    <span key={`${key}~${index}`} ref={fadeIn}>
      {word}
    </span>
  ));
}

const renderNodes = (nodes: ComarkNode[], prefix: string, animate: boolean): ComponentChildren[] =>
  nodes.map((node, index) => renderNode(node, `${prefix}.${index}`, animate));

/** Narrows `isValidElement` so the clone below can type the `style` it adds. */
function hasStyle(child: ComponentChild): child is VNode<{ style?: Sx }> {
  return isValidElement(child);
}

/**
 * A `+` sibling gap, done by cloning. Each block tag's own `margin: 0` comes
 * from the reset inline, so a sheet rule could never have outranked it. The gap
 * goes on every child but the first, the same way `PlanSteps` restores its own
 * `> li + li` gap (`ai-elements/plan.tsx`).
 *
 * Used for the top-level block stack (`S.mdGap`) and for list items inside a
 * `ul`/`ol` (`S.mdLiGap`).
 */
function withGap(children: ComponentChildren, gap: Sx): ComponentChildren {
  return toChildArray(children).map((child, index) =>
    index > 0 && hasStyle(child)
      ? cloneElement(child, { style: sx(child.props.style, gap) })
      : child,
  );
}

function renderNode(node: ComarkNode, key: string, animate: boolean): ComponentChildren {
  if (typeof node === "string") return animate ? fadeWords(node, key) : node;

  const [tag, props, ...children] = node;
  if (!tag) return renderNodes(children, key, animate);

  switch (tag) {
    case "a":
      return (
        <MdLink href={attr(props, "href") ?? ""} key={key}>
          {renderNodes(children, key, animate)}
        </MdLink>
      );

    case "img":
      return <MdImage alt={attr(props, "alt") ?? ""} key={key} src={attr(props, "src") ?? ""} />;

    case "pre":
      return <Fence key={key} nodes={children} props={props} />;

    // Raw HTML stays text. Rendering it would hand the host page a script tag
    // by way of the model.
    case "html_block":
      return (
        <div key={key} style={S.mdHtml}>
          {text(children)}
        </div>
      );

    case "p":
      return (
        <p key={key} style={sx(reset.text, S.mdP)}>
          {renderNodes(children, key, animate)}
        </p>
      );

    case "li":
      if (props.task) {
        return (
          <li key={key} style={S.mdTask}>
            <input
              checked={props.checked === true}
              disabled
              style={sx(reset.control, S.mdTaskInput)}
              type="checkbox"
            />
            <span>{renderNodes(children, key, animate)}</span>
          </li>
        );
      }
      break;

    case "table":
      return (
        <div key={key} style={S.mdTableScroll}>
          <table style={TAGS.table?.sx}>{renderNodes(children, key, animate)}</table>
        </div>
      );
  }

  const look = TAGS[tag];
  if (!look) return renderNodes(children, key, animate);
  const align = ALIGN[attr(props, "align") ?? ""];
  const rendered = renderNodes(children, key, animate);

  return h(
    tag,
    {
      key,
      start: tag === "ol" && typeof props.start === "number" ? props.start : undefined,
      style: sx(look.sx, align),
    },
    tag === "ul" || tag === "ol" ? withGap(rendered, S.mdLiGap) : rendered,
  );
}

export type MarkdownProps = WithSx<Omit<ComponentProps<"div">, "children">> & {
  children: string;
  /** This text is still arriving: fade each new word in. See `fadeWords()`. */
  animate?: boolean;
};

/**
 * Markdown through md4x (wasm). The parser loads asynchronously, so text
 * renders verbatim until it is ready — one frame at most, and never blank.
 */
export const Markdown = memo(
  ({ children, className, style, animate = false, ...props }: MarkdownProps) => {
    const isReady = useMarkdown();
    const nodes = useMemo(
      () => (isReady ? parseMarkdown(children) : undefined),
      [children, isReady],
    );

    // Both checks belong here rather than in the fade itself: a reader who gets
    // no animation should not pay for the spans that carry it either.
    const fade = animate && !prefersReducedMotion() && !isLowPowerDevice();

    return (
      <div className={className} style={sx(S.md, nodes ? undefined : S.mdPlain, style)} {...props}>
        {nodes ? withGap(renderNodes(nodes, "md", fade), S.mdGap) : children}
      </div>
    );
  },
  (prev, next) =>
    prev.children === next.children &&
    prev.className === next.className &&
    prev.animate === next.animate,
);
