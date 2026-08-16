# The agent loop

`src/pi/` — pi-agent-core, and everything that feeds the chat. `createAgent()`
builds a pi `Agent`; `createAgentStore()` turns its events into a snapshot; and
`createPiSession()` puts the provider choosing around that and answers `ChatSession`,
which is all the surface asks for. Nothing outside this directory imports pi — see
[`session.md`](session.md) for the seam and how a host replaces this whole directory.

```
prompt -> Agent -> streamFor(model.api) -> streamSimple -> AgentEvent
                -> beforeToolCall -> ApprovalGate -> AgentTool (the host's)
store:   every event -> toViewMessages(agent.state) -> AgentSnapshot
session: AgentSnapshot + providers + models + title -> ChatSnapshot -> Chat
```

| File               | What                                                      |
| ------------------ | --------------------------------------------------------- |
| `create-agent.ts`  | the `Agent`, the stream function, the system prompt       |
| `free-models.ts`   | the hand-written catalogs of the four keyless providers   |
| `approvals.ts`     | the confirmation gate behind `beforeToolCall`             |
| `models.ts`        | catalog filtering, the defaults                           |
| `providers.ts`     | the provider list, the api modules, `streamFor()`         |
| `catalog.ts`       | one provider's models, fetched once per page              |
| `use-catalog.ts`   | the same, as a hook, for a host driving `Chat` itself     |
| `storage.ts`       | the store the keys, provider, model and level live in     |
| `history.ts`       | the conversations a session keeps, over that same store   |
| `transcript.ts`    | `AgentMessage[]` -> renderable parts, and the usage panel |
| `store.ts`         | a subscribable view of `Agent` events                     |
| `errors.ts`        | a failed turn, worded for the person reading it           |
| `use-agent.ts`     | the store as a hook — `ChatState`, unchanged              |
| `session.ts`       | the store, the page and the title as one `ChatSession`    |
| `title.ts`         | the conversation's name — derived, or asked of the model  |
| `on-device.ts`     | Chrome's own model, and whether this browser carries it   |
| `chrome-prompt.ts` | the Prompt API as an api pi can speak                     |

## Imports stay dynamic

pi-ai's index imports every provider catalog and every sdk, so nothing here imports it
for a value. Everything comes from a subpath:

- `providers/<id>.models` — one json per provider, fetched when that provider is
  picked. OpenRouter's alone is 136 KB.
- `api/<name>` — `streamSimple`, fetched with the first turn that needs it. The
  anthropic and openai sdks are ~100 KB each and land in chunks of their own.

Only `free-models.ts` and `on-device.ts` are imported statically — the first in
`models.ts`, so `DEFAULT_MODEL` exists and an agent can be built before any chunk lands,
the second in `providers.ts`, which has to know whether this browser carries Chrome's own
model before it lists a row for it. Both are written by hand and weigh a couple of KB, so
nothing is saved by fetching them.

The pi-ai root is browser-safe — `node:` imports live under its `./node` export, which
nothing here touches. Every api module sets `dangerouslyAllowBrowser`: the key goes
straight from the page to the provider.

## Providers

`providers.ts` is the whole list. A provider is an id, a label, where its key comes
from, a default model, and a `load()` for its catalog. The model carries its own api,
so `streamFor()` picks the module per turn and a gateway model costs no extra code.

| Provider                                 | Api                                |
| ---------------------------------------- | ---------------------------------- |
| Chrome Built-in AI                       | chrome-prompt — on the device      |
| LLM7, Kilo, OVHcloud, OpenCode Zen       | openai-completions — free, no key  |
| Vercel AI Gateway, OpenRouter (gateways) | per model — any of the three below |
| OpenAI                                   | openai-responses                   |
| Groq, Cerebras                           | openai-completions                 |

`SUPPORTED_APIS` is `anthropic-messages`, `chrome-prompt`, `openai-completions` and
`openai-responses`; a catalog entry outside them is filtered out of the settings page.
Adding a provider is an entry plus its `defaultModelId`. `test/pi/providers.test.ts`
loads every catalog and fails if a default no longer exists, or if a listed model needs
an api this build lacks.

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
rather than letting the page take a click that ends in a console error.
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

**One settings page, four sections.** Provider, key, thinking level and model are all
`chat/settings.tsx`, shown where the transcript is — see `components/chat.tsx`. Nothing
else chooses any of them; the header's settings button and the composer's trigger only
open the page.
The four sections are on the screen together, shortest first, so the model list is last
and the page scrolls as one column. A catalog lands in that list, under a spinner. The
providers are a `DropdownMenu` rather than a list of their own: which one is set is one
line, and nine rows above the models would be most of the page.

