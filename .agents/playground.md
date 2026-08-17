# Playground and extension

Both packages alias `@` to `../src`, so they test library source rather than `dist`.
Both intentionally disable React aliases.

## Playground

The playground is a Vue/Tailwind host containing Preact islands. Vue owns each empty host
element; Preact owns its children. The live chat uses the Vue wrapper and creates/disposes
its own Pi session. There is no shadow root, so Tailwind preflight reaching the chat is an
intentional integration test.

Non-obvious behavior:

- The page installs `tokens` once and passes `tokens={false}` to the wrapper.
- Preact `actions`/`emptyActions` passed through Vue are stable `h()` nodes; recreating them
  redraws the island.
- Desktop uses a docked rail, medium screens a floating box, and phones a fixed full-screen
  sheet. Resize the same mounted session; do not create one per layout.
- The phone sheet stays layout-viewport sized while the chat foot handles the visual
  keyboard. Lock document scrolling behind it.
- Escape closes an inner popover before it can minimize the floating chat. A docked rail
  does not minimize on Escape.
- The README is rendered with md4x and rangi at build time. Runtime chat Markdown remains a
  separate lazy bundle.
- A component port is incomplete until it has realistic playground fixture data. Keep
  demo-only state/adapters outside shipped components when possible.
- The playground has no browser tests. `pnpm vitest run` covers only the library.

## MV3 extension

The side panel mounts only after `PiSession.ready`. It uses `chrome.storage.local`, bundled
catalogs, bundled wllama, and a `PageTools` bridge to the active tab.

### Active-tab invariants

- `read_active_tab` returns rendered text, title, and URL. It is read-only and untrusted.
  Omit it when the page publishes its own recognized reader.
- WebMCP discovery/execution runs in the tab's MAIN world. The DOM reader runs in the
  isolated world. Live tool handles never cross messages.
- The manifest needs all HTTP origins, not `activeTab`, because a side panel follows tabs
  after the toolbar click.
- Pass the active tab URL as `linkBase`, and update tools, links, and history on tab changes
  and navigation.
- The badge counts only page-published WebMCP tools, per tab. Do not count
  `read_active_tab`. Register worker listeners at top level because MV3 workers restart.

### History and storage

Keys and model choices are extension-global. Conversations are partitioned per site by a
storage key prefix, with a shared fallback shelf for pages without an origin. Bind each
conversation to its original site on first write so navigation during an answer cannot
file it under the destination. Only the latest asynchronous tab-follow operation may win.

### MV3 build constraints

- Remote module imports are forbidden. `catalogs.ts` supplies literal lazy imports for
  keyed provider catalogs.
- The manifest CSP must include `wasm-unsafe-eval` for md4x and wllama. Typebox's expected
  unsafe-eval warning still falls back safely.
- wllama normally creates blob workers, which MV3 forbids. `extension/wllama/build.ts`
  writes self-hosted workers/wasm and transforms worker creation. The worker passes
  `RUN_OPTIONS` through its URL. Keep build assertions strict and the patched dependency
  version pinned.
- The panel follows system color scheme before first render. System colors override only
  background, foreground, and muted foreground because Chrome exposes no side-panel theme.
- The panel requests autofocus repeatedly for up to one second because Chrome grants the
  panel document focus after mount.
- `pnpm build:extension` also creates a deterministic zip for the docs site.

## Manual checks

Load `extension/dist` unpacked. Verify bundled catalogs, key persistence, active-tab
following, WebMCP and `read_active_tab`, `chrome:` failures, per-site history during
navigation/streaming, badge updates and contrast, panel links, autofocus, and theme.
For wllama, use the smallest model and verify worker startup, first download, OPFS reuse,
and tool-call parsing. For device lock, use the localhost playground and verify PRF
capability, lock/unlock gestures, reload behavior, cancellation, and re-sealing.
