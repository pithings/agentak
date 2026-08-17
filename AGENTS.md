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
pnpm build:extension   # extension/dist (load unpacked) + the zip in the docs' public/
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
close button. `emptyActions` appears below the greeting and is only shown before the
first message.

The header reads in one direction: what the bar is, then what the bar does. The title
leads it, and every button follows in the order it is reached for — a new conversation,
the stored ones, the settings, and the host's `actions` last. Only the back arrow of a
page comes before the title, because it is the way out of the page the title names, and
that page also takes the buttons it replaces off the bar. The title is drawn as a heading
— headed word by word and not selectable — while the stored name and the tooltip stay the
words the person or the model wrote.

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
streaming and a turn that only called tools show no row.

A user turn carries a row of its own, on the bubble's side. Both buttons in it rewind the
conversation to that message; they differ in where the rewind lands. **Retry** stays here:
the turns before it, and then the message itself, sent again — the answer it got is
replaced rather than joined, and what was said after it goes with it. **Fork** takes it
away: everything before that message becomes a new conversation, and the message goes back
into the composer with the caret after it, to be sent again with or without a change. So
retry is the branch nobody keeps, and fork is the one that is kept — the conversation
being left is filed away exactly as the header's plus button files one, and a session with
`history` then lists both.

The seam is `fork` and `retryFrom`, each optional, each shown only where it is answered.
`retryFrom` is not `retry`: the error row's button runs a turn that failed, this one runs a
turn that answered. Only fork needs the surface for anything, because only fork types
something back: `Chat` hands the composer a draft with a counter beside it, since the field
is uncontrolled and forking the same message twice is two requests. A session with no
`history` loses the conversation a fork leaves, the way `/new` loses one.

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

A relative link in an answer — `/config`, `./next` — is relative to the document the chat
is in, which is right for a chat on a page and wrong for a surface that talks about
another one: the side panel is `chrome-extension:`, so that link would open a file the
extension does not have. `linkBase` says what the base is instead, an url on `AgentChat`
and `Chat`, and the panel passes the tab in front and passes it again when the reader
moves. A link that names its own scheme is untouched, and one that resolves to a url no
click could open — a `chrome:` base — drops back to its own text like any other unsafe
one. See `lib/links.ts` and [`.agents/components/markdown.md`](.agents/components/markdown.md).

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

The composer takes the focus when a conversation is started or a stored one is opened, and
when the settings page closes — each ends with a transcript and nothing to do but say
something. Mounting is not one of those, because a chat on a page would pull the caret off
whatever the reader was doing. `autoFocus` on `AgentChat` says otherwise, for a surface
that is the whole document: the side panel sets it, and the composer takes the focus as it
mounts. Never on a phone, where the focus is a keyboard over half the surface.

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
`forgetKey` shows only "Change key". A key that is stored and locked shows neither: there
is nothing here to change or remove until it is read, so the section offers "Unlock" with
"Use another key" beside it.

A fifth section sits under the key, where the session reports a `keyLock` — the device
lock, one button and a line saying what it is doing. It reads next to the key because it
is about that key and nothing else on the page.

The stored conversations are the second page, `components/chat/history.tsx`. A clock
button in the header opens it, and the page again replaces the transcript —
the composer stays, because opening a conversation is one click and what is typed is for
the chat, not the page.
Each row is one conversation, with the live one marked and a button to forget it. A row
heads the name word by word, as the bar heads the live one. Picking
one closes the page: the session then replaces its own state with that conversation, so
the chat is never unmounted or swapped. Only one page shows at a time. A session that
reports no `history` shows no button. `createPiSession({ history: true })` is the built-in
store behind it; see [`.agents/pi.md`](.agents/pi.md).

The head of that page is also shown where the reader is already looking. A chat with
stored conversations opens on nothing said and everything said already one page away, so
the empty state carries the three newest at its foot, under the host's `emptyActions` and
the agent card — `ChatRecent`, exported from the same file and rendered by
`components/chat/empty.tsx`. A row opens its conversation
exactly as the page's own row does, and the row under them opens the page for the rest.
The block goes with the greeting once the first message is sent. It is left out where the
session answers no `openConversation`, because a shortcut to nowhere is noise, and where
nothing is stored yet.

The first user message becomes the default conversation title. If `generateTitle` is
true, the model creates a title after the first answer. This uses one extra request and is
disabled by default. If the request fails, the first-message title stays in place.
`AgentChat` sends changes to the session through `setOptions()`, so the prop can change
without resetting the transcript. `Chat` receives the final string through its `title`
prop. See `src/pi/chat/title.ts`.

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

The agent works end to end with 8 providers. Six providers are free
and do not need an API key. A new chat starts without a provider. The first message opens
the settings page, and a free provider can be selected with one click.