**Nothing is chosen on a fresh surface** — no provider, and so no model. The first
message opens the settings page instead of going to a provider nobody picked; the text is
held and sent as soon as one can answer. The provider dropdown is open on arrival while
nothing is running — the page asks its question rather than showing a shut box — and
`defaultOpen` is read once, so closing it stays closed. `storedProviderId()` is what a second visit opens
on, so the question is asked once.

Picking a model assigns `agent.state.model` and closes the page: it is the last of the
four choices and the only one nothing follows, so the transcript comes back and the
composer takes the focus — `chat/composer.tsx` watches the flag for that, and leaves the
focus alone on a phone, where it would be a keyboard over half the surface. Sending a
message closes the page too, and so does the back arrow in the header. The model list
carries a search field only past eight models, under which it would filter a list already
in one view.

**Picking a provider is half a choice**, so it closes the dropdown and changes the model
list under it, and the page itself stays up. Nothing picks a model for anyone: `follow()` in `session.ts`
restores only `storedModelId(provider)`, so a provider used before comes back as it was,
and one chosen for the first time waits on the list. Picking a provider that has no key
opens the key section on it, and the provider changes only once the key is saved — so
`providerId` never names a provider that cannot answer, and a stored provider whose key
is gone counts as no provider at all. The dropdown still names the one just clicked, and
the model section says the key is what its models are waiting on: `providerId` is the
harness's rule, not an answer to the click.

**A saved key is a button, not a field.** Nothing reads a key back out of storage, so a
provider already set up shows **Change key** where the field would be — an empty box under
a heading naming a provider that is working reads as a key that is missing. The field, the
link and the note come back on the click, and Save is what closes it again. For a provider already set up, that section stands
under the list with its own key in it, so replacing one takes no step.

### The free four

`free: true` means the endpoint answers an anonymous request: the page takes it on
the click, with no key section in between. They are rate limited by IP address, and
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

### The fifth is not a request at all

**Chrome Built-in AI** is Gemini Nano, running in the browser. Chrome exposes it as the
`LanguageModel` global — the Prompt API — so the turn never leaves the device: no
endpoint, no key, no preflight, and no rate limit to write down. `free: true` for the
same reason as the other four, and every rate is zero because nothing is billed.

`chrome-prompt` is an api of this repo's own, the only entry in `APIS` that is not one
of pi-ai's. It answers `streamSimple` and nothing else, which is all `streamFor()` asks
for, and it is fetched with the first turn like every other api module.

| File               | What                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `on-device.ts`     | the api as typescript sees it, the one model, `promptApiSupported()` |
| `chrome-prompt.ts` | pi's context in, pi's events out                                     |

`on-device.ts` is the second module imported statically, next to `free-models.ts`, and
for the same reason: `providers.ts` has to answer `supported()` before any chunk lands.
It is one model and a handful of interfaces.

**The api is not the shape pi speaks.** It takes the history up front, through
`initialPrompts`, and the turn to answer through one `prompt()` call — so `toTurns()`
splits pi's messages at the last one, merges runs of a role, drops empty turns, and
tells a tool result as the user. A session is built per turn and destroyed after it:
pi's transcript is the conversation, and it can be edited or restored between turns.

**What Gemini Nano does not do**: tool calls, images, thinking, a token ceiling, or a
stop sequence. The loop offers its tools to every model, so a turn that carries them is
answered from the chat alone and says so in `AssistantMessage.diagnostics`. The window
is 9216 tokens shared between input and output, and past it Chrome throws
`QuotaExceededError` rather than truncating — `failure()` words that one as the chat's
own sentence. The usage panel prices a turn at nothing and counts it from
`session.inputUsage` before and after, which is the session's estimate, not a tokenizer.

**Two things gate it.** The api is behind `#optimization-guide-on-device-model` and
`#prompt-api-for-gemini-nano` until Chrome ships it — an extension page gets it without
an origin trial, a site needs one — and the weights are a one-time ~4 GB download that
the first `create()` starts. `promptApiSupported()` is the first gate: `Provider.supported`
keeps the row out of the picker on a browser that carries no `LanguageModel`, which is
every browser but a flagged Chrome, so nothing is offered that cannot answer. The
download is the second, and it is reported as a thinking block — the only channel the
event protocol has for work that is not the answer. Chrome reports it through a monitor
callback, which cannot yield, so the percentage is read on a timer and the block closes
as soon as `create()` settles. The mapping back to the api drops thinking, so the model
never reads its own download log.

## Where the choices go

`storage.ts` names the four things the picker decides — the key per provider, the
provider, the model per provider and the level per model — and holds them in a `PiStorage`,
a store with `get(name)` and `set(name, value)`. The library writes nothing to the browser
on its own: the default is one memory store shared by every session on the page, so a key
typed in one conversation answers in the next and goes when the page goes.

