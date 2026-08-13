# The agent loop

`src/pi/` — pi-agent-core, and everything that feeds the chat. `createAgent()`
builds a pi `Agent`; `createAgentStore()` turns its events into a snapshot; and
`createPiSession()` puts the provider picker around that and answers `ChatSession`,
which is all the surface asks for. Nothing outside this directory imports pi — see
[`session.md`](session.md) for the seam and how a host replaces this whole directory.

```
prompt -> Agent -> streamFor(model.api) -> streamSimple -> AgentEvent
                -> beforeToolCall -> ApprovalGate -> AgentTool (the host's)
store:   every event -> toViewMessages(agent.state) -> AgentSnapshot
session: AgentSnapshot + providers + models + title -> ChatSnapshot -> Chat
```

| File              | What                                                      |
| ----------------- | --------------------------------------------------------- |
| `create-agent.ts` | the `Agent`, the stream function, the system prompt       |
| `free-models.ts`  | the hand-written catalogs of the four keyless providers   |
| `approvals.ts`    | the confirmation gate behind `beforeToolCall`             |
| `models.ts`       | catalog filtering, the defaults                           |
| `providers.ts`    | the provider list, the api modules, `streamFor()`         |
| `catalog.ts`      | one provider's models, fetched once per page              |
| `use-catalog.ts`  | the same, as a hook, for a host driving `Chat` itself     |
| `storage.ts`      | `localStorage` for the keys, the provider and the model   |
| `transcript.ts`   | `AgentMessage[]` -> renderable parts, and the usage panel |
| `store.ts`        | a subscribable view of `Agent` events                     |
| `errors.ts`       | a failed turn, worded for the person reading it           |
| `use-agent.ts`    | the store as a hook — `ChatState`, unchanged              |
| `session.ts`      | the store, the picker and the title as one `ChatSession`  |
| `title.ts`        | the conversation's name — derived, or asked of the model  |

## Imports stay dynamic

pi-ai's index imports every provider catalog and every sdk, so nothing here imports it
for a value. Everything comes from a subpath:

- `providers/<id>.models` — one json per provider, fetched when that provider is
  picked. OpenRouter's alone is 136 KB.
- `api/<name>` — `streamSimple`, fetched with the first turn that needs it. The
  anthropic and openai sdks are ~100 KB each and land in chunks of their own.

Only `free-models.ts` is imported statically, in `models.ts`, so `DEFAULT_MODEL` exists
and an agent can be built before any chunk lands. It is written by hand and weighs a
couple of KB, so nothing is saved by fetching it.

The pi-ai root is browser-safe — `node:` imports live under its `./node` export, which
nothing here touches. Every api module sets `dangerouslyAllowBrowser`: the key goes
straight from the page to the provider.

## Providers

`providers.ts` is the whole list. A provider is an id, a label, where its key comes
from, a default model, and a `load()` for its catalog. The model carries its own api,
so `streamFor()` picks the module per turn and a gateway model costs no extra code.

| Provider                                 | Api                                |
| ---------------------------------------- | ---------------------------------- |
| LLM7, Kilo, OVHcloud, OpenCode Zen       | openai-completions — free, no key  |
| Vercel AI Gateway, OpenRouter (gateways) | per model — any of the three below |
| OpenAI                                   | openai-responses                   |
| Groq, Cerebras                           | openai-completions                 |

`SUPPORTED_APIS` is `anthropic-messages`, `openai-completions`, `openai-responses`; a
catalog entry outside them is filtered out of the picker. Adding a provider is an entry
plus its `defaultModelId`. `test/pi/providers.test.ts` loads every catalog and fails
if a default no longer exists, or if a listed model needs an api this build lacks.

Left out on purpose: providers that need an account id in the url (Cloudflare), an
OAuth flow (Copilot, Codex), signed requests (Bedrock, Vertex), or another sdk for one
provider each (Google, Mistral).

### CORS decides who is listed

The loop calls the provider straight from the browser, so a provider must answer the
preflight the `Authorization` header forces. `Access-Control-Allow-Origin` is the
server's to send: a provider that sends none cannot be reached from a page, and no
request header changes that.

Seven of the nine send it. `cors: false` names the two that do not — **Kilo Gateway**
and **OpenCode Zen** — and `availableProviders()` drops them from what a page offers,
rather than letting the picker take a click that ends in a console error.
`createPiSession()` reads that list for its rows _and_ for the provider it opens on, so
one stored in the panel is not restored on a page.

`corsFree()` is the exception, and the whole of the runtime check: a
`chrome-extension:` document fetches through `host_permissions`, which the preflight
never gates, so the panel lists all nine. Both blocked origins are in
`extension/manifest.json`. The panel served by vite in dev is an ordinary page, so it
sees the seven — load it unpacked to get the other two.

