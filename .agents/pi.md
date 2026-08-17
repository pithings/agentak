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
| `webmcp.ts`        | `document.modelContext`, and the tools a page offers      |
| `page-tools.ts`    | those tools as pi's, named, gated and kept level          |
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
| `local.ts`         | the wllama models, where the module comes from, the gate  |
| `wllama.ts`        | llama.cpp in this tab as an api pi can speak              |

## Imports stay dynamic

pi-ai's index imports every provider catalog and every sdk, so nothing here imports it
for a value. Everything comes from a subpath:

- `providers/<id>.models` — one json per provider, fetched when that provider is
  picked. OpenRouter's alone is 136 KB.
- `api/<name>` — `streamSimple`, fetched with the first turn that needs it. The
  anthropic and openai sdks are ~100 KB each and land in chunks of their own.

wllama goes one further: it is not a dependency of this package at all, so `local.ts`
imports a CDN url at runtime. See **The local one runs llama.cpp here** below.

### The catalogs come from esm.sh

pi-ai regenerates its json every release, so a copy a build carries only ages: a model
published after `pnpm install` is a model the picker does not list. `catalog()` in
`providers.ts` reads the newest published one instead —
`https://esm.sh/@earendil-works/pi-ai@latest/providers/<id>.models`, a url and not a
package, so no bundler follows it and none of it ships. `PI_AI_VERSION` is the one place
to write a version and pin it. The export is named from the module — `<id>.models` exports
`<ID>_MODELS` — and a module that carries none throws, which the settings page shows and
its retry runs again.

This is the whole of the keyed providers' loading. There is no bundled copy behind it, so
the catalog chunks a build used to carry — 200 KB over the two gateways, OpenRouter's
136 KB of it — are gone from `playground/dist` and `extension/dist` alike, and `dist/`
names the subpath nowhere.

The cost is that a runtime with no network, or one whose policy allows no remote module,
has no catalog at all. `useCatalogSource()` is the seam for both: a host passes its own
import and pins the models it ships, the way `useWllamaSource()` takes wllama from
somewhere else. The MV3 panel is in that position on both counts: its content security
policy blocks the url, so it passes `extension/catalogs.ts` and ships the catalogs of the
pi-ai it was built against.

`catalog.ts` caches per provider for the life of the page, so this is one request per
provider at most, and only for a provider that is picked. Node imports no url, so
`test/setup.ts` installs the installed pi-ai as the source and the tests reach no network.

Only `free-models.ts`, `on-device.ts` and `local.ts` are imported statically — the first
in `models.ts`, so `DEFAULT_MODEL` exists and an agent can be built before any chunk lands,
the second and third in `providers.ts`, which has to know whether this browser carries
Chrome's own model, and whether it can run one of its own, before it lists a row for
either. All three are written by hand and weigh a couple of KB together, so nothing is
saved by fetching them.

The pi-ai root is browser-safe — `node:` imports live under its `./node` export, which
nothing here touches. Every api module sets `dangerouslyAllowBrowser`: the key goes
straight from the page to the provider.

## Providers

`providers.ts` is the whole list. A provider is an id, a label, where its key comes
from, a default model, and a `load()` for its catalog. The model carries its own api,
so `streamFor()` picks the module per turn and a gateway model costs no extra code.

| Provider                                 | Api                                |
| ---------------------------------------- | ---------------------------------- |
| Vercel AI Gateway, OpenRouter (gateways) | per model — whichever api it names |
| On Device (wllama)                       | wllama — on the device             |
| LLM7, OVHcloud, Kilo, OpenCode Zen       | openai-completions — free, no key  |
| Chrome Built-in AI                       | chrome-prompt — on the device      |

That is the picker's order too, and it is deliberate: a key reaches every vendor's newest
model, so the two gateways lead, and the six that ask for none follow. Inside the free
group the device's own comes first, then the two a page can reach, then the two only the
extension can, and Chrome's own last — a 4 GB download that answers text alone.

`SUPPORTED_APIS` is `anthropic-messages`, `chrome-prompt`, `openai-completions`,
`openai-responses` and `wllama`; a catalog entry outside them is filtered out of the
settings page. Today no provider here lists an `openai-responses` model — the gateways
carry `anthropic-messages` and `openai-completions` — but the api stays in the list
because a gateway catalog read at `@latest` may name one tomorrow.
Adding a provider is an entry plus its `defaultModelId`. `test/pi/providers.test.ts`
loads every catalog and fails if a default no longer exists, or if a listed model needs
an api this build lacks.

