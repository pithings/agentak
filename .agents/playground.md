# Playground and extension

Two sub-packages that host the library. Both alias `@` to `../src` in their vite
configs, so they run against the **source**: the page is where the library is
worked on, and the panel is the smallest host there is. The `agentak` dependency in
each `package.json` is the honest declaration of that; nothing resolves through it.

Both set `reactAliasesEnabled: false`, as the root does.

## playground/ — `@agentak/playground`

`pnpm dev` serves it on `:4050`. A vue SPA in tailwind — a host app, not a shell
around the library: a topbar, a sidebar that browses every component, a catalog
grid, and the chatbox — a rail on the right on a desktop, a box in the corner on
anything narrower. It is the closest thing the repo has to the page a consumer would
drop the chat into.

| File                  | What                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| `main.ts`             | declares the `tokens` in a `<style>`, then mounts the app on `#app`   |
| `app.vue`             | the shell: topbar, sidebar, `<RouterView>`, chatbox                   |
| `router.ts`           | `/` readme, `/components` catalog, `/demo` transcript, `/c/:name` one |
| `styles.css`          | `@import "tailwindcss"`, and the `@theme` that reads the `--*` names  |
| `theme.ts`            | `.dark` on the root — the whole theme switch, page and widget         |
| `chat-store.ts`       | the widget state the topbar and the catalog both reach for            |
| `components/*.vue`    | topbar, sidebar, chatbox, preview card, and the preact bridge         |
| `views/*.vue`         | readme home, catalog grid, demo transcript, single-component page     |
| `catalog.tsx`         | every component with fixture data, plus the lookups the routes use    |
| `demo-chat.ts`        | the scripted conversation; `autoStart` streams it, prompts included   |
| `demo-transcript.tsx` | the same turns settled, with no playback — the `/demo` page           |
| `demo-agent.tsx`      | `Chat` over the canned turns — no loop, no key                        |
| `chat-actions.tsx`    | the page's own buttons — minimise, back to live, play the demo        |
| `demo-elements.tsx`   | the demo renderers, registered into the element registry              |
| `demo-*.tsx`          | data-driven wrappers, so the demo drives compound elements from props |

### Two frameworks, one page

The page is vue; every component in the library is preact. They meet in
`components/preact-host.vue` — one div that vue renders empty and preact fills, so
neither patches the other's nodes. A catalog preview is one such island; the demo
chat is another.

The chatbox is the one island the page does **not** hand-roll: it is `ChatPanel`
from `agentak/vue`, which owns the same bridge inside the library — a div vue renders
and preact fills. The wrapper carries no loop, so the widget still makes the pi session
itself and still ends it: a `shallowRef` filled on the first live mount, dropped when
the mode changes or the widget goes away. So the widget is also the check on that
wrapper, which is what a consumer of this package writes.

It opens with the page — a phone excepted, where the sheet would cover the page a
visitor came for, so `chat-store.ts` starts minimised and unmounted and the launcher
waits. There is no shadow root between the page and the agent — the `--*` tokens reach
it by inheritance, and so does tailwind preflight. That makes the widget the real
host-page integration, and the one place to check the surface before the extension
ships it. A visitor chooses nothing up front: the first message opens the settings page, and
the free providers need no key.

The demo is the other `ChatMode`, and not a state anything starts in: it is one
**Play the demo** button under the greeting, passed in as `emptyActions`. Taking it
swaps the wrapper for `DemoAgent` over the canned turns — a hand-mounted `PreactHost`
island, because canned turns are the one surface with no session behind them. The
session watcher ends the live one on the way, and ending it stores what it holds — so the
demo keeps nothing, and going back to live reopens the conversation where it was left.

**One title bar.** The surface heads itself — context meter and new conversation in
the header, model and provider in the composer, next to send — so the page puts no
bar of its own over it. Minimise, back-to-live and the demo launcher are all
`chat-actions.tsx`, preact components the page renders _into_ the surface, through the
`actions` and `emptyActions` props — the demo island needs no launcher of its own.
They stay preact vnodes through the vue wrapper, which is why the widget builds them
with `h()` and holds them as constants: a new vnode is a redraw of the island. The
chat is the only view `AgentChat` has, so the box never loses its minimise button; the
empty actions show only before the first message.

The panel hides rather than unmounting, so minimising keeps the transcript; changing
mode ends the session instead, and the store is what brings it back. Escape minimises it as well, from inside the agent too. The handler
skips a `defaultPrevented` Escape, which is how one keystroke dismisses an open popover
**or** the box, never both: `PopoverContent` calls `preventDefault()` when it closes
on Escape. The docked rail is the exception — it covers nothing, so Escape in its
composer must not take a column of the page away.

### The conversations it keeps