A provider that starts to send the header is a `cors: false` line to delete. Check it
with a preflight of your own:

```sh
curl -sI -X OPTIONS https://opencode.ai/zen/v1/chat/completions \
  -H 'Origin: http://localhost:4050' -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

A consumer embedding the chat in their own page is in the same position as the
playground: the seven, unless they proxy the rest themselves.

A key is stored per provider, so switching back to one already set up asks nothing.
`getApiKey(provider)` is how pi asks for the right one.

**One picker, three levels.** Provider, model and key are all `chat/picker.tsx`, the
`model-selector` in the composer. Nothing else chooses any of them: there is no key
screen and no provider screen, and the chat is the only view the surface has. A catalog
lands in the panel's own list, under a spinner, rather than in a view that would close
the panel it landed for.

**Nothing is chosen on a fresh surface** — no provider, and so no model. The first
message opens the panel instead of going to a provider nobody picked; the text is held
and sent as soon as one can answer. `storedProviderId()` is what a second visit opens
on, so the question is asked once.

The panel opens on the models of the chosen provider, with a strip under the search
input that goes back to the providers — outside the list, so the filter cannot hide the
way back; backspace on an empty field does the same. Picking a model assigns
`agent.state.model` and closes.

**On a phone the list goes above the field**, by `order` alone — the DOM keeps the
field first, so the focus the popover gives out and the tab order are unchanged. The
panel is bottom-anchored, growing up from a trigger in the composer, so anything that
takes room off the top moves every row down but the last: a keyboard opening, or the
composer dropping back when one closes. With the field first, it moved out from under
the finger that was tapping it, the tap landed on the row that took its place, and
nothing was focused. Last, it cannot move — the list gives the height up — and it sits
against the keyboard, where a field being typed into belongs. The field takes the focus
on open there as well as on a desktop: a panel you cannot type in until you find the
field and tap it is worse than one that costs a keyboard, and the keyboard's room is
handled by the cap rather than by leaving the field cold.

**Picking a provider is half a choice**, so it goes on to that provider's models
instead of closing. Nothing picks a model for anyone: `follow()` in `session.ts` restores
only `storedModelId(provider)`, so a provider used before comes back as it was, and one
chosen for the first time waits on the list. Picking a provider that has no key opens
the key level first, and the provider changes only once the key is saved — so
`providerId` never names a provider that cannot answer, and a stored provider whose key
is gone counts as no provider at all. The **Key** button on the strip reopens that level
for a provider already set up.

### The free four

`free: true` means the endpoint answers an anonymous request: the picker takes it on
the click, with no key level in between. They are rate limited by IP address, and
`Provider.note` says how much.

pi-ai carries no catalog for them, so `free-models.ts` writes one each: only chat models
that stream and take tools, priced at zero. Two shapes of "no key":

| Provider     | Endpoint                                           | Auth                       |
| ------------ | -------------------------------------------------- | -------------------------- |
| LLM7         | `https://api.llm7.io/v1`                           | `Bearer unused`            |
| Kilo Gateway | `https://api.kilo.ai/api/gateway`                  | `Bearer unused`            |
| OVHcloud     | `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1` | no header — a token is 403 |
| OpenCode Zen | `https://opencode.ai/zen/v1`                       | no header — a token is 401 |

`createAgent()` hands pi the string `unused` when a free provider has no key of its
own. The other two get `Authorization: null` on every model, which is how the openai
client is told to drop a header it always sets.

Their paid models are not listed: LLM7 and Zen answer `invalid_api_key` for those, so
only the free tier is written down. Free tiers rotate — a model that starts to 404 is
a line to delete.

## Storing a conversation

`snapshot.ts`, and two members of `PiSession`: `save()` hands the conversation over, and
the `snapshot` option opens on one. Where it is kept is the host's — `localStorage` in the
playground, `chrome.storage` in a panel, a server for a host with accounts.

```ts
const session = createPiSession({ snapshot: readPiSnapshot(JSON.parse(stored)) });
session.subscribe(() => keep(session.save())); // debounced by whoever stores it
```

It sits beside `dispose()` for the same reason: nothing in the surface calls it, so it is
what this factory owes its caller, not what the chat asks of a harness.
[`session.md`](session.md) is the other half — `ChatSession` holds one live conversation
and never lists them, so a host switches conversations by switching sessions.

**More than the transcript travels.** A transcript alone comes back under whatever model
this browser used last rather than the one that wrote the answers, so `PiSnapshot` carries
the provider, the model, the thinking level and the generated title as well. Those beat the
per-browser defaults in `storage.ts`, which stay what a _new_ conversation opens on. They
land at different moments — the model waits for its provider's catalog, the level for the
model — so `opening` holds them until then and is spent once: a pick after that is the
visitor's, and must not be overruled by the file it came from.

