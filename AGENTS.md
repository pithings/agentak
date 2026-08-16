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
| [`.agents/webmcp.md`](.agents/webmcp.md)         | The tools a page offers, and the copied spec            |
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

Each finished answer carries a row of two buttons under it: copy, and read aloud. Both
take the text parts of that turn and leave out the thinking and the tool calls. Copy puts
the markdown the model wrote on the clipboard; read aloud speaks it as words, so
`spokenText()` runs it through md4x's own `renderToText` first — `renderMarkdownText()` in
`lib/markdown.ts`, the parser the transcript has already loaded to draw that same answer.
The render drops the markers a voice would read as punctuation, keeps a link's label and
not its url, and leaves `snake_case` and `2 * 3` alone. Around it `spokenText()` decides
the four things the render cannot: a code fence is named rather than read, the list and
quote marks it keeps are cut, a table row is spoken as cells rather than tabs, and emoji
go — a voice either names one or says nothing. Where md4x failed to load the markdown goes
as it is, which is how the message itself is shown then too. A turn that is still
streaming, a user turn, and a turn that only called tools show no row.

`lib/use-copy.ts` holds the clipboard call and the short "copied" state.
`lib/use-speech.ts` holds the reading: it speaks through `window.speechSynthesis`, and the
button is left out where the browser has none. The text goes in as sentences of at most
180 characters, because Chrome drops an utterance that runs past about fifteen seconds,
and at rate 1, the engine's own pace, which is the pace a voice was recorded at. The hook
takes another rate where a caller wants one.

`pickVoice()` chooses which voice reads, because the engine's own first one is the robotic
one — Alex or Albert on macOS, eSpeak on Linux. The list is all the API offers, so the name
is what it goes on: the page's language first, then the mark each engine writes on its
better voices — "(Enhanced)" and "(Premium)" for a voice Apple has downloaded, "Online
(Natural)" for the neural ones Edge streams, and the "Google …" names of Chrome's network
voices. Safari carries no mark until a voice is downloaded — it offers Apple's own voices
and nothing else — so its newer names are ranked above Alex. The macOS joke shelf is pushed
to the back, though a joke voice that reads the language still beats a good one that does
not. One voice runs the whole reading, and where
Chrome has not loaded its list yet the engine keeps its own.

One voice at a time — starting a reading cancels any other, and each reading carries a
number so the events of a cancelled one do not clear the flag of its replacement.

The composer takes two slash commands: `/model` opens the settings page, and `/new` starts
a conversation — the header's two buttons, reached from the keyboard. A field holding one
slash word lists what it can be above the composer, a row per command. The list is walked
without leaving the field: the arrows move a cursor that wraps at either end, Tab writes the
rest of the name and stops there, Enter runs the row the cursor is on, and Escape puts the
list away without touching what was typed. The pointer moves the same cursor, so one row is
ever lit. A submit with the list shut still runs the command a name states, or the one
command a half-typed name leaves; anything else is a message and is sent as it was written,
a leading slash included. While the list is open the field carries the combobox role and
`aria-activedescendant`, and drops both with it — a chat's textarea is a message field the
rest of the time. Each command is only offered where the surface can answer it: a session
with no providers and no models carries no `/model`, and `Chat` is what passes the composer
its `onReset`.

The provider, model, thinking level, and API key are all selected on the settings page,
`components/chat/settings.tsx`. Two controls open it: a button in the header, and the
composer's trigger, which also names the model that is running. The page then takes the
whole surface under the header: it replaces the transcript, and the composer is hidden
under it, because there is nothing to say to a provider that is still being chosen. The
composer is hidden and not unmounted, so a half-typed message is still there on the way
back. Choosing a model closes the page again, as do sending a message and the header's
back arrow. The Pi session also opens the page itself when a turn fails with a 401, 402,
403 or 404: the provider refused the key, the account, or the model, and the answer is on
that page. A rate limit, a timeout and a full context window are answered by waiting, so
those leave the transcript where it is and offer the retry button instead.
These choices come from the Pi
session. A custom session without providers shows no provider section and no key section.
A model without reasoning support shows no thinking-level choice.