Left out on purpose: the single-vendor providers a gateway already covers (OpenAI, Groq,
Cerebras — one key each for one vendor's models, where OpenRouter's key reaches all of
them), providers that need an account id in the url (Cloudflare), an OAuth flow (Copilot,
Codex), signed requests (Bedrock, Vertex), or another sdk for one provider each (Google,
Mistral).

### CORS decides who is listed

The loop calls the provider straight from the browser, so a provider must answer the
preflight the `Authorization` header forces. `Access-Control-Allow-Origin` is the
server's to send: a provider that sends none cannot be reached from a page, and no
request header changes that.

Four of the six that answer over the network send it. `cors: false` names the two that
do not — **Kilo Gateway** and **OpenCode Zen** — and `availableProviders()` drops them
from what a page offers, rather than letting the page take a click that ends in a console
error. `createPiSession()` reads that list for its rows _and_ for the provider it opens
on, so one stored in the panel is not restored on a page.

`corsFree()` is the exception, and the whole of the runtime check: a
`chrome-extension:` document fetches through `host_permissions`, which the preflight
never gates, so the panel lists all six. Both blocked origins are in
`extension/manifest.json`. The panel served by vite in dev is an ordinary page, so it
sees the four — load it unpacked to get the other two. The local row is there as well:
the panel ships wllama rather than importing it, which is what `wllamaSupported()` reads.
See [`../.agents/playground.md`](playground.md).

A provider that starts to send the header is a `cors: false` line to delete. Check it
with a preflight of your own:

```sh
curl -sI -X OPTIONS https://opencode.ai/zen/v1/chat/completions \
  -H 'Origin: http://localhost:4050' -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

A consumer embedding the chat in their own page is in the same position as the
playground: the four, unless they proxy the rest themselves.

**The origin header is not the only one a preflight refuses.** A provider that answers
one still names which request headers it takes, and **Vercel AI Gateway** takes a short
list: `Content-Type`, `Authorization`, `anthropic-beta`, and its own `ai-*` names. The
anthropic sdk sets four outside it — `x-api-key`, `anthropic-version`,
`anthropic-dangerous-direct-browser-access`, and the `x-stainless-*` telemetry — so every
turn failed with `x-stainless-os is not allowed by Access-Control-Allow-Headers` and no
request left the browser. `Provider.fetch` is where that is put right: `vercelFetch()` in
`pi/providers.ts` keeps only the allowed names, moves the key to `Authorization: Bearer`,
which the gateway takes in place of `x-api-key`, and drops the version header, which it
does not ask for. `streamFor()` hands it to the api module as `options.fetch`; a host that
passes its own fetch keeps it.

The allow list, and not the four names, because the list is the server's own answer and so
the whole of what a page may send — a header a later sdk adds is refused there first.

**The gateway then hides its own 401.** `POST /v1/messages` sends no
`Access-Control-Allow-Origin` with a refused key, though it sends one with a 200 and with
a 400, so a wrong key reaches the page as a network error with no status in it and the
chat could only say the provider was not reached. `GET /v1/models` takes the same key,
answers a bad one with the same 401, and does send the header. `vercelFetch()` asks it
when the turn fails and hands that answer back in its place: pi reads the status, and the
session opens the settings page on a 4xx as it does for any other provider. A stopped turn
and a key the gateway takes are both left to fail as they failed. The key itself comes
from the gateway's own key page — a token from elsewhere on Vercel is one of these 401s.

Read the allow list back with the same preflight, and the two 401s with a bad key:

```sh
curl -sI -X OPTIONS https://ai-gateway.vercel.sh/v1/messages \
  -H 'Origin: http://localhost:4050' -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'

# 401 with the header, then 401 without it. The day both carry it, the fallback
# in `vercelFetch()` is dead code to delete.
curl -sD- -o/dev/null https://ai-gateway.vercel.sh/v1/models \
  -H 'Origin: http://localhost:4050' -H 'Authorization: Bearer vck_bad'
