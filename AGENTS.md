# agentak

Agentak provides a standalone chat UI (`AgentChat`) and a Chrome MV3 side panel. It uses
[`@earendil-works/pi-agent-core`](https://www.npmjs.com/package/@earendil-works/pi-agent-core)
for the included agent.

This is a pnpm workspace. The library is in the repository root, the development page is
in `playground/`, and the browser extension is in `extension/`. Both sub-packages map `@`
to `../src`, so they import the library source instead of `dist`.

## Stack

- obuild for the library
- Vite for the playground and extension
- Preact
- shadcn and AI SDK Elements components ported to Preact
- Inline TypeScript style objects for the library; no stylesheet is included
- Vue 3, Vue Router, and Tailwind CSS v4 for the playground host only
- pi-agent-core and pi-ai

## Conventions

- Use standard TypeScript with explicit `.ts` and `.tsx` import extensions. A folder is
  named through its file: `./components/index.ts`, never `./components`. The root
  `tsconfig.json` sets `allowImportingTsExtensions`.
- Use relative paths inside `src/` and `test/`. The `@/` alias is only for `playground/`
  and `extension/`, where it points at the library source.
- Write in Simplified Technical English.
- Keep the design simple and minimal.
- Only add comments when they explain something important. Keep them short.
- Do not write or run end-to-end tests. A person tests the project in a real browser.

## Commands

Run these commands from the repository root. The playground and extension commands call
their package scripts for you.

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

| File                                             | Description                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| [`.agents/components.md`](.agents/components.md) | UI rules and a guide to `components/`                   |
| [`.agents/components/`](.agents/components/)     | Styling, primitives, component ports, and Markdown      |
| [`.agents/session.md`](.agents/session.md)       | The `ChatSession` interface between the UI and an agent |
| [`.agents/pi.md`](.agents/pi.md)                 | The agent loop, providers, tools, and transcript        |
| [`.agents/playground.md`](.agents/playground.md) | The development page and browser extension              |

Start with [`.agents/components.md`](.agents/components.md) for UI work.

## Exports

The package has six entry points, and each one builds into its own bundle. They are listed
in `build.config.ts`. Each bundle has a matching `.d.mts` file, while shared code is placed
in `dist/_chunks`. The package declares `sideEffects: false`.

| Subpath              | Entry                     | Exports                                       |
| -------------------- | ------------------------- | --------------------------------------------- |
| `agentak`            | `src/index.ts`            | `Chat`, `AgentChat`, `mount()`, `ChatSession` |
| `agentak/components` | `src/components/index.ts` | All included components as named exports      |
| `agentak/pi`         | `src/pi/index.ts`         | `createPiSession()` and lower-level Pi APIs   |
| `agentak/preact`     | `src/preact/index.tsx`    | `AgentakChat` for Preact                      |
| `agentak/react`      | `src/react/index.ts`      | `AgentakChat` for React                       |
| `agentak/vue`        | `src/vue/index.ts`        | `AgentakChat` for Vue                         |

Only `agentak/pi` loads the included agent loop. The root entry, component entry, and
framework wrappers all require a `ChatSession`. This lets the host choose its own agent and
keeps Pi out of bundles that do not import `agentak/pi`. See
[`.agents/session.md`](.agents/session.md) for the interface and its import-graph test.

### Framework wrappers

`AgentakChat` wraps `AgentChat` with the two things a framework host usually needs:

1. An element that accepts `class` or `style` and sets the chat size.
2. A call to `injectTokens()` when the component mounts.

A `session` is required for both `AgentakChat` and `AgentChat`. The wrappers never dispose
of a session because they did not create it.

`src/wrap.ts` contains the shared props, `chatProps()`, and `mountChat()`. The Preact wrapper
renders `AgentChat` directly. The React and Vue wrappers each render one `<div>`, then let
Preact render inside it. React or Vue owns the outer element, and Preact owns its children.
The renderers do not update each other's nodes.

`actions` and `emptyActions` are Preact children in every wrapper. React and Vue hosts must
create them with Preact's `h()`. React and Vue are optional peer dependencies, and the
import-graph tests make sure each framework is only imported by its own wrapper.

### Chat behavior

`AgentChat` receives `actions` and `emptyActions` with its required `session` prop.
`actions` appears at the end of the chat header. Use it for host controls such as a
minimize button. `emptyActions` appears below the greeting and is only shown before the
first message.

The provider, model, thinking level, and API key are all selected on the settings page,
`components/chat/settings.tsx`. Two controls open it: a button in the header, and the
composer's trigger, which also names the model that is running. The page then replaces the
transcript. Choosing a model closes it again, as do sending a message and the header's
back arrow. The Pi session also opens the page itself when a turn fails with a 4xx status:
the provider refused the key, the model, or the account, and the answer is on that page.
These choices come from the Pi
session. A custom session without providers shows no provider section and no key section.
A model without reasoning support shows no thinking-level choice.

A saved key can be replaced or removed. The key section then shows both buttons, and
"Remove" drops the key through the session's `forgetKey`. The Pi session takes it out of
its store and steps off the provider, which then needs a key again. A session without
`forgetKey` shows only "Change key".

The stored conversations are the second page, `components/chat/history.tsx`. A clock
button at the head of the header opens it, and the page again replaces the transcript.
Each row is one conversation, with the live one marked and a button to forget it. Picking
one closes the page: the session then replaces its own state with that conversation, so
the chat is never unmounted or swapped. Only one page shows at a time. A session that
reports no `history` shows no button. `createPiSession({ history: true })` is the built-in
store behind it; see [`.agents/pi.md`](.agents/pi.md).

The first user message becomes the default conversation title. If `generateTitle` is
true, the model creates a title after the first answer. This uses one extra request and is
disabled by default. If the request fails, the first-message title stays in place.
`AgentChat` sends changes to the session through `setOptions()`, so the prop can change
without resetting the transcript. `Chat` receives the final string through its `title`
prop. See `src/pi/title.ts`.

### Styles and builds

Agentak does not use a shadow root. It renders into the element supplied by the host, so
styles from the host page can reach the chat. Inline styles protect most of the built-in
appearance. The host can still affect inherited text styles and any children that it
provides.

Only the published library goes into `dist/`. The playground builds to `playground/dist`,
and the extension builds to `extension/dist`. Because of this layout, `files: ["dist"]`
does not need extra filtering.

Rolldown reads `tsconfig.json`, so `jsxImportSource: "preact"` works without duplicate
build settings. The library source uses relative imports and needs no path alias. The
React wrapper does not use JSX. It calls
`createElement()` so the React runtime cannot enter another bundle.

All dependencies and optional peer dependencies are external. The bundles contain the
project source, while lazy imports such as `md4x/standalone`, `pi-ai/api/*`, and
`pi-ai/providers/*.models` stay lazy for the consumer's bundler. The only manually set
platform option is `platform: "browser"`.

## Layout

```text
src/
  index.ts / agent-chat.tsx     Package entry and the container mounted by a host
  session.ts                    `ChatSession`, used by the UI to talk to an agent
  wrap.ts                       Shared code for the three framework wrappers
  preact/ react/ vue/           `AgentakChat` wrappers for each framework
  components/ui/                shadcn primitives ported to Preact
  components/ai-elements/       AI SDK Elements ported to Preact
  components/_parked/           Ports nothing renders yet; exported all the same
  components/chat.tsx           Chat UI with transcript input and callbacks
  components/chat/              Header, empty state, messages, queue, composer, settings, history
  components/elements.tsx       Renderer map for `{ kind: "element" }` parts
  components/markdown.tsx       md4x AST rendered with Preact
  styles/base.ts                `tokens`, reset presets, `u`, and animation settings
  styles/inject.ts              `injectTokens()`, which adds the tokens once
  styles/sx.ts                  `Sx`, `WithSx`, and `sx()` with caller styles last
  lib/                          Icons, Markdown loader, and interaction hooks
  pi/                           Included Pi agent; see `.agents/pi.md`
  types.ts                      UI types copied from the `ai` package
test/                           Library tests that import source through `../src/`
playground/                     Vue host app, package name `@agentak/playground`
extension/                      MV3 side panel, package name `@agentak/extension`
```

## Current status

The agent works end to end with 10 providers and the page tools. Five providers are free
and do not need an API key. A new chat starts without a provider. The first message opens
the settings page, and a free provider can be selected with one click.

Chrome Built-in AI is the fifth free one, and the only provider that sends no request:
Gemini Nano runs in the browser through the Prompt API. It is listed only where the
browser carries that API, which today means a Chrome with both flags set. It answers
text alone — no tool calls and no images.

Kilo and OpenCode Zen do not answer CORS preflight requests. Regular web pages therefore
show 7 providers, while the extension shows all 9 — plus Chrome's own, where it is
there. See
[`.agents/pi.md`](.agents/pi.md). The chat UI, Markdown renderer, and side panel have not
yet been tested in a real browser.

`ChatSession` keeps the chat UI separate from the agent implementation. Pi is only
available through `agentak/pi`, and a host can provide a different session. See
[`.agents/session.md`](.agents/session.md).

A conversation can be stored and opened again. `PiSession.save()` returns a `PiSnapshot` —
the transcript with the provider, model, thinking level and title it ran under —
`restore()` puts one back into the running session, and the `snapshot` option opens on one.

A session can also keep the conversations itself: `createPiSession({ history: true })`
stores them in the same `PiStorage` as the keys, lists them on the chat's history page, and
opens on the newest one. Picking one replaces the session state in place. The playground
does this with `browserStorage()` and keeps no list of its own. A host that stores
conversations elsewhere still uses `save()` and `restore()`. See
[`.agents/pi.md`](.agents/pi.md).

### Next tasks

1. **Read the active tab from the extension.** Add a `PageBridge` that uses
   `chrome.scripting.executeScript`. `documentBridge()` currently reads the side panel's
   empty document. Pass the new bridge through the `page` option of `createPiSession()` in
   `extension/panel.tsx`. This session option should be the only difference between the
   extension and a regular page.
2. **Store extension keys with Chrome storage.** Replace `localStorage` with
   `chrome.storage`, then pass the stored keys through the same `apiKey` option.
3. **Test the UI in a real browser.** Test the chat inside a host page and test the agent
   with a real API key. The playground uses `agentak/vue`, just like a consumer would. It
   tests the Vue wrapper and chat UI together, including how Tailwind's preflight styles
   reach the chat without a shadow root.
4. **Add conversation compaction.** Pi exports `compact()`, but it needs a `Models` store
   and the session's own `Entry[]`. Long conversations can still reach the context limit.
   The warning is already implemented: the context meter turns amber when
   `shouldCompact()` returns true. This helper needs neither dependency. See
   `pi/transcript.ts`.
