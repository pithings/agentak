# agentak

Agentak is a standalone Preact chat UI with an optional Pi agent (`agentak/pi`), a Vue
playground, and a Chrome MV3 side panel. This is a pnpm workspace.

## Rules

- Use explicit `.ts`/`.tsx` import extensions. Use relative imports in `src/` and `test/`.
  The `@/` alias is only for `playground/` and `extension/`; it points to `../src`.
- Use Preact, not React. React and Vue are optional host adapters only.
- Write Simplified Technical English. Keep design and comments minimal.
- Do not add or run end-to-end tests. Browser checks are manual.
- Read [`.agents/components.md`](.agents/components.md) before UI work.
- The library has no component stylesheet. Direct component/`AgentChat` users install the
  exported token CSS; `mountChat()` and framework wrappers inject it unless disabled.
- Run package scripts from the repository root. `package.json` is the command authority.

## Architectural invariants

- `ChatSession` is the only seam between the UI and an agent. The root, components, and
  framework entries must not import `@earendil-works/*`; only `agentak/pi` loads Pi.
- A `session` is required. UI wrappers never dispose it; the creator owns disposal.
- React and Vue wrappers own one outer element. Preact alone owns its children.
  `actions` and `emptyActions` are Preact nodes even when the host is React or Vue.
- All dependencies stay external. Lazy Pi provider/catalog/Markdown imports must remain
  lazy for consumer bundlers and MV3.
- The playground and extension compile library source through `@`, not `dist`.

## Focused docs

- [`.agents/components.md`](.agents/components.md): component and layout rules
- [`.agents/session.md`](.agents/session.md): custom harness contract
- [`.agents/pi.md`](.agents/pi.md): providers, tools, storage, history, and failures
- [`.agents/playground.md`](.agents/playground.md): playground and MV3 constraints
- [`.agents/webmcp.md`](.agents/webmcp.md): WebMCP compatibility and trust rules

## Known gaps requiring real-browser checks

No real-browser validation has covered the complete chat or side panel. Before release,
check the Vue host with Tailwind preflight, real provider keys, WebMCP invocation, model
catalog loading, persisted keys, active-tab following, per-site history, badge colors,
`chrome:` tool failures, bundled wllama/OPFS, and WebAuthn PRF device lock. The panel's
wllama worker and device-lock user-gesture flow are the highest-risk paths.

Conversation compaction is not implemented. The context meter only warns with
`shouldCompact()`. The panel currently reads the active tab but cannot navigate or operate
other tabs.
