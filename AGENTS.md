# agentak

Standalone agent chat surface (`AgentChat`) + Chrome MV3 side panel, over
[`@earendil-works/pi-agent-core`](https://www.npmjs.com/package/@earendil-works/pi-agent-core).

A pnpm workspace: the library at the root, the dev page in `playground/`, the panel
in `extension/`. Both sub-packages alias `@` to `../src`, so they import the library
**source**, not `dist`.

## Stack

- obuild (library) / vite (playground, extension)
- preact
- shadcn + AI SDK Elements components, ported to preact
- library styles as inline style objects in typescript — no stylesheet ships
- vue 3 + vue-router + tailwind v4, in the playground page only — the host app
  around the library, never inside it
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
pnpm typecheck         # tsc --noEmit; vue-tsc for the playground, `.vue` included
pnpm vitest run        # the library's tests; the playground has none
pnpm lint              # oxlint
pnpm fmt               # oxfmt
```

## Extended docs

| File                                             | What                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| [`.agents/components.md`](.agents/components.md) | start here for the UI — the rules, and a map of `components/` |
| [`.agents/components/`](.agents/components/)     | styling, the primitives, porting an element, markdown         |
| [`.agents/session.md`](.agents/session.md)       | `ChatSession` — the seam between the surface and a harness    |
| [`.agents/pi.md`](.agents/pi.md)                 | the agent loop, providers, tools, transcript                  |
| [`.agents/playground.md`](.agents/playground.md) | the dev page and the extension package                        |

## Exports

Three entries, one bundle each; `build.config.ts` lists them. `.d.mts` is emitted
beside every bundle. Nothing in the package has a side effect — `sideEffects: false`.

| Subpath              | Entry                     | What                                         |
| -------------------- | ------------------------- | -------------------------------------------- |
| `agentak`            | `src/index.ts`            | `Chat`, `AgentChat`, `ChatSession`, `tokens` |
| `agentak/components` | `src/components/index.ts` | every built-in component, named              |
| `agentak/pi`         | `src/agent/index.ts`      | the loop — `createPiSession()` and its parts |

**The root entry loads no loop.** `AgentChat` takes a `ChatSession`, and `agentak/pi` is
the only entry that pulls pi in — so a host with its own harness gets the surface and
none of the runtime. The two meet where a host mounts them — `render()` of `AgentChat`
over `createPiSession()`, which is all `extension/panel.tsx` is. See
[`.agents/session.md`](.agents/session.md) for the interface and the guard test.

`AgentChat` takes `actions` and `emptyActions` beside the `session` that runs it.
`actions` lands at the end of the chat header, so a host puts its own chrome —
minimise, and the like — on the one title bar the surface already has. `emptyActions`
lands under the greeting, for a suggestion or a launcher the host owns; it shows only
before the first message. Provider, model and key are all the composer's picker — the pi
session's, so a host harness that carries no providers gets no provider level — so the
chat is the only view there is, with no gate in front of it and no screen to swap to.

The header names the conversation after the first message. `generateTitle` asks the
model for the name instead, once, after the first answer lands; it is one extra request,
so it is off unless a host opts in, and a failure leaves the first-message title
standing. It reaches the session through `setOptions()`, so changing the prop keeps the
transcript. `Chat` takes the finished string as `title`. See `src/agent/title.ts`.

**There is no shadow root.** The surface renders into whatever element the host gives
it, so a host page's stylesheet reaches it. Inline styles outrank every rule, which is
what holds the look together; what a page can still reach is what no element carries
inline — inherited text, and a caller's own children.

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
  index.ts / agent-chat.tsx     package entry, and the container a host mounts
  session.ts                    `ChatSession` — what the surface asks of a harness
  components/ui/                shadcn primitives, in preact
  components/ai-elements/       AI SDK Elements, in preact
  components/chat.tsx           the chat surface — transcript in, callbacks out
  components/chat/              its rows: header, empty, message, queue, composer, picker
  components/elements.tsx       name -> renderer registry for `{ kind: "element" }` parts
  components/markdown.tsx       md4x AST -> preact
  styles/base.ts                `tokens`, `reset` presets, `u`, keyframe/option pairs
  styles/sx.ts                  `Sx`, `WithSx`, `sx()` — merges caller-last
  lib/                          icons, markdown loader, hooks (interaction, animation, …)
  agent/                        the pi loop — see .agents/pi.md
  types.ts                      UI types, inlined from the `ai` package
test/                           library tests, importing source through `@/`
playground/                     vue host app, `@agentak/playground`
extension/                      MV3 side panel, `@agentak/extension`
```

## Status

The loop runs end to end against 9 providers with the page tools, 4 of them free and
keyless. A fresh surface chooses nothing: the first message opens the picker, and a
free provider is then one click and no key. Two of the nine — Kilo and OpenCode Zen —
answer no CORS preflight, so a page is offered 7 and the extension all 9; see
[`.agents/pi.md`](.agents/pi.md). Nothing is verified
in a real browser yet — the surface, markdown and the panel are written but untested
there.

The loop is behind `ChatSession`, so the surface and the harness are separate packages
of code in one repo: pi is reachable from `agentak/pi` alone, and a host can bring
another harness. [`.agents/session.md`](.agents/session.md).

Next:

1. Extension `PageBridge` over `chrome.scripting.executeScript` against the active tab.
   `documentBridge()` reads the side panel's own document today, which is empty. It is a
   `page` option on `createPiSession()` in `extension/panel.tsx` — the session is the
   only place the panel differs from a page.
2. Extension key storage: `chrome.storage` instead of `localStorage`, passed as `apiKey`
   to the same call.
3. Verify the surface in a host page, and the loop against a real key. The playground
   chatbox mounts it the way a host page would, so the page is the host to check —
   including what the page's tailwind preflight now reaches, with no shadow root in
   between.
4. Compaction. pi exports `compact()`, but it needs a `Models` store, so a long
   conversation still runs into the window.