Two words of host code: `history: true` on `createPiSession()`, beside the
`browserStorage()` the keys already use. The session keeps every conversation there and
lists them on the chat's own history page — the clock at the head of the bar — so the page
holds no list, no ids and no wiring of its own. See [`pi.md`](pi.md) for what it stores and
[`session.md`](session.md) for the seam it travels on.

Picking one replaces the session's state in place, so the widget never swaps a session and
never loses the island. The page opens on the newest stored conversation, the header's
**new conversation** button files the one it replaces away, and `dispose()` on the way out
writes what is in hand — a tab that closes needs no flush, because a conversation is
written every time the loop settles.

The demo keeps nothing — its turns are canned, and it has no session at all.

### Three layouts, one surface

Two media queries in the widget pick between them, watched rather than read once, so
a resize restyles the one agent instead of mounting a second and losing the
transcript. The library constrains no size of its own: all of this is the host
page's call and lives in the widget alone.

| Width        | Shape                                                    |
| ------------ | -------------------------------------------------------- |
| `lg` and up  | a rail docked on the right, a column of the shell's row  |
| `sm` to `lg` | the floating box, over the bottom-right corner           |
| under `sm`   | a sheet on the whole viewport, no rounding and no border |

**The rail** is chrome of the page, not a box over it. `app.vue` puts the widget in
the same flex row as the sidebar and `<main>`, opposite the sidebar and sticky under
the topbar at full height, so the page narrows to make room and takes it back when
the rail collapses. Minimising animates the wrapper's `width` to `0`; the panel keeps
the rail width inside that wrapper and is clipped by it, so it travels out past the
right edge rather than reflowing its transcript on the way. Because the panel stays
displayed while clipped, `inert` is what keeps the hidden transcript out of the tab
order.

**Below `lg`** the wrapper is `display: contents` and puts nothing in the row: the
panel is `fixed` on its own, in the corner or over the whole screen. It scales from
the corner it sits in, and the launcher — `fixed` in that same corner in every
layout, and a sibling of the rail, never a child that the collapse would clip —
scales from the same point, so the bubble grows into the box and shrinks back out of
it. The launcher shows only while the surface is minimised, and the header chevron is
what minimises it. Both transitions carry `motion-reduce:transition-none`.

The sheet keeps that full height when the keyboard opens — it does **not** resize
itself to the visual viewport. It did once, and the cost was a strip of page showing
below it: a browser that overlays the keyboard rather than shrinking the layout
viewport leaves `visualViewport` a frame behind the animation, and every pixel the
sheet gives up is a pixel of the page behind it. `fixed inset-0` has nothing to show
through, and the agent lifts its own composer over the keyboard instead — see
`useKeyboardInset` in the library. What the widget does own is holding the document
still under the sheet: `overflow: hidden` and `overscroll-behavior: none` on the root
while the box is up and narrow.

### The readme page

`/` is the repo `README.md`. The `markdown()` plugin in `vite.config.ts` renders any
imported `.md` with md4x **at build time** and exports the HTML string, so the page
ships no parser and the file is one static chunk of the entry — the runtime md4x the
chat loads is a separate, lazy import. `views/home-view.vue` puts that string in a
`v-html` and paints it in scoped `:deep()` rules: tailwind preflight strips the
element styles, and the readme has no classes to hook. `src/markdown.d.ts` declares
the `*.md` module for `vue-tsc`.

Fences go through rangi in the same plugin — a span per token carrying the `--shj-*`
the page repoints on `.dark`, so the readme and a chat code block colour alike. Every
grammar is imported, as none of it ships. **The md4x `highlighter` replaces the whole
block**, not the text inside `<code>`: the callback writes its own `<pre><code>`
wrapper, and returning the tokens alone renders the code as running text.

### Tokens and the tailwind theme

`main.ts` puts `tokens` in a `<style>` on the document, the way a host page must —
nothing in the library injects them, and the widget passes `:tokens="false"` because
the page has already said it. `styles.css` then maps its palette onto the
same names with `@theme inline`, so `bg-page` is `var(--background)` and one
class repoints when `.dark` repoints the token. The page and the widget cannot
drift apart.

Tailwind preflight applies to the page and to every island in it, the chatbox
included — there is no shadow root anywhere to stop it. An inline style outranks it, so
what shows through is what no element sets: a component that forgets a reset, or a
caller's own children. Nothing catches that — the human checks the widget itself, and
this page is the honest test of it, because a consumer's page carries a stylesheet too.

### Adding an element to the demo

A port is not done until a human can see it in a browser.

1. Register the renderer in `DEMO_ELEMENTS` in `demo-elements.tsx`. `ELEMENTS` in
   `src/components/elements.tsx` is for the names the loop itself emits.
2. Add a canned reply in `demo-chat.ts` that renders it with realistic fixture data.
   The transcript carries it as a `{ kind: "element", name, props }` part, which
   `chat/message.tsx` looks up in the registry — so a new element needs no change to the
   `ViewPart` union and no branch of its own.
