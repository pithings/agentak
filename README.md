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
  // defines <agent-chat>
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

### ⚛️ As a component

```tsx
import { AgentChat, tokens } from "agentak";

<AgentChat
  provider="openai"
  apiKey="sk-…"
  style={{ height: "600px" }}
  actions={<button>Minimise</button>}
  emptyActions={<p>Ask me about this page.</p>}
/>;
```

| Prop           | What                                                               |
| -------------- | ------------------------------------------------------------------ |
| `provider`     | The provider to start with. Default: the last provider you used    |
| `apiKey`       | A key for `provider`, or `{ [providerId]: key }`                   |
| `actions`      | Buttons for the end of the header                                  |
| `emptyActions` | Content for the empty state                                        |
| `style`        | Styles that are merged over the chat box. Use them to set the size |
| `className`    | —                                                                  |

If you give no props, the picker asks for the values. It then keeps the values for
the next time.

### 🔧 Use your own loop, or your own UI

```ts
import { Chat } from "agentak"; // only the surface — messages in, callbacks out
import { createAgent, useAgent } from "agentak/pi"; // only the loop
import { Message, PromptInput } from "agentak/components"; // the parts
```

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