Only two of the eight take a key, and both are gateways: Vercel AI Gateway and OpenRouter.
A single-vendor provider is not offered, because a gateway key already reaches that
vendor's models — which is why OpenAI, Groq and Cerebras were dropped. The picker reads in
that order too: the two gateways lead, since one key is the choice worth making, and the
six that need none follow. Inside those six the device's own comes first (wllama), then the
two a page can reach (LLM7, then OVHcloud on the published limit), then the two only the
extension can (Kilo, OpenCode Zen), and Chrome's own last — a 4 GB download that answers
text alone.

Two of the six send no request to a model server. Chrome Built-in AI runs Gemini Nano
through the Prompt API, and is listed only where the browser carries that API, which today
means a Chrome with both flags set. It answers text alone — no tool calls and no images.
On Device (wllama) runs llama.cpp in the tab as WebAssembly: the module comes from a CDN, the
weights from Hugging Face, and the browser keeps both. It is listed on any page with a
worker, except on a phone. An MV3 page may load neither a remote module nor a worker built
at run time, so the panel ships all three itself — wllama, its wasm and its worker — and
says so through `useWllamaSource()`, which is also what puts the row back in its picker.
The phone is the part no source answers for: the download is hundreds of MB and often
metered, a mobile browser reclaims the wasm heap the moment the tab goes to the back, and
the turn is slow on the core and the battery a page is given — a long wait for what the
free providers answer at once. `isPhone()` in `lib/utils.ts` is the test, a coarse pointer
over a screen of at most 820px, so a docked side panel and a laptop with a touch display
are neither of them one. See
[`.agents/playground.md`](.agents/playground.md).

Kilo and OpenCode Zen do not answer CORS preflight requests. Regular web pages therefore
show 4 of the network providers, plus wllama off a phone, while the extension shows all
6 — plus Chrome's own, where it is there, and wllama as well. See
[`.agents/pi.md`](.agents/pi.md). The chat UI, Markdown renderer, and side panel have not
yet been tested in a real browser.

The two keyed gateways read their catalogs from esm.sh at the version published now,
so a model released after this build is still offered and no catalog json ships. The panel
cannot import that url — an MV3 policy allows no remote module — so it passes its own
source through `useCatalogSource()` and ships the catalogs of the pi-ai it was built
against, one lazy chunk each. See [`.agents/playground.md`](.agents/playground.md).

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

Because nearly no page publishes any, the panel adds one tool of its own:
`read_active_tab` hands the model the rendered text of the tab in front, with its title
and url. It is listed on nearly every tab, marked read-only so it runs unasked, and marked
untrusted, so the model is told in front of every result that a page is data and not
instructions. It is named for the tab because `read_page` is the name a site gives its own
reader — these docs do — and one name over two tools leaves the model guessing. A tab that
publishes such a reader is the exception: the panel lists the site's and drops its own,
since a page knows its own structure better than its rendered text does. The
manifest asks for every http origin, because a side panel outlives the tab it was opened
from and `activeTab` would leave the agent blind to every other one.

The panel's service worker also counts what the page in front publishes and puts the
number on the toolbar icon, per tab. `read_active_tab` is left out of it, because the
panel offers that nearly everywhere. The count is the worker's job and not the panel's: it is the
answer for a tab the panel has not been opened on. See
[`.agents/playground.md`](.agents/playground.md).

A conversation can be stored and opened again. `PiSession.save()` returns a `PiSnapshot` —
the transcript with the provider, model, thinking level and title it ran under —
`restore()` puts one back into the running session, and the `snapshot` option opens on one.

A session can also keep the conversations itself: `createPiSession({ history: true })`
stores them in the same `PiStorage` as the keys and lists them on the chat's history page.
It still opens on a new conversation — a chat that was just opened is a chat to start — and
picking one from the page replaces the session state in place. The playground
does this with `browserStorage()` and keeps no list of its own; the panel does it with a
store of its own over `chrome.storage.local`. Every `PiStorage` method answers with a
promise, so a store that replies later — or that decrypts what it holds — needs nothing in
front of it: the session opens on no choices and takes them a beat after, and a host that
would rather not show that mounts on `PiSession.ready`, as the panel does. The panel passes a
`PiHistory` of its own rather than `true`, because its conversations are segmented per
site: the keys and the choices are one browser's, while a conversation is about the tab it
was had on. The chat follows the tab in front from one site's shelf to the next. A host that
stores conversations elsewhere still uses `save()` and `restore()`. See
[`.agents/pi.md`](.agents/pi.md) and [`.agents/playground.md`](.agents/playground.md).

The keys in that store are the one thing sealed. `browserStorage()` wraps itself in
`encryptedStorage()`, which seals every `api-key:*` value with AES-GCM and passes the
provider, the model, the level and the conversations through as they are. The key that
opens them is generated `extractable: false` and kept in IndexedDB, so the browser uses it
and no script copies it out: what a `localStorage` dump or a copied profile carries is
ciphertext with nothing to read it by. A script running on the origin can still ask this
layer to decrypt, which is the part encryption does not answer. A browser with no
`crypto.subtle` or no IndexedDB keeps no key at all — the write is refused and the key
lives for the session. The panel does not wrap its own store, because
`chrome.storage.local` is not a store a page script can read. See `src/pi/storage/secret.ts` and
[`.agents/pi.md`](.agents/pi.md).

