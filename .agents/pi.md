# Pi harness

`src/pi/` is the only code allowed to import Pi. `createPiSession()` combines the agent,
provider/model choices, page tools, storage, title, history, and the `ChatSession` adapter.
Keep folder hubs (`providers.ts`, `tools.ts`, `storage.ts`, `chat.ts`) as the cross-group
imports; `src/pi/index.ts` is the public entry.

## Loading and providers

Never import the `pi-ai` root for values. Provider APIs and catalogs stay dynamic subpath
imports so unused SDKs and large catalogs remain separate chunks.

Keyed gateway catalogs load from esm.sh at runtime. `useCatalogSource()` exists for hosts
such as MV3 that forbid remote modules; tests install a local source. Free/local catalogs
are small static files. Catalog loading is lazy and cached per provider.

Provider order is deliberate: Vercel AI Gateway, OpenRouter, On Device (wllama), LLM7,
OVHcloud, Kilo, OpenCode Zen, then Chrome Built-in AI. Do not add single-vendor providers
already covered by a gateway without a product reason.

- Browser calls require provider CORS. Kilo and OpenCode Zen are hidden on ordinary pages
  and enabled in the extension through host permissions.
- Vercel's Anthropic endpoint rejects SDK headers and omits CORS headers on a bad-key 401.
  Preserve `vercelFetch()`: filter to the preflight allow-list, move the key to Bearer
  authorization, and probe `/v1/models` after an opaque failed request to recover status.
- Chrome Prompt and wllama are text-only local APIs. wllama allows one loaded model, is
  unavailable on phones, and needs a host-supplied source under MV3.
- wllama tool-call tags can split across chunks. Preserve its incremental parser and
  provider-shaped call IDs.
- Chrome Prompt and wllama report their one-time download as thinking carrying
  `::progress{…}` markers, which the transcript draws as one bar — see `lib/progress.ts`.
  A destroyed Chrome Prompt session must be closed.

## Tools and approval

The loop has no tools by default. `page: true` enables WebMCP; a host can supply another
`PageTools`. See [`webmcp.md`](webmcp.md).

- Only serializable metadata crosses `PageTools`; the source retains live handles.
- Normalize provider-facing names and resolve collisions with suffixes.
- With Ask enabled, read-only page tools run unasked and mutating page tools ask every
  time. Pi sessions start in Bypass. Untrusted page output warns the model and UI.
- Refresh tools on `toolchange`; a discovery failure means no tools, not a chat error.
- `callTool(name)` is person-initiated: run with `{}` and no approval, append an assistant
  tool call and its result, then continue the model. Even aborts need a result because
  providers reject dangling calls. Drop results if the conversation changed mid-call.
- `beforeToolCall` approval is a parked promise. A denial becomes a denied tool result,
  not a generic error.

## Storage and keys

`PiStorage` is asynchronous. The default is page-lifetime memory; hosts opt into
`browserStorage()` or another store. `PiSession.ready` lets a host avoid displaying empty
choices while storage hydrates. Never let a late storage read overwrite a choice or key
made during hydration.

`browserStorage()` encrypts only `api-key:*` values. AES-GCM uses a non-extractable key in
IndexedDB. This protects copied localStorage/profile data, not scripts already running on
the origin. If WebCrypto or IndexedDB is unavailable, refuse persistent secret writes and
keep the key in memory. The extension uses `chrome.storage.local` directly because page
scripts cannot read it.

Device lock uses WebAuthn PRF plus HKDF and needs a user gesture. Keep ciphertext prefixes
separate:

- `agentak-enc1:`: browser/IndexedDB key
- `agentak-enc2:`: passkey-derived key

`sealed()` must distinguish open, locked, and stale values. A stale value asks for a new
API key; it must not offer an unlock ceremony for a missing credential. Enabling or
disabling device lock re-seals every key currently in session memory. A dismissed unlock
keeps the pending message. WebAuthn is unavailable in the extension origin.

## Conversations

`save()`/`restore()` carry transcript, provider, model, thinking level, and title.
`history: true` stores conversations over the same storage; a host may supply `PiHistory`
instead. A session still opens on a new conversation unless a snapshot is supplied.

- Persist after the loop settles and after title generation. Do not store empty chats.
- Opening/resetting waits for an active turn to become idle.
- Retry rewinds before the user message and sends it again after loading the slice.
- Fork stores the old conversation, opens a new id before the selected message, drops the
  old title, and returns the message to the UI draft.
- History uses an index plus one record per conversation, keeps 20, and evicts oldest
  records until a failed full-store write can be read back successfully.
- Before restoring, cut failed trailing turns and tool calls with no matching result.
- When adding a `PiSnapshot` field, update its type, `PI_SNAPSHOT_FIELDS`, save, restore,
  and round-trip tests. Bump the version only for incompatible shapes.

## Errors and transcript

`describeFailure()` must handle nested provider error bodies and bodiless statuses. Keep
raw errors for identity/dismissal and user-facing descriptions for display. Statuses 401,
402, 403, and 404 open settings; rate limits, timeouts, context exhaustion, network errors,
and 5xx failures stay in the transcript with retry.

The view is rebuilt from complete Pi state on every event. Message IDs derive from source
indexes and must stay stable while streaming. `agent_end` fires before Pi marks itself
idle, so wait for idle before the final redraw. Cache both agent and session snapshots until
`notify()` invalidates them.

Usage field names differ between Pi and the UI. Keep cache writes folded into cached input
and reasoning priced as output. Conversation compaction is not implemented; `nearLimit`
only warns.
