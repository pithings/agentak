# The agent loop

`src/agent/` — pi-agent-core, and everything that feeds the chat. `createWebAgent()`
builds a pi `Agent`; `useAgent()` turns its events into the props `AgentChat` takes.
Neither the chat nor any element knows pi exists.

```
prompt -> Agent -> streamFor(model.api) -> streamSimple -> AgentEvent
                -> beforeToolCall -> ApprovalGate -> AgentTool -> PageBridge
useAgent: every event -> toViewMessages(agent.state) -> AgentChat
```

| File              | What                                                      |
| ----------------- | --------------------------------------------------------- |
| `create-agent.ts` | the `Agent`, the stream function, the system prompt       |
| `free-models.ts`  | the hand-written catalogs of the four keyless providers   |
| `approvals.ts`    | the confirmation gate behind `beforeToolCall`             |
| `models.ts`       | catalog filtering, the defaults                           |
| `providers.ts`    | the provider list, the api modules, `streamFor()`         |
| `use-catalog.ts`  | one provider's models, fetched once per page              |
| `page-bridge.ts`  | how tools reach the page — document-backed today          |
| `storage.ts`      | `localStorage` for the keys, the provider and the model   |
| `tools.ts`        | `read_page`, `find_elements`                              |
| `transcript.ts`   | `AgentMessage[]` -> renderable parts, and the usage panel |
| `use-agent.ts`    | preact state over `Agent` events                          |

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
plus its `defaultModelId`. `test/agent/providers.test.ts` loads every catalog and fails
if a default no longer exists, or if a listed model needs an api this build lacks.

Left out on purpose: providers that need an account id in the url (Cloudflare), an
OAuth flow (Copilot, Codex), signed requests (Bedrock, Vertex), or another sdk for one
provider each (Google, Mistral).

A key is stored per provider, so switching back to one already set up asks nothing.
`getApiKey(provider)` is how pi asks for the right one.

### The free four

`free: true` means the endpoint answers an anonymous request. The gate is skipped, the
picker opens on LLM7, and a page can answer before anyone is asked for anything. They
are rate limited by IP address, and `Provider.note` says how much.

pi-ai carries no catalog for them, so `free-models.ts` writes one each: only chat models
that stream and take tools, priced at zero. Two shapes of "no key":

| Provider     | Endpoint                                           | Auth                       |
| ------------ | -------------------------------------------------- | -------------------------- |
| LLM7         | `https://api.llm7.io/v1`                           | `Bearer unused`            |
| Kilo Gateway | `https://api.kilo.ai/api/gateway`                  | `Bearer unused`            |
| OVHcloud     | `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1` | no header — a token is 403 |
| OpenCode Zen | `https://opencode.ai/zen/v1`                       | no header — a token is 401 |

`createWebAgent()` hands pi the string `unused` when a free provider has no key of its
own. The other two get `Authorization: null` on every model, which is how the openai
client is told to drop a header it always sets.

Their paid models are not listed: LLM7 and Zen answer `invalid_api_key` for those, so
only the free tier is written down. Free tiers rotate — a model that starts to 404 is
a line to delete.

## What feeds each element

| Element                             | Source                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `conversation`, `message`, markdown | `user` / `assistant` text content                                       |
| `reasoning`                         | `thinking` blocks; `redacted` renders a note instead                    |
| `tool`                              | `toolCall` + `tool_execution_*` + the `toolResult` that answers it      |
| `code-block`                        | tool output, and markdown fences                                        |
| `confirmation`                      | `beforeToolCall`, parked on a promise the buttons resolve               |
| `queue`                             | `agent.steer()` — a message typed mid-turn                              |
| `context`                           | `usage` of the last turn, cost summed over all of them                  |
| `model-selector`                    | the current provider's catalog; picking one assigns `agent.state.model` |
| `agent`                             | the system prompt and `agent.state.tools`, in the empty state           |
| `image`                             | `ImageContent` in a user message or a tool result                       |
| `shimmer`                           | streaming, before the first block of the turn arrives                   |
| `checkpoint`                        | `compactionSummary` / `branchSummary` messages                          |

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
  every listener returns, so `use-agent.ts` waits on `waitForIdle()` for the last
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
- **Build the runtime once.** `createWebAgent()` inside a render makes a new, empty
  agent every time. `web-agent.tsx` holds it in `useState(() => …)`.