**A stored transcript is cut before the loop sees it.** `usablePiMessages()` cuts at the
first tool call nothing answered — a page closes wherever it closes, and every provider
expects a result in the message after the call, so the request is rejected before the model
reads a word of it. Approvals do not come back either, which is the same cut. Any failed
turn left at the end goes too, exactly as `retry()` drops one.

**One field, three places.** Adding to `PiSnapshot` means the type, `PI_SNAPSHOT_FIELDS`
and wherever it lands in `session.ts`. Two of the three are checked: the field list fails to
compile if it misses a key, and `save()` builds a `WholePiSnapshot`, which is the snapshot
with nothing left out. The third is checked at runtime — `test/pi/snapshot.test.ts` walks
`PI_SNAPSHOT_FIELDS` over a round trip, so a field that is saved and restored nowhere fails
there. `PI_SNAPSHOT_VERSION` is for a shape that can no longer be restored, not for a field
added: `readPiSnapshot()` drops a stored snapshot of another version, keeps the fields it
knows, and answers `undefined` for anything else — which is a new conversation, not an
error.

## When a turn fails

A provider that refuses a request often sends an empty body with it, and the sdk then has
only the status line to report: `429 status code (no body)`. `describeFailure()` in
`errors.ts` says what that status means instead — rate limited, key refused, out of credit,
provider down — and does the same for a request that never got an answer at all. A response
that carries a message passes through word for word, because the provider says more than
any rule here can.

Both places that show a failure run through it: `store.ts` for the error row above the
composer, and `transcript.ts` for the failed turn left in the transcript. `clearError()`
still compares the raw message, so dismissing works on what pi holds rather than on what is
displayed.

## What feeds each element

| Element                             | Source                                                             |
| ----------------------------------- | ------------------------------------------------------------------ |
| `conversation`, `message`, markdown | `user` / `assistant` text content                                  |
| `reasoning`                         | `thinking` blocks; `redacted` renders a note instead               |
| `tool`                              | `toolCall` + `tool_execution_*` + the `toolResult` that answers it |
| `code-block`                        | tool output, and markdown fences                                   |
| `confirmation`                      | `beforeToolCall`, parked on a promise the buttons resolve          |
| `queue`                             | `agent.steer()` — a message typed mid-turn                         |
| `context`                           | `usage` of the last turn, cost summed over all of them             |
| `model-selector`                    | providers, then the chosen one's catalog — see Providers           |
| `agent`                             | the system prompt and `agent.state.tools`, in the empty state      |
| `image`                             | `ImageContent` in a user message or a tool result                  |
| `shimmer`                           | streaming, before the first block of the turn arrives              |
| `checkpoint`                        | `compactionSummary` / `branchSummary` messages                     |

The other ported elements have no source in pi: `plan`, `task` and `chain-of-thought`
need a todo tool, `sources` and `inline-citation` a search tool, `file-tree` a listing
tool, and `commit`, `test-results`, `stack-trace`, `package-info` and
`environment-variables` a shell. `schema-display` is shaped like an HTTP endpoint, so a
tool schema is a costume on it, and `AgentTool` already prints the schema. Write the
tool first; the element is waiting.

## Notes

- **The view is rebuilt, never accumulated.** Every pi event carries the whole message,
  so `toViewMessages()` reads `agent.state` from the start each time. Ids come from the
  index, so a growing message keeps its identity. `streamingMessage` stays separate
  from `messages` until `message_end`, so it is appended, not merged.
- **A run is still streaming inside its own `agent_end` listener.** It settles after
  every listener returns, so `store.ts` waits on `waitForIdle()` for the last
  redraw. Without it the composer keeps its stop button forever.
- **The gate is a promise, not a flag.** `beforeToolCall` parks the call until the UI
  answers; a denial returns `{ block: true }` and pi writes an error tool result, which
  the transcript shows as `denied` rather than `error`. The default policy asks once
  per tool and remembers an allow for the session.
- **A queued message cannot be removed one at a time.** pi drains its steering queue as
  a whole, so `dequeue()` clears it and re-queues the rest. An item leaves the list when
  the matching user message appears in the transcript.
- **Usage names differ.** pi counts `input`/`output`/`cacheRead`/`cacheWrite`; the panel
  wants `inputTokens`/`cachedInputTokens`. Cache writes fold into the cache row, and
  reasoning tokens carry no cost of their own because pi prices them as output.
- **Build the runtime once.** `createAgent()` inside a render makes a new, empty
  agent every time. `createPiSession()` is called once, outside the tree, and holds it.
- **The snapshot is cached until the next event.** The agent mutates its own arrays, so
  identity is the only change signal a renderer has: `store.ts` and `session.ts` both
  drop their cached snapshot in `notify()` and rebuild on the next read. A fresh object
  per read would redraw the whole transcript on every render.
