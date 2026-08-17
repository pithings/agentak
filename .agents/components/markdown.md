# Markdown and syntax highlighting

`md4x/standalone` is loaded lazily and instantiated once. Until it loads, or if it fails,
render source text verbatim. `components/markdown.tsx` renders the AST into Preact; never
switch model or tool output to `dangerouslySetInnerHTML`.

## Security and streaming

- Treat inline/block HTML as text. Drop `javascript:` and `data:` links and images.
- Keep `parseAST(..., { heal: true })` so incomplete streaming delimiters do not flicker.
- Unknown AST tags render their children instead of reaching the DOM unstyled.
- Fences use the shared `CodeBlock`.
- Word animation is only for the trailing streaming part. Disable it for reduced motion
  and low-power/phone devices; settled Markdown must return to plain text nodes.

## Links

`linkBase` changes how relative links resolve, primarily for the extension panel. Resolve
first, then run the safety check.

- Cross-origin links open with `target="_blank"` and `rel="noreferrer"`.
- Same-origin non-fragment links use `history.pushState(null, "", url)` and dispatch
  `popstate` for client routers.
- Same-document fragments and modified/middle clicks stay browser-native.
- Unsafe resolved schemes render as text.

A static same-origin host without a client router is a known limitation: same-origin links
change history without loading a page.

## Highlighting

Use `rangi/core` with the complete language registry. Embedded grammars resolve other
languages by registry name, so registering only a visible subset breaks Vue/HTML/Markdown
fences. Unknown languages render verbatim. Token colors come from `--shj-*` variables.
