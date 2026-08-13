# Markdown and syntax highlighting

## Markdown

[`md4x`](https://github.com/unjs/md4x) (wasm) parses; `components/markdown.tsx`
renders. `lib/markdown.ts` instantiates the wasm once and `useMarkdown()` reports when
that finishes; until then, and if it fails, text renders verbatim, so a first paint is
never blank and never lost.

`<Markdown>` walks the AST from `parseAST(text, { heal: true })` into preact elements
rather than calling `renderToHtml`:

- **No `dangerouslySetInnerHTML`.** This text comes from a model reading an untrusted
  page. In the AST, inline HTML is already a text node, `html_block` renders as text,
  and `javascript:` / `data:` URLs are dropped from links and images.
- Fences become the shared `CodeBlock`, so markdown and tool output are highlighted and
  copyable by the same component.

`heal` closes delimiters left open mid-stream, so a half-typed `**bold` does not
flicker. `CLASSES` in that file is the tag allowlist — a tag missing from it renders
its children, so a new md4x tag degrades to text instead of reaching the DOM unstyled.

Every import is `md4x/standalone`, which carries the wasm inline as deflated base64 and
inflates it through `DecompressionStream`. One entry, one branch, node and browser
alike — no export conditions, no build plugin, no emitted asset for a host page or an
extension to fetch. `lib/markdown.ts` imports it dynamically, so the base64 stays a
lazy chunk, and `parseAST` is reached through `parseMarkdown()` rather than imported
directly.

## Syntax highlighting

`code-block.tsx` uses [`rangi`](https://github.com/pi0/rangi) through `rangi/core`,
which bundles no grammar. `LANGUAGES` in that file lists what is registered (`bash`,
`diff`, `json`, `ts`, `tsx` — tool input/output plus the fences that reach a code block
through markdown). An unregistered language comes back as one untyped token, so it
renders verbatim.

rangi is synchronous: tokenizing happens in a `useMemo` and the first render is already
coloured. No highlighter cache, no token cache, no placeholder pass.

Colors come from `--shj-<token>` in `styles/base.ts` — github-light on `:root`/`:host`,
github-dark on `.dark`/`:host(.dark)`. This is rangi's `cssVariables` theme written out
by hand, because its own light/dark pairs inline `light-dark()`, which follows
`color-scheme` rather than this project's class-based `dark` variant.
