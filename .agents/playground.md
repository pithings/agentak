# Playground and extension

Two sub-packages that host the library. Both alias `@` to `../src` in their vite and
vitest configs, so they run against the **source**: the page is where the library is
worked on, and the panel is where the element is hosted. The `web-agent` dependency in
each `package.json` is the honest declaration of that; nothing resolves through it.

Both set `reactAliasesEnabled: false`, as the root does.

## playground/ — `@web-agent/playground`

`pnpm dev` serves it on `:4050`. Catalog on the left, chat on the right.

| File                | What                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `main.tsx`          | renders `Playground` into `#root`                                     |
| `playground.tsx`    | the two-pane layout; declares the `tokens` in a `<style>`             |
| `catalog.tsx`       | every component, rendered with fixture data                           |
| `demo-chat.ts`      | the canned turns and the catalog fixtures; `autoStart` streams them   |
| `demo-agent.tsx`    | `AgentChat` over the canned turns — no loop, no key                   |
| `demo-elements.tsx` | the demo renderers, registered into the element registry              |
| `demo-*.tsx`        | data-driven wrappers, so the demo drives compound elements from props |
| `css.ts`            | a `css` tagged template — playground-only rules                       |

The page declares the `--wa-*` tokens itself, the way a host page must. Its own rules
carry a `pg-` prefix and ship nowhere; they exist for what has no inline form —
`@media`, and `:has()`.

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
library's own `test/` is the `lib` project. Two of them are cross-cutting:

- `render.test.tsx` — renders every element from the demo fixtures, and asserts every
  element name in `demo-chat.ts` resolves in the registry.
- `styles.test.tsx` — box-sizing over the whole catalog and the chat. See
  [components/styling.md](components/styling.md).

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
