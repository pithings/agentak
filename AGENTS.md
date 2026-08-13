# web-agent

Standalone agent chat web component (`<web-agent>`) + Chrome MV3 side panel, over
[`@earendil-works/pi-agent-core`](https://www.npmjs.com/package/@earendil-works/pi-agent-core).

A pnpm workspace: the library at the root, the dev page in `playground/`, the panel
in `extension/`. Both sub-packages alias `@` to `../src`, so they import the library
**source**, not `dist`.

## Stack

- obuild (library) / vite (playground, extension)
- preact
- shadcn + AI SDK Elements components, ported to preact
- styles as inline style objects in typescript — no tailwind, no stylesheet
- pi-agent-core + pi-ai

## Conventions

- Native typescript, explicit `.ts` / `.tsx` imports, `@/` for source paths
- Simplified Technical English
- Prefer simplicity and minimalism in design
- Comments ONLY for important notes, keep them short
- Never e2e test — the human in the loop tests in a real browser

## Commands

Run from the repo root; the playground and extension scripts delegate.

```sh
pnpm dev               # playground on http://localhost:4050
pnpm build             # dist/ (obuild) + playground/dist
pnpm build:lib         # dist/ alone
pnpm build:extension   # extension/dist (load unpacked)
pnpm typecheck         # tsc --noEmit, all three packages
pnpm vitest run        # projects `lib` and `playground`
pnpm lint              # oxlint
pnpm fmt               # oxfmt
```

## Extended docs

| File                                             | What                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| [`.agents/components.md`](.agents/components.md) | start here for the UI — the rules, and a map of `components/` |
| [`.agents/components/`](.agents/components/)     | styling, the primitives, porting an element, markdown         |
| [`.agents/pi.md`](.agents/pi.md)                 | the agent loop, providers, tools, transcript                  |
| [`.agents/playground.md`](.agents/playground.md) | the dev page and the extension package                        |

## Exports

Four entries, one bundle each; `build.config.ts` lists them. `.d.mts` is emitted
beside every bundle.

| Subpath                | Entry                     | What                                                      |
| ---------------------- | ------------------------- | --------------------------------------------------------- |
| `web-agent`            | `src/index.ts`            | `AgentChat`, `WebAgent`, `defineWebAgent`, `tokens`, loop |
| `web-agent/element`    | `src/element.tsx`         | side effect — defines `<web-agent>`                       |
| `web-agent/components` | `src/components/index.ts` | every built-in component, named                           |
| `web-agent/pi`         | `src/agent/index.ts`      | the loop alone; the root re-exports the same set          |

`dist/` is the published library and nothing else — the playground builds into
`playground/dist` and the extension into `extension/dist`, so `files: ["dist"]` needs
no filtering.

Build notes: rolldown reads `tsconfig.json`, so `jsxImportSource: "preact"` and the
`@/*` paths apply with no build config; a stray `react` import fails to resolve. Every
dependency is external, so the bundles carry source alone and the lazy `import()`s
(`md4x/standalone`, `pi-ai/api/*`, `pi-ai/providers/*.models`) stay lazy for the
consumer's bundler. `platform: "browser"` is the one hand-set option.

## Layout

```
src/
  index.ts / element.tsx / web-agent.tsx   package entry, custom element, container
  components/ui/                shadcn primitives, in preact
  components/ai-elements/       AI SDK Elements, in preact
  components/agent-chat.tsx     the chat surface — transcript in, callbacks out
  components/elements.tsx       name -> renderer registry for `{ kind: "element" }` parts
  components/markdown.tsx       md4x AST -> preact
  styles/base.ts                `tokens`, `reset` presets, `u`, keyframe/option pairs
  styles/sx.ts                  `Sx`, `WithSx`, `sx()` — merges caller-last
  lib/                          icons, markdown loader, hooks (interaction, animation, …)
  agent/                        the pi loop — see .agents/pi.md
  types.ts                      UI types, inlined from the `ai` package
test/                           library tests, importing source through `@/`
playground/                     dev page, `@web-agent/playground`
extension/                      MV3 side panel, `@web-agent/extension`
```

## Status

The loop runs end to end against 5 providers with the page tools. Nothing is verified
in a real browser yet — the element, markdown and the panel are written but untested
there.

Next:

1. Extension `PageBridge` over `chrome.scripting.executeScript` against the active tab.
   `documentBridge()` reads the side panel's own document today, which is empty.
2. Extension key storage: `chrome.storage` instead of `localStorage`, passed as `apiKey`.
3. Verify `<web-agent>` in a host page, and the loop against a real key.
4. Compaction. pi exports `compact()`, but it needs a `Models` store, so a long
   conversation still runs into the window.
