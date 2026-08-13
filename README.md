<p align="center">
  <img src="assets/agentak.svg" alt="" width="104" height="104">
</p>

<h1 align="center">Agentak</h1>

<p align="center">
  An agent chat for any web page. It is one custom element, and it needs one line of
  setup.
</p>

- 🧩 **`<agent-chat>` web component** — it uses shadow DOM. Page styles do not change
  the chat, and chat styles do not change the page.
- ⚡ **Use it with any framework, or with no framework.** A preact component is also
  available.
- 🔄 **The agent is a separate import.** The chat surface holds no loop: it takes a
  `ChatSession`. Use the built-in agent, or put your own harness behind the same UI.
- 🔌 **9 providers** — OpenAI, Groq, Cerebras, OpenRouter, Vercel AI Gateway, LLM7,
  OVHcloud, Kilo, OpenCode Zen. 4 providers are free and need no key.
- 🚀 **No setup screen** — the composer has one picker for the provider, the model and
  the key. The first message opens the picker. To select a free provider, click one
  time.
- 👀 **The agent reads the page** — the `read_page` and `find_elements` tools are
  built in. Thus the agent can answer questions about the current page.
- 💬 **Streaming, tool approvals, markdown, code blocks, and a message queue.**
- 🔒 **Keys stay in the browser** (`localStorage`). Requests go directly to the
  provider. No server of yours is necessary.
- 🌗 **Light and dark themes**, from CSS custom properties that you can change.
- 🧭 **A Chrome side panel** is included (MV3). It gives the same chat for all tabs.

## 📦 Install

```sh
npx nypm i agentak
```

## 🛠️ Usage

### 🧩 As a custom element

A build step is not necessary. Import the element from a CDN:

```html
<agent-chat style="height: 600px"></agent-chat>

<script type="module">
  import { tokens } from "https://esm.sh/agentak";
  // defines <agent-chat>, over the built-in agent
  import "https://esm.sh/agentak/element";

  // Adds the CSS variables that the chat uses.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(tokens);
  document.adoptedStyleSheets.push(sheet);
</script>
```

There are two optional slots. Both slots use light DOM, thus your nodes keep your
styles:

```html
<agent-chat>
  <button slot="actions">Minimise</button>
  <p slot="empty">Ask me about this page.</p>
</agent-chat>
```

The `actions` slot shows at the end of the chat header. The `empty` slot shows below
the greeting, and only before the first message.

The header names the conversation after your first message. Add `generate-title` to ask
the model for a name instead. This costs one more request, once:

```html
<agent-chat generate-title></agent-chat>
```

### ⚛️ As a component

`AgentChat` takes the session that runs it. `createPiSession()` is the built-in one, and
it is the import that brings the agent loop with it. Create it one time, outside the
tree:

```tsx
import { AgentChat, tokens } from "agentak";
import { createPiSession } from "agentak/pi";

const session = createPiSession({ provider: "openai", apiKey: "sk-…" });

<AgentChat
  session={session}
  style={{ height: "600px" }}
  actions={<button>Minimise</button>}
  emptyActions={<p>Ask me about this page.</p>}
/>;
```

| Prop            | What                                                               |
| --------------- | ------------------------------------------------------------------ |
| `session`       | What runs the chat. Required                                       |
| `generateTitle` | Ask the model to name the conversation. One more request           |
| `actions`       | Buttons for the end of the header                                  |
| `emptyActions`  | Content for the empty state                                        |
| `style`         | Styles that are merged over the chat box. Use them to set the size |
| `className`     | —                                                                  |

`createPiSession()` takes `provider`, `apiKey` (one key, or `{ [providerId]: key }`),
and the loop's own options — `page`, `tools`, `approvals`, `systemPrompt`. Give it
none and the picker asks, then keeps your answers for the next time.

### 🔧 Bring your own agent

The surface knows no agent runtime. Write a `ChatSession` and the built-in loop is never
loaded — `agentak/element` is the only entry that selects one for you.

```ts
import { AgentChat, defineAgentChat, type ChatSession, type ChatSnapshot } from "agentak";

const listeners = new Set<() => void>();
let snapshot: ChatSnapshot = { isStreaming: false, messages: [] };

const session: ChatSession = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  // The same object until something changes. A new one on every call redraws the
  // whole transcript.
  snapshot: () => snapshot,
  send(text) {
    snapshot = {
      isStreaming: false,
      messages: [
        ...snapshot.messages,
        { id: crypto.randomUUID(), parts: [{ kind: "text", text }], role: "user" },
      ],
    };
    for (const listener of listeners) listener();
  },
  stop() {},
  reset() {},
};

// `<agent-chat>` over your harness. The built-in tag is not reserved for the
// built-in loop, so pass `tag` only if you want a second element.
defineAgentChat({ session: () => session });
```

Or give one to an element that exists already, before it lands in the page or after.
This wins over the session that the tag was registered with:

```js
document.querySelector("agent-chat").session = session;
```

A session is necessary: `defineAgentChat` does not accept a call without one.

The five methods above and `subscribe` are all that a session must have. Everything
else is optional, and what you leave out is left out of the UI:

| Optional         | What it adds                                     |
| ---------------- | ------------------------------------------------ |
| `respond`        | approve or deny a tool call                      |
| `dequeue`        | remove a message that waits its turn             |
| `selectProvider` | the provider level of the picker                 |
| `selectModel`    | the model level                                  |
| `saveKey`        | the key level                                    |
| `setPickerOpen`  | your session opens the picker itself             |
| `setOptions`     | it receives `generateTitle` from the host        |
| `dispose`        | `<agent-chat>` calls it when it made the session |

The snapshot works the same way. `messages` and `isStreaming` are required; `error`,
`title`, `agent`, `usage`, `queued`, `providers`, `providerId`, `models`,
`modelsLoading`, `modelId` and `pickerOpen` each turn on one part of the surface. With
no `providers`, the picker is your one model list. With no `usage`, the composer shows
no context meter.

`ChatSnapshot` is a subset of the props of `Chat`, thus the compiler holds the two
sides together.

### 🧱 Use the parts

```ts
import { Chat } from "agentak"; // only the surface — messages in, callbacks out
import { createAgent, useAgent } from "agentak/pi"; // only the loop
import { Message, PromptInput } from "agentak/components"; // the components
```

## 📤 Exports

| Import               | What                                                            | Agent loop |
| -------------------- | --------------------------------------------------------------- | ---------- |
| `agentak`            | `Chat`, `AgentChat`, `defineAgentChat`, `ChatSession`, `tokens` | no         |
| `agentak/element`    | defines `<agent-chat>`, over the built-in agent                 | yes        |
| `agentak/pi`         | `createPiSession()`, and the parts below it                     | yes        |
| `agentak/components` | every built-in component                                        | no         |

## 🧭 Chrome extension

```sh
pnpm build:extension   # then load extension/dist unpacked
```

## 💻 Develop

```sh
pnpm dev         # playground on http://localhost:4050
pnpm build       # dist/
pnpm test        # vitest
```

MIT
