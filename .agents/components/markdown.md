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

## Streaming

`<Markdown animate>` fades each word in as it arrives. Streaming text otherwise grows
one text node, which no animation can reach, so under `animate` every word becomes a
span keyed by its position: a word already on screen keeps its key and its element, so
its mount-time fade never plays twice, and only the words that just arrived animate.
The fade is `fadeInKeyframes`/`fadeInOptions` (`styles/base.ts`) through
`animateOnMount()` — a module-scope ref callback, because the renderer emits an unknown
number of them and cannot call a hook per word. Whitespace alone stays a bare string,
since the only text nodes under a `ul` or a `table` are the gaps between rows.

The spans last as long as the stream. `animate` comes from the trailing part of the
last message (`chat/message.tsx` -> `MessageResponse`, and `ReasoningContent` from its
own `isStreaming`); when it goes false the block renders as plain text again, so a
settled transcript carries no extra DOM.

`animate` is a request, and two checks can refuse it: `prefersReducedMotion()` and
`isLowPowerDevice()`, both in `lib/use-animation.ts`. The device is called low power
when it reports `deviceMemory` of 4 GB or less, or 4 cores or fewer, or answers a
coarse pointer on a screen no wider than 820px — a phone, whatever it claims to have.
Both are read in `Markdown` rather than in the fade, because a reader who gets no
animation should not pay for the spans that carry it. One animated element is cheap
everywhere and asks nothing — this is for the many-at-once case alone.

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