A person can ask for more than that key, and the settings page is where: **Device lock**
puts the sealing key in the device's own authenticator instead. `src/pi/storage/passkey.ts` is
WebAuthn's `prf` extension — a salt in, 32 bytes out of the TPM or the Secure Enclave, the
same bytes every time, and only with a fingerprint, a face or a PIN in front of them —
through HKDF into a key that was never in the browser's storage at all. What is stored is a
credential id and a salt, neither of them secret. `src/pi/storage/vault.ts` holds both answers and
the lock between them; `SecretLock` is the seam, and `ChatSession` shows it as `keyLock`
with `setKeyLock` and `unlockKeys`.

It is off by default and shown only where the browser names `extension:prf`. The dialog
needs a user gesture, so the chat opens locked and the **send** is what unlocks: a sealed
key is spotted before the turn, the click is spent on the device, and the message goes.
The settings page has the same button, marks a locked provider "Locked", and offers to save
another key beside it — a deleted passkey takes the keys sealed under it with it. Turning
the lock on or off re-seals what the session holds in memory, because nothing else can read
it to re-seal. `chrome-extension:` origins have no WebAuthn, so the panel has no lock.

A stored value says which key sealed it: `agentak-enc1:` for the browser's own,
`agentak-enc2:` for the device's. The ciphertext is the same either way, so that mark is
the only thing separating a key one touch opens from a key nothing will ever open again —
and the two must not be confused, because an unlock offered for the second opens a dialog
for a credential that is gone. `sealed(name)` reads the mark against the lock and answers
"open", "locked" or "stale"; the session sorts those into a key it has, a key to unlock for,
and a key to type again, which the settings page says in as many words.

### Next tasks

1. **Test the UI in a real browser.** Test the chat inside a host page and test the agent
   with a real API key. The playground uses `agentak/vue`, just like a consumer would. It
   tests the Vue wrapper and chat UI together, including how Tailwind's preflight styles
   reach the chat without a shadow root. Nothing has been run against a real
   `document.modelContext` either — see the end of [`.agents/webmcp.md`](.agents/webmcp.md).
   The panel is the other half: load `extension/dist` unpacked and check the five things
   only a browser can answer — that the bundled catalogs list models, that a key survives
   the panel being closed, that `read_active_tab` returns the tab the person is looking at
   and follows them to the next one — and steps aside on this project's own documentation,
   which publishes a `read_page` of its own — that a `chrome:` screen fails as a tool error
   rather than a broken turn, and that the toolbar icon reads on a light and a dark
   toolbar. The
   badge is the sixth: a page that publishes WebMCP tools puts their count on the icon,
   and the mark belongs to that tab alone. The seventh is the per-site history: a
   conversation had on one site is not listed on another, a tab that comes forward on
   another site moves the chat with it, and browsing away mid-answer still files that
   answer under the site it was about. The eighth is the one nothing here can check at
   all: **the panel's own wllama**. The row is listed and the pieces are written into
   `extension/dist/wllama/`, but no browser has yet started that worker — so the console
   is the answer. A CSP line naming `worker-src` means the file is not being reached; a
   `RUN_OPTIONS` that is undefined means the query did not arrive; a wasm that will not
   instantiate means `wasm-unsafe-eval` or the path. Then the turn itself: pick LFM2.5
   350M, the smallest, and check that the download reports its percentage, that the
   second open loads from OPFS without one, and that a tool call still parses.

   The ninth is the **device lock**, which no test here can really answer either: a fake
   authenticator answers a salt, a real one asks a person. On the playground over
   `localhost` — a secure context, so WebAuthn works — check that the section appears at
   all (it goes on `getClientCapabilities()` naming `extension:prf`, so a browser without
   it should show nothing), that turning it on opens the platform dialog and not a
   security-key one, that the key still answers a turn straight after, that a reload
   leaves the provider listed as "Locked", that the first send opens the dialog on the
   click rather than being refused for want of a gesture — this is the one most likely to
   break, and Safari is the likeliest to break it — that dismissing the dialog leaves the
   message in the composer, and that turning the lock off leaves a working key behind.

2. **Add conversation compaction.** Pi exports `compact()`, but it needs a `Models` store
   and the session's own `Entry[]`. Long conversations can still reach the context limit.
   The warning is already implemented: the context meter turns amber when
   `shouldCompact()` returns true. This helper needs neither dependency. See
   `pi/chat/transcript.ts`.
3. **Give the panel more of the browser.** `read_active_tab` is one tool and the model can
   only read with it. Opening a url, following a link, or reading a second tab are each another
   tool on the same bridge, and each one is a thing the model does to a person's browser
   rather than in it — so the gate matters more than the plumbing does.
