# Components

Preact components under `src/components/`: `ui/` are shadcn primitives, `ai-elements/`
are ports of the [AI SDK Elements](https://elements.ai-sdk.dev) registry, and
`chat.tsx` assembles them over the rows in `chat/`. Every registry component that
needs no new npm dependency is ported; the rest is in
[components/porting.md](components/porting.md).

Read this page first — the rules below hold everywhere. Then read the one page in
`components/` for the job at hand.

| File                                                   | Read it when                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| [`components/styling.md`](components/styling.md)       | writing or changing any component — the inline-style system       |
| [`components/primitives.md`](components/primitives.md) | building on `ui/`, the hand-rolled replacements for radix         |
| [`components/porting.md`](components/porting.md)       | porting a registry element, or asking why a port reads as it does |
| [`components/markdown.md`](components/markdown.md)     | touching `<Markdown>`, `CodeBlock`, or syntax highlighting        |

## Preact, not react

- Import `preact`, `preact/hooks`, and `preact/compat` for `memo`/`forwardRef` only —
  that is preact's own module, not a react shim.
- `reactAliasesEnabled: false` in every vite and vitest config, so a stray `react`
  import fails the build instead of resolving. `test/eject.test.ts` asserts this.
- `tsconfig.json` sets `jsxImportSource: "preact"` and maps no `react` path.
- **Write SVG attributes hyphenated** (`stroke-width`), never camelCase. Preact calls
  `setAttribute` verbatim and the SVG namespace is case-sensitive, so a camelCase
  attribute is inert and nothing warns — the icon simply renders at the SVG default.
- No `asChild` / `Slot`. A trigger is a real `<button>`.
- No tooltip primitive — use the native `title` attribute.

## No stylesheet

The library injects no stylesheet, into a document or a shadow root. A component's
styles are **inline style objects**, merged with `sx()`. The one thing a host must do is
declare the `tokens` text:

```html
<style>
  /* the `tokens` export, verbatim */
</style>
```

**A `var()` with no token behind it resolves to nothing, not to a default** — a host that
skips the snippet gets an unpainted tree. Everything else about the system, and the
rules that cost the most to learn, is in [components/styling.md](components/styling.md).

## The foot floats

In `chat.tsx` the error line, the queue and the composer are one **absolute** row over
the foot of the transcript, not a flex row under it. `ConversationContent` and the
scroll button end above it, by the height a `ResizeObserver` reads off that row.

That is what makes room for a virtual keyboard without moving the surface.
`useKeyboardInset` reports how much of the layout viewport the keyboard covers —
`innerHeight - visualViewport.height - visualViewport.offsetTop`, touch only — and the
foot lifts by it. The header and the transcript stay where they are, and only the
composer rides up; the transcript keeps its height and scrolls under it. Where the
browser honours `interactive-widget=resizes-content` the layout viewport shrinks on
its own, the inset is 0, and the same code does nothing.

A lifted foot is nowhere near the home bar, so `Chat` sets `--chat-safe-bottom: 0px`
there; the composer's `padding-bottom` reads that var with `env(safe-area-inset-bottom)`
as its fallback, so a composer used on its own still clears the bar.

## Exports

`src/index.ts` exports the shell, not single elements, so a new component needs no
barrel change; `src/components/index.ts` is the named export of every built-in.