A host that wants more passes the `storage` option: `browserStorage()` for `localStorage`,
as the playground and the panel do, or a store of its own. Both methods are synchronous,
so an async store such as `chrome.storage` is read by the host and passed through `apiKey`
instead. `remove` is a third method and an optional one: a store without it drops a value
by writing it empty, which reads back as nothing.

The thinking level is the one choice with a default worth naming. A model runs at the level
the conversation was written at, then the level this browser last used it at, then the last
level chosen by hand in this session — and where nothing answers, at `medium`, clamped to
what the model offers. A model that is chosen to reason reasons, so a level is only `off`
where somebody said `off`, and a model with no reasoning clamps to `off` on its own.

A key also comes back out: `forgetKey(provider)` on the session drops it from the store and
from the session's own map — including one a host passed through `apiKey`, which that host
still holds and hands to the next session. The provider then has no key, so it is one to
set up again, and a session running on it steps off rather than failing the next turn.

## Storing a conversation

`snapshot.ts`, and two members of `PiSession`: `save()` hands the conversation over, and
the `snapshot` option opens on one. Where it is kept is the host's — `localStorage` in the
playground, `chrome.storage` in a panel, a server for a host with accounts.

```ts
const session = createPiSession({ snapshot: readPiSnapshot(JSON.parse(stored)) });
session.subscribe(() => keep(session.save())); // debounced by whoever stores it
```

It sits beside `dispose()` for the same reason: nothing in the surface calls it, so it is
what this factory owes its caller, not what the chat asks of a harness. `restore()` is its
other half: the transcript and the choices it ran under, put back into the session that is
already mounted — the loop's messages, the provider, the model and the level, all replaced
in place. That is what a host needs to move between conversations without swapping a
session, and it is what the history page below runs on.

**A swap waits for the turn it interrupts.** `store.ts` grew `load()` for this: pi refuses
to reset while a run is active and `abort()` only asks, so a swap over a streaming answer
lands on `waitForIdle()` and an idle one — every swap a person makes — lands at once.

## The conversations a session keeps

`history: true` on `createPiSession()`, and the chat grows a history page: the clock at the
head of the header, listing what this session has stored, with the live one marked. Picking
one is `restore()` under the covers, so the chat never unmounts. `history.ts` is the store
behind it, over the same `PiStorage` as the keys — memory by default, `localStorage` where
a host passed `browserStorage()`, or a `PiHistory` of the host's own where neither will do.

Off by default: the library stores nothing unasked, and a host already keeping its own with
`save()` should grow no second list. Turned on:

- The session opens on the **newest stored conversation**, so a reload comes back where it
  was left. A `snapshot` option wins over that — a host that hands one over keeps its own.
- A conversation is written **every time the loop settles**, and again when the model names
  it, so nothing is debounced and nothing is flushed on `pagehide`. `dispose()` writes the
  last one in hand.
- **New conversation** files the one it replaces away rather than dropping it; an empty
  conversation is never written, so nothing lists a chat that was never spoken to.
- Forgetting the live conversation leaves an empty chat on a new id.

Two keys, not one: an index of what exists, and one entry per conversation. The page reads
the index alone, so listing never parses a transcript, and one is dropped by its own key
rather than by rewriting the rest. Twenty are kept; past that the oldest goes. `set` reports
nothing — `localStorage` throws when it is full and `browserStorage()` swallows it — so a
write is read back, and one that will not fit gives up older conversations until it lands.

[`session.md`](session.md) is the other half: `history`, `conversationId` and
`openConversation` are the seam the page runs on, and a harness that stores nothing reports
no list, so the button is not there.

**More than the transcript travels.** A transcript alone comes back under whatever model
was used last rather than the one that wrote the answers, so `PiSnapshot` carries
the provider, the model, the thinking level and the generated title as well. Those beat the
defaults in `storage.ts`, which stay what a _new_ conversation opens on. They
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

**A 4xx opens the settings page.** `failureStatus()` reads the status back out of the same
message, and `store.ts` carries it beside the worded one as `errorStatus`. A turn that
failed with one is the provider answering about the key, the model or the account — none of
which the transcript can fix — so `session.ts` opens the page where all three are chosen,
with the error row still above the composer. Once per failure: the page is the person's to
close again, and only a new error opens it a second time. A 5xx, and a request that never
arrived, are the provider's own to recover from, so those only say so and offer the retry
button.

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

`model-selector` had a source and lost it: the settings page picks a model from a plain
list under a `DropdownMenu`, so the palette and `chat/picker.tsx` that framed it are
parked together with `ui/command.tsx`, which nothing else reaches.

None of them are registered in `ELEMENTS`. A renderer listed there is in every host's
chat bundle whether or not anything emits it, so registration follows the source, not
the port. Register the renderer with the tool that emits it.

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