3. Interactive components get static props and no-op callbacks; the demo store holds no
   state for them. A compound element gets a `demo-*.tsx` wrapper, so the demo shape
   stays out of the shipped component.

### Checks

The package has **no tests**. `pnpm vitest run` covers the library alone; the page is
checked by a human in a real browser, which is what the catalog and the chatbox are
for. Nothing automated watches the demo, so a broken fixture shows up on screen.

`pnpm typecheck` runs `vue-tsc` for this package, so `.vue` scripts are checked too.
vue-tsc cannot load typescript 7, so the package pins typescript 5.9 for itself; the
library and the extension stay on the root's 7.

## extension/ — `@agentak/extension`

MV3 side panel. `pnpm build:extension` writes `extension/dist`; load it unpacked. Nothing
here has been opened in a browser yet.

| File             | What                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `manifest.json`  | copied beside the bundle by `vite.config.ts`, never imported         |
| `sidepanel.html` | the panel document — one full-height `#root` to render into          |
| `panel.tsx`      | `ChatPanel` from `agentak/preact`, over `createPiSession()`          |
| `tab-tools.ts`   | the tools of the tab in front, as the session's `page`               |
| `read-page.ts`   | `read_page` — the panel's own tool, and the half injected in a tab   |
| `catalogs.ts`    | the bundled model catalogs, through `useCatalogSource()`             |
| `storage.ts`     | keys, choices and conversations in `chrome.storage.local`            |
| `background.ts`  | the service worker — opens the panel on the action click             |
| `icons/`         | the toolbar icons — `pnpm icons` draws them, `vite.config.ts` copies |
| `vite.config.ts` | two inputs, flat `[name].js`, out to `extension/dist`                |

The panel is the surface a page hosts, plus three things a page does not need.

**The tools of the tab.** `page` is the option a page rarely passes and the panel always
does. Two tools reach the model through it, as one `PageTools`:

- `read_page`, the panel's own — the rendered text of the tab in front, with its title and
  url. It is what makes the agent worth opening on an ordinary site, because WebMCP ships
  behind an origin trial and nearly no page publishes any tool at all. Read-only, so it
  runs unasked; untrusted, so the model is told in front of every result that the page is
  data and not instructions. It is injected in the isolated world, which sees the same dom
  and touches none of the page's own globals.
- whatever the page publishes on `document.modelContext`. Its own document carries none,
  and a WebMCP tool cannot be serialised, so `tab-tools.ts` runs `getTools()` and
  `executeTool()` inside the tab through `chrome.scripting.executeScript` in the `MAIN`
  world, and only names and JSON strings come back. See [`webmcp.md`](webmcp.md).

The manifest asks for every http origin rather than `activeTab`. `activeTab` is granted
for the tab the toolbar button was clicked on, and the side panel outlives that tab: a
person who opens the panel and then browses would find the agent blind to everything but
the one tab it started on, which is the whole of what it is for. The cost is the install
warning that names every site, and it is the honest one — this agent reads pages.

**The catalogs.** The five keyed providers read theirs from esm.sh, and an MV3 content
security policy allows no remote module, so the panel would list no model for any of them.
`catalogs.ts` passes its own source to `useCatalogSource()`: one `import()` per provider,
written out rather than built from the name, because a bundler follows a literal and
nothing else. Each is its own chunk, so a catalog is still only read when its provider is
picked — OpenRouter's alone is 136 KB. They are as old as the build, which is the price of
a panel that lists anything at all. The free providers are unaffected; their models are in
`pi/free-models.ts`, which the panel already bundles.

**The store.** `chrome.storage.local` rather than `localStorage`: it is one area per
extension rather than one per document, and it survives what clearing browsing data takes
away. `PiStorage` reads synchronously and `chrome.storage` does not, so the area is read
in full before anything mounts — a chat that mounted first would show every choice
forgotten, then change it under the reader — and after that the map is the answer while
every write goes both places. The panel keeps its conversations there too.

**The icons.** `assets/agentak.svg` is the logo, and chrome takes a bitmap at four sizes.
`scripts/icons.ts` draws them — the svg's own shapes through their distance functions,
rather than a downscale of a render, so the 16-pixel one is the same drawing and not a
photograph of it. Rerun `pnpm icons` when the logo changes. The one thing it adds is a
plate: the svg picks its ink from the reader's colour scheme, a png cannot, and a toolbar
is light for one person and dark for the next — so the logo is drawn in the svg's own
dark-scheme ink on a rounded plate of its light-scheme ink.

The CSP blocks third-party requests, which is one reason no component fetches a remote
asset. wllama is not offered here for the same reason: `wllamaSupported()` answers no on
a `chrome-extension:` document.