A saved key can be replaced or removed. The key section then shows both buttons, and
"Remove" drops the key through the session's `forgetKey`. The Pi session takes it out of
its store and steps off the provider, which then needs a key again. A session without
`forgetKey` shows only "Change key".

The stored conversations are the second page, `components/chat/history.tsx`. A clock
button at the head of the header opens it, and the page again replaces the transcript —
the composer stays, because opening a conversation is one click and what is typed is for
the chat, not the page.
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

The agent works end to end with 11 providers. Six providers are free
and do not need an API key. A new chat starts without a provider. The first message opens
the settings page, and a free provider can be selected with one click.

Two of the six send no request to a model server. Chrome Built-in AI runs Gemini Nano
through the Prompt API, and is listed only where the browser carries that API, which today
means a Chrome with both flags set. It answers text alone — no tool calls and no images.
Local (wllama) runs llama.cpp in the tab as WebAssembly: the module comes from a CDN, the
weights from Hugging Face, and the browser keeps both. It is listed on any page with a
worker, which is every page but an MV3 one — the side panel may import no remote module.

Kilo and OpenCode Zen do not answer CORS preflight requests. Regular web pages therefore
show 7 of the network providers, plus wllama, while the extension shows all 9 — plus
Chrome's own, where it is there, and without wllama. See
[`.agents/pi.md`](.agents/pi.md). The chat UI, Markdown renderer, and side panel have not
yet been tested in a real browser.

The five keyed providers read their catalogs from esm.sh at the version published now,
so a model released after this build is still offered and no catalog json ships. The
panel cannot import that url — see the next tasks below.

`ChatSession` keeps the chat UI separate from the agent implementation. Pi is only
available through `agentak/pi`, and a host can provide a different session. See
[`.agents/session.md`](.agents/session.md).

The loop carries no tools of its own. `createPiSession({ page: true })` offers the model
whatever the current page publishes on `document.modelContext` — WebMCP — and the panel
passes a source that reads the tab in front instead. It is off by default, the names are
cut to what a provider takes, and `readOnlyHint` decides the gate: a tool that only reads
runs unasked, and anything else is confirmed on every call. Discovery has been tried in a
browser and a call has not, and WebMCP itself only ships in Chrome 149 and Edge 150 behind
an origin trial. See [`.agents/webmcp.md`](.agents/webmcp.md).

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

1. **Give the agent the page itself.** The WebMCP tools are wired, but a page that
   publishes none leaves the model with nothing to read. A tool that returns the visible
   text of the current document is the missing half, and in the panel it runs through the
   same `chrome.scripting.executeScript` path as `extension/webmcp-tab.ts`. That file also
   uses `activeTab`, so only the tab the toolbar button was clicked on answers — decide
   whether wider `host_permissions` is worth it while you are there.
2. **Give the panel its catalogs back.** The keyed providers import
   `esm.sh/@earendil-works/pi-ai@latest/providers/<id>.models`, which an MV3 content
   security policy blocks, so all five fail to load in the side panel. `useCatalogSource()`
   in `pi/providers.ts` is the seam: the panel passes an import of its own and pins the
   models it ships. Decide there whether the panel bundles the json again, or reaches the
   url through the background worker.
3. **Store extension keys with Chrome storage.** Replace `localStorage` with
   `chrome.storage`, then pass the stored keys through the same `apiKey` option.
4. **Test the UI in a real browser.** Test the chat inside a host page and test the agent
   with a real API key. The playground uses `agentak/vue`, just like a consumer would. It
   tests the Vue wrapper and chat UI together, including how Tailwind's preflight styles
   reach the chat without a shadow root. Nothing has been run against a real
   `document.modelContext` either — see the end of [`.agents/webmcp.md`](.agents/webmcp.md).
5. **Add conversation compaction.** Pi exports `compact()`, but it needs a `Models` store
   and the session's own `Entry[]`. Long conversations can still reach the context limit.
   The warning is already implemented: the context meter turns amber when
   `shouldCompact()` returns true. This helper needs neither dependency. See
   `pi/transcript.ts`.
