# Playground and extension

Two sub-packages that host the library. Both alias `@` to `../src` in their vite and
vitest configs, so they run against the **source**: the page is where the library is
worked on, and the panel is where the element is hosted. The `web-agent` dependency in
each `package.json` is the honest declaration of that; nothing resolves through it.

Both set `reactAliasesEnabled: false`, as the root does.

## playground/ — `@web-agent/playground`

`pnpm dev` serves it on `:4050`. A vue SPA in tailwind — a host app, not a shell
around the library: a topbar, a sidebar that browses every component, a catalog
grid, and the chatbox in the corner. It is the closest thing the repo has to the
page a consumer would drop the element into.

| File                | What                                                                    |
| ------------------- | ----------------------------------------------------------------------- |
| `main.ts`           | declares the `tokens` in a `<style>`, then mounts the app on `#app`     |
| `app.vue`           | the shell: topbar, sidebar, `<RouterView>`, chatbox                     |
| `router.ts`         | `/` the catalog, `/c/:name` one component                               |
| `styles.css`        | `@import "tailwindcss"`, and the `@theme` that reads the `--wa-*` names |
| `theme.ts`          | `.dark` on the root — the whole theme switch, page and widget           |
| `chat-store.ts`     | the widget state the topbar and the catalog both reach for              |
| `components/*.vue`  | topbar, sidebar, chatbox, preview card, and the preact bridge           |
| `views/*.vue`       | the catalog grid, and the single-component page                         |
| `catalog.tsx`       | every component with fixture data, plus the lookups the routes use      |
| `demo-chat.ts`      | the canned turns and the catalog fixtures; `autoStart` streams them     |
| `demo-agent.tsx`    | `AgentChat` over the canned turns — no loop, no key                     |
| `demo-elements.tsx` | the demo renderers, registered into the element registry                |
| `demo-*.tsx`        | data-driven wrappers, so the demo drives compound elements from props   |

### Two frameworks, one page

The page is vue; every component in the library is preact. They meet in
`components/preact-host.vue` — one div that vue renders empty and preact fills, so
neither patches the other's nodes. A catalog preview is one such island; the demo
chat is another.

The chatbox is not an island. It opens with the page, on a chooser — the third
`ChatMode`, and the state it starts in, so neither surface runs until it is asked
for and a visitor never lands on the key gate.

Live mode writes `<web-agent>`, the custom element, so the agent runs behind a
shadow root: none of the page's tailwind reaches in, and nothing of the agent
reaches out. Only the `--wa-*` tokens cross, because a custom property inherits.
That makes the widget the real host-page integration, and the one place to check
the element before the extension ships it. Demo mode mounts `DemoAgent` as an
island instead, and `Switch` in the header goes back to the chooser.

The panel hides with `v-show` rather than unmounting, so minimising keeps the
transcript; changing mode does not. Escape minimises it as well, from inside the
agent too — a keyboard event is composed, so it crosses the shadow boundary. The
handler skips a `defaultPrevented` Escape, which is how one keystroke dismisses an
open popover **or** the box, never both: `PopoverContent` calls `preventDefault()`
when it closes on Escape.

The launcher and the panel share the bottom-right corner — the button is the one
element in flow, the panel is absolute over it, and both scale from that corner —
so the bubble grows into the box and shrinks back out of it. The launcher is gone
while the box is up, and the header chevron is what minimises it. Both transitions
carry `motion-reduce:transition-none`.

`vite.config.ts` tells the vue compiler that `web-agent` is a custom element, else
the template resolves it as a component and warns.

### Tokens and the tailwind theme

`main.ts` puts `tokens` in a `<style>` on the document, the way a host page must —
nothing in the library injects them. `styles.css` then maps its palette onto the
same names with `@theme inline`, so `bg-page` is `var(--wa-background)` and one
class repoints when `.dark` repoints the token. The page and the widget cannot
drift apart.

Tailwind preflight applies to the page **and** to the preview islands, which the
shadow root spares the widget. A component that forgets a reset can therefore look
right in a card and wrong in the chat; `styles.test.tsx` is what catches the one
case that matters, and the human checks the widget itself.

### Adding an element to the demo

A port is not done until a human can see it in a browser.

1. Register the renderer in `DEMO_ELEMENTS` in `demo-elements.tsx`. `ELEMENTS` in
   `src/components/elements.tsx` is for the names the loop itself emits.
2. Add a canned reply in `demo-chat.ts` that renders it with realistic fixture data.
   The transcript carries it as a `{ kind: "element", name, props }` part, which
   `agent-chat.tsx` looks up in the registry — so a new element needs no change to the
   `ViewPart` union and no branch of its own.
3. Interactive components get static props and no-op callbacks; the demo store holds no
   state for them. A compound element gets a `demo-*.tsx` wrapper, so the demo shape
   stays out of the shipped component.

### Tests

`playground/test/` is the `playground` project of the root `pnpm vitest run`; the
library's own `test/` is the `lib` project. Three of them are cross-cutting:

- `render.test.tsx` — renders every element from the demo fixtures, and asserts every
  element name in `demo-chat.ts` resolves in the registry.
- `styles.test.tsx` — box-sizing over every fixture and the chat. See
  [components/styling.md](components/styling.md).
- `app.test.ts` — mounts the vue page over a memory router: the sidebar lists every
  entry, the `?q=` filter narrows both panes, a component page pages to its
  neighbours, and the launcher opens the chatbox. It opens the box in demo mode —
  live would start the loop.

`entries.tsx` is the shared fixture: every catalog entry rendered at once, without
the vue chrome, for the two preact tests above.

`pnpm typecheck` runs `vue-tsc` for this package, so `.vue` scripts are checked too.
vue-tsc cannot load typescript 7, so the package pins typescript 5.9 for itself; the
library and the extension stay on the root's 7.

## extension/ — `@web-agent/extension`

WIP MV3 side panel. `pnpm build:extension` writes `extension/dist`; load it unpacked.

| File             | What                                                         |
| ---------------- | ------------------------------------------------------------ |
| `manifest.json`  | copied beside the bundle by `vite.config.ts`, never imported |
| `sidepanel.html` | the panel document, which hosts `<web-agent>`                |
| `panel.ts`       | declares the `tokens`, then `defineWebAgent()`               |
| `background.ts`  | the service worker — opens the panel on the action click     |
| `vite.config.ts` | two inputs, flat `[name].js`, out to `extension/dist`        |

Not built yet: a `PageBridge` over `chrome.scripting.executeScript` against the active
tab (`documentBridge()` reads the panel's own empty document today), and key storage in
`chrome.storage` instead of `localStorage`.

The manifest asks for `sidePanel`, `activeTab`, `scripting` and `storage`. The CSP
blocks third-party requests, which is one reason no component fetches a remote asset.
