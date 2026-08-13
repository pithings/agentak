# Playground and extension

Two sub-packages that host the library. Both alias `@` to `../src` in their vite
configs, so they run against the **source**: the page is where the library is
worked on, and the panel is where the element is hosted. The `agentak` dependency in
each `package.json` is the honest declaration of that; nothing resolves through it.

Both set `reactAliasesEnabled: false`, as the root does.

## playground/ — `@agentak/playground`

`pnpm dev` serves it on `:4050`. A vue SPA in tailwind — a host app, not a shell
around the library: a topbar, a sidebar that browses every component, a catalog
grid, and the chatbox — a rail on the right on a desktop, a box in the corner on
anything narrower. It is the closest thing the repo has to the page a consumer would
drop the element into.

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

The chatbox is not an island. It opens with the page — a phone excepted, where the
sheet would cover the page a visitor came for, so `chat-store.ts` starts minimised
and unmounted and the launcher waits. It opens on the **live** agent —
`<agent-chat>`, the custom element, so the agent runs behind a shadow root: none
of the page's tailwind reaches in, and nothing of the agent reaches out. Only
the `--*` tokens cross, because a custom property inherits. That makes the
widget the real host-page integration, and the one place to check the element
before the extension ships it. A visitor chooses nothing up front: the first
message opens the picker, and the free providers need no key.

The demo is the other `ChatMode`, and not a state anything starts in: it is one
**Play the demo** button under the greeting, which the element projects through
`slot="empty"`. Taking it swaps the element for `DemoAgent`, an island over the
canned turns that streams on mount; the arrow in that header goes back to live.
Neither surface keeps its transcript across the swap.

**One title bar.** The surface heads itself — context meter and new conversation in
the header, model and provider in the composer, next to send — so the page puts no
bar of its own over it. Minimise, back-to-live and the demo launcher are all
`chat-actions.tsx`, preact components the page renders _into_ the surface: as light
DOM under `slot="actions"` and `slot="empty"` for the element, and as the `actions`
prop for the demo island — which needs no launcher of its own. The chat is the only view `AgentChat` has, so the
box never loses its minimise button; the empty slot shows only before the first
message.

The panel hides rather than unmounting, so minimising keeps the transcript;
changing mode does not. Escape minimises it as well, from inside the agent too — a
keyboard event is composed, so it crosses the shadow boundary. The handler skips a
`defaultPrevented` Escape, which is how one keystroke dismisses an open popover
**or** the box, never both: `PopoverContent` calls `preventDefault()` when it closes
on Escape. The docked rail is the exception — it covers nothing, so Escape in its
composer must not take a column of the page away.

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

`vite.config.ts` tells the vue compiler that `agent-chat` is a custom element, else
the template resolves it as a component and warns.

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
nothing in the library injects them. `styles.css` then maps its palette onto the
same names with `@theme inline`, so `bg-page` is `var(--background)` and one
class repoints when `.dark` repoints the token. The page and the widget cannot
drift apart.

Tailwind preflight applies to the page **and** to the preview islands, which the
shadow root spares the widget. A component that forgets a reset can therefore look
right in a card and wrong in the chat. Nothing catches that — the human checks the
widget itself.

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

WIP MV3 side panel. `pnpm build:extension` writes `extension/dist`; load it unpacked.

| File             | What                                                         |
| ---------------- | ------------------------------------------------------------ |
| `manifest.json`  | copied beside the bundle by `vite.config.ts`, never imported |
| `sidepanel.html` | the panel document, which hosts `<agent-chat>`               |
| `panel.ts`       | declares the `tokens`, then `defineAgentChat()` over pi      |
| `background.ts`  | the service worker — opens the panel on the action click     |
| `vite.config.ts` | two inputs, flat `[name].js`, out to `extension/dist`        |

Not built yet: a `PageBridge` over `chrome.scripting.executeScript` against the active
tab (`documentBridge()` reads the panel's own empty document today), and key storage in
`chrome.storage` instead of `localStorage`.

The manifest asks for `sidePanel`, `activeTab`, `scripting` and `storage`. The CSP
blocks third-party requests, which is one reason no component fetches a remote asset.
