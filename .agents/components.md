# Components

Preact components under `src/components/`: `ui/` are shadcn primitives, `ai-elements/`
are ports of the [AI SDK Elements](https://elements.ai-sdk.dev) registry, and
`agent-chat.tsx` assembles them. Every registry component that needs no new npm
dependency is ported; the rest is in [components/porting.md](components/porting.md).

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

## Exports

`src/index.ts` exports the shell, not single elements, so a new component needs no
barrel change; `src/components/index.ts` is the named export of every built-in.