curl -sD- -o/dev/null -X POST https://ai-gateway.vercel.sh/v1/messages \
  -H 'Origin: http://localhost:4050' -H 'Authorization: Bearer vck_bad' \
  -H 'Content-Type: application/json' \
  -d '{"model":"anthropic/claude-sonnet-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}'
```

A key is stored per provider, so switching back to one already set up asks nothing.
`getApiKey(provider)` is how pi asks for the right one.

**One settings page, four sections.** Provider, key, thinking level and model are all
`chat/settings.tsx`, shown where the transcript is — see `components/chat.tsx`. Nothing
else chooses any of them; the header's settings button and the composer's trigger only
open the page.
The four sections are on the screen together, shortest first, so the model list is last
and the page scrolls as one column. A catalog lands in that list, under a spinner. The
providers are a `DropdownMenu` rather than a list of their own: which one is set is one
line, and eight rows above the models would be most of the page.

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
in one view. Where the field is there it takes the focus — on arrival with a provider set,
and again when another provider's catalog lands — so a list that long is read by typing
at it. Not on a phone, for the same reason the composer leaves the focus alone there, and
not while a key is being typed.

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

### Chrome's own is not a request at all

**Chrome Built-in AI** is Gemini Nano, running in the browser. Chrome exposes it as the
`LanguageModel` global — the Prompt API — so the turn never leaves the device: no
endpoint, no key, no preflight, and no rate limit to write down. `free: true` for the
same reason as the other four, and every rate is zero because nothing is billed.

`chrome-prompt` is an api of this repo's own — one of the two entries in `APIS` that is
not pi-ai's, `wllama` being the other. It answers `streamSimple` and nothing else, which
is all `streamFor()` asks for, and it is fetched with the first turn like every other api
module.

| File               | What                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `on-device.ts`     | the api as typescript sees it, the one model, `promptApiSupported()` |
| `chrome-prompt.ts` | pi's context in, pi's events out                                     |

`on-device.ts` is imported statically, next to `free-models.ts` and `local.ts`, and for
the same reason: `providers.ts` has to answer `supported()` before any chunk lands.
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

### The local one runs llama.cpp here

**On Device (wllama)** is [wllama](https://github.com/ngxson/wllama), which is llama.cpp
compiled to WebAssembly. A GGUF model is downloaded once and answers in a worker in this
tab, so the turn never leaves the device: no endpoint, no key, no preflight and no rate
limit. `free: true` for the same reason as the rest, and every rate is zero because
nothing is billed.

| File        | What                                                               |
| ----------- | ------------------------------------------------------------------ |
| `local.ts`  | the models, the two urls, `wllamaSupported()`, `useWllamaSource()` |
| `wllama.ts` | pi's context in, pi's events out                                   |

**Nothing here depends on wllama.** The esm bundle is imported at a url, pinned to one
version, and the wasm is fetched from the same place — `WLLAMA_MODULE_URL` and
`WLLAMA_WASM_URL` in `local.ts`. The import is a variable rather than a literal, so no
bundler follows it; the `@vite-ignore` comment says the same thing to vite. A host that
ships wllama itself, or serves a document that allows no remote module, hands its own
module and wasm to `useWllamaSource()` — which is also how the tests stand a model up,
and what the side panel does.

**The models are written by hand**, like the free catalogs, and each names a public GGUF
on Hugging Face: LFM2.5 350M, Qwen3.5 0.8B, MiniCPM5 1B, Qwen3.5 2B and Qwen3.5 4B — five
2026 models, all of which call tools, four of which reason. `baseUrl` is the file to load
rather than an endpoint to post to, `size` is what the download weighs, and `tools` says
whether the chat template of the model can call one: a turn that carries tools where it
cannot is answered from the chat alone and says so in `diagnostics`, exactly as Gemini
Nano does. `contextWindow` is the window the model is _loaded_ with, not the one it was
trained for: it is `n_ctx`, and the KV cache for it sits in the tab's memory.

**The quant is half the choice.** One file may not pass 2 GB — past that wllama wants the
model split into chunks — and the weights share a 4 GiB wasm heap with the KV cache and
everything else. That is the whole reason the list stops at 4B: the 2B is a Q6_K rather
than the usual Q4_K_M, which is the same model with less of it thrown away, and the 4B is
a dynamic Q2_K_XL, which spends its bits on the tensors that carry the reasoning. K-quants
throughout — wllama's own guidance is that IQ quants answer slowly. A bigger model means
splitting one and hosting the chunks, and a window paid for out of the same heap.

**The api is OpenAI shaped**, which is most of the work — `toMessages()` writes pi's
transcript as chat messages, tool calls and all, and the chunks come back as text,
`reasoning_content` and streamed tool calls. `jinja: true` at load time is what parses the
chat template of the model, and is what both of those depend on. The thinking level
reaches a Qwen through `chat_template_kwargs.enable_thinking`; a template that does not
read it ignores it.

**The turn is counted three ways down.** A streamed turn carries usage only where the
request asks for it, so `stream_options.include_usage` goes with every one — without it
llama.cpp streams the answer and no count at all, and the context meter reads zero for a
window of 4096. The `timings` of the runtime are read where usage is still absent:
`prompt_n` is what the turn read, `cache_n` what it kept from the turn before, and the two
are the prompt. Where neither arrives the turn is estimated — one streamed chunk is one
token, and four characters is about one — because a meter that is roughly right is worth
more than an exact zero on a window this small. Nothing is billed either way.

**One model is held at a time.** The weights sit in memory and a second set beside them is
what a tab has no room for, so picking another model exits the first. The first turn on a
model waits for hundreds of MB, which is told as a thinking block on a timer, the way the
Gemini Nano download is; wllama caches the file in the browser, so the second visit loads
from disk and the block never appears. `unloadWllama()` frees it all.

**`wllamaSupported()` gates it**, and keeps the row out of the picker where there is
no `WebAssembly`, no `Worker`, or the document is an MV3 page running on the CDN default —
an extension may load neither a remote script nor a worker built at run time. A host that
passed a source of its own has answered that for its own document, and the gate takes its
word: the side panel ships wllama, its wasm and its worker, and offers the row. See
[`../.agents/playground.md`](playground.md) for the worker, which is the hard half.

**A phone is left out** whatever it can load, which is the one part of the gate a host
cannot answer for by shipping its own build. The smallest model is a 229 MB download over
a connection that is often metered, the rest are hundreds of MB more, and the weights then
sit in a wasm heap a mobile browser reclaims as soon as the tab goes to the back — the
download then starts again. What it does not reclaim it answers slowly, on the one core
the page gets and on a battery. So the row is a long wait for a turn the free providers
answer at once, and it is not offered; every other provider still is. `isPhone()` in
`lib/utils.ts` is the test — a coarse pointer over a screen, the device's and not the
viewport's, of at most 820px, so a docked side panel and a laptop with a touch display
are neither of them one.

## The page's tools

`page: true` on `createPiSession()`, and the model is offered whatever the current page
publishes on `document.modelContext` — WebMCP. Off by default, like the history: the loop
carries no tools of its own, and a surface offers the model nothing nobody asked for.
[`../.agents/webmcp.md`](webmcp.md) is the spec side; this is the pi side.

| File            | What                                                          |
| --------------- | ------------------------------------------------------------- |
| `webmcp.ts`     | the api as typescript sees it, and `documentTools()`          |
| `page-tools.ts` | `PageTools`, the naming, the `AgentTool` wrapper, the toolset |

**Only data crosses.** A WebMCP `RegisteredTool` carries a live `Window`, so it cannot be
serialised: a `PageTool` is the name, the schema, the origin and the two hints, and the
source is what turns one back into a call. That is the whole reason `PageTools` exists as
an interface. `documentTools()` is the page's implementation — the chat is in the document
the tools are in, so it holds the list and matches by name and origin. The panel's is
`extension/tab-tools.ts`, which runs both calls in the tab instead.

**A name is cut to what a provider takes.** WebMCP allows a period and 128 characters;
no provider here does. `cart.add` reaches the model as `cart_add`, anything longer is cut
to 64, and a name already claimed — by a host tool, or by the same tool in a second frame
— gets a `_2`. The site's own name is what the model sees otherwise: it named the tool for
a model to read.

**The site's own word gates its own tools.** `approvalFor` is the second argument to
`createApprovalGate()` — a policy for one tool, `undefined` for the rest — and the toolset
answers it from `readOnlyHint`:

| The page said        | Policy   | Why                                                |
| -------------------- | -------- | -------------------------------------------------- |
| `readOnlyHint: true` | `never`  | it changes nothing, so there is nothing to confirm |
| anything else        | `always` | one allow must not cover a session                 |
| not a page tool      | —        | the session's own policy stands                    |

A page tool is one the visitor never installed, acting on a site they are signed in to, so
a tool that acts is confirmed every time and no allow is remembered for it. A tool that
only reads is taken at the site's word: the alternative is asking about every search of a
documentation page, which teaches the reader to click through the question.
`approvals: "never"` outranks all of it — a host that turned the gate off meant it.

**`untrustedContentHint` reaches both readers.** A site that says it does not vouch for a
result — a review, a comment, another user's message — gets a line ahead of the output
naming the origin and saying to treat it as data. That is the model's warning, and the
person needs one too: what reads as an answer may be an instruction somebody else wrote.
`details` carries the origin and the flag to `transcript.ts`, which puts them on the tool
part as `untrustedFrom`, and `chat/message.tsx` notes it above the output it applies to.

**The list follows the page.** A site registers per screen, so `toolchange` is subscribed
to and the source read again; a list that came back the same tells nobody. `refresh()`
rebuilds the `AgentTool[]` and the session reassigns `agent.state.tools` — the host's
tools, then the page's — so a screen that dropped a tool drops it here too. The empty
state reads `agent.state.tools`, so the panel of tools follows on its own.

**A source that will not answer has no tools.** `list()` is caught: a page that offers
none and a tab that cannot be reached come to the same thing for the turn about to run,
and neither is worth an error row over the composer.

**The api is looked for more than once.** `document.modelContext` read at construction is
one moment of a page's life. A host that mounts the chat early — at module scope, or ahead
of a shim — would read `undefined`, bind no `toolchange` listener, and stay deaf for the
whole session, which is a feature that silently does nothing rather than a failure anybody
sees. So `documentTools()` holds its listeners itself and attaches to the api whenever one
first appears; a subscriber that finds none waits for it, every 500ms and ten times over.
Finding it is news of its own — nothing has read that api's list — so the listeners are
told as if it had changed. Past five seconds the answer is no and no timer is left
running: a browser that carries no WebMCP must not pay for one that does.

## Where the choices go

`storage.ts` names the four things the picker decides — the key per provider, the
provider, the model per provider and the level per model — and holds them in a `PiStorage`,
a store with `get(name)` and `set(name, value)`, both asynchronous. The library writes
nothing to the browser on its own: the default is one memory store shared by every session
on the page, so a key typed in one conversation answers in the next and goes when the page
goes.

A host that wants more passes the `storage` option: `browserStorage()` for `localStorage`,
as the playground does, or a store of its own — `chrome.storage.local`, as the panel does.
`remove` is a third method and an optional one: a store without it drops a value by writing
it empty, which reads back as nothing.

**Every method answers with a promise**, because most stores worth passing cannot answer at
once: `chrome.storage` and IndexedDB reply later, and a store that encrypts what it holds
waits on WebCrypto to read one value at all. So the session is built on nothing and takes
what the store held a beat after — the keys and the provider first, then the catalog, the
model and the level that follow from it, exactly as they follow a provider picked by hand.
Nothing has to wait for that: the surface redraws when each lands. `PiSession.ready` is for
a host that would rather not show a chat with every choice forgotten and then change it
under the reader — the panel mounts on it, because a side panel is the whole document.

Two things guard the window between asking the store and hearing back. A key typed while
the store is answering sits **over** what it held, rather than under it, and a provider,
model or level chosen by hand in that window is counted — `picked` — so the answer arriving
after it is dropped rather than applied. Without that, a person who picks while the store
reads is overruled by a file.

A write is one nobody waits for, so `createChoices` swallows a write that did not land: a
choice the store refused is one this browser forgets, which is what a page with denied
storage already gets. The history is the one caller that does wait, and it waits for the
opposite reason — see below.

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
lands on `waitForIdle()` and an idle one — every swap a person makes — lands at once. That
wait is why `load()` takes `after`: a caller that sends into the new transcript, which is
what `retryFrom` does, would otherwise send into the one being replaced.

## The conversations a session keeps

`history: true` on `createPiSession()`, and the chat grows a history page: the clock in the
header, listing what this session has stored, with the live one marked. Picking
one is `restore()` under the covers, so the chat never unmounts. `history.ts` is the store
behind it, over the same `PiStorage` as the keys — memory by default, `localStorage` where
a host passed `browserStorage()`, or a `PiHistory` of the host's own where neither will do.

Off by default: the library stores nothing unasked, and a host already keeping its own with
`save()` should grow no second list. Turned on:

- The session opens on a **new conversation**, stored ones and all: a chat that was just
  opened is a chat to start, and the history page is one click away. A `snapshot` option is
  the one thing that opens on a conversation — a host that hands one over keeps its own.
- A conversation is written **every time the loop settles**, and again when the model names
  it, so nothing is debounced and nothing is flushed on `pagehide`. `dispose()` writes the
  last one in hand.
- **New conversation** files the one it replaces away rather than dropping it; an empty
  conversation is never written, so nothing lists a chat that was never spoken to.
- Forgetting the live conversation leaves an empty chat on a new id.
- **Retrying a user message** cuts the transcript back to just before it and sends it
  again, in the conversation on screen: `store.load()` with the slice, and the send handed
  to `load`'s `after` — a rewind over a streaming answer aborts the turn, and pi settles a
  beat later, so a message sent at once would go into the transcript being replaced. It
  goes through the same `submit()` the composer does, so a chat that lost its key holds it
  the same way. Nothing is kept: the answer being replaced is gone, and the next settle
  writes the shorter transcript over the stored conversation.
- **Forking a user message** files the whole conversation away and opens a new one on the
  turns before that message, under the same provider, model and level. `fork` is
  `restore()` again, over `capture()` with the transcript cut and the title dropped: the
  branch names itself, because its first message may be one the title never spoke for. The
  message is not in it — the surface hands its words back to the composer. An id naming
  anything but a user message is no rewind and does nothing, because a click can land a
  beat after an event that changed the transcript.

Two keys, not one: an index of what exists, and one entry per conversation. The page reads
the index alone, so listing never parses a transcript, and one is dropped by its own key
rather than by rewriting the rest. Twenty are kept; past that the oldest goes. A full store
is reported in one of two ways — `localStorage` throws and `browserStorage()` swallows it,
`chrome.storage` rejects — so the write is both awaited and read back, and one that will
not fit gives up older conversations until it lands. The eviction awaits the removal it
asked for: room is only free once the transcript that held it is really gone.

`list()` is a snapshot field, so it answers from memory: the index is read once, into
`items`, and `ready` is when that landed. `read()` is the one that fetches, because a
transcript is only wanted when a row is picked. A conversation kept or forgotten before the
index arrives is remembered in `decided` and the index is merged around it rather than
assigned over it — nearly never taken, since a chat lists nothing until it has read the
index, but the alternative is a row that opens nothing.

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

**A body is opened before it is shown.** Both sdks look for a `message` at the top of an
error body, find none where the provider nests one under `error` — which Vercel, OpenAI and
Anthropic all do — and stringify the whole object, so the row would read
`429 {"error":{"message":"…","type":"rate_limit_error"}}`. `describeFailure()` takes the
sentence back out. A body that carries no sentence at all leaves the status as the whole
answer, the same as a bodiless one, and a 429 that names a limit without saying what to do
about it gains "Wait a moment, or select another model." — said once, so a provider that
gives its own wait keeps it.

**Four statuses open the settings page.** `failureStatus()` reads the status back out of
the same message, and `store.ts` carries it beside the worded one as `errorStatus`. A 401,
402, 403 or 404 is the provider answering about the key, the account behind it or the
model — none of which the transcript can fix — so `session.ts` opens the page where all
three are chosen, with the error row still above the composer. Once per failure: the page
is the person's to close again, and only a new error opens it a second time. Everything
else leaves the transcript up and offers the retry button: a 5xx and a request that never
arrived are the provider's own to recover from, and a rate limit, a timeout or a full
context window are answered by waiting rather than by anything on that page — `ANSWERED_ON_SETTINGS`
in `session.ts` is the list.

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
  from `messages` until `message_end`, so it is appended, not merged. `piMessageIndex()`
  is the way back — `u12` is `messages[12]` — which is how a fork reaches the message the
  reader clicked.
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
