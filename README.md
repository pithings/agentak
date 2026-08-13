<p align="center">
  <img src="assets/agentak.svg" alt="" width="104" height="104">
</p>

<h1 align="center">Agentak</h1>

<p align="center">
  An agent chat for any web page. Mount one component, and it needs one line of
  setup.
</p>

- 🧩 **One component and one session.** `<AgentakChat session={…} />` is the whole
  chat — the providers, the styles, the tools. Two imports, and no setup line.
- ⚡ **React, vue, preact, or no framework at all.** One subpath each, or `mount()` it
  into any element — one call, from a CDN.
- 🎨 **It ships no stylesheet.** Every style is inline on the element that carries it,
  so the chat changes no page style of yours.
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

### ⚛️ In react, vue, or preact

One element for your framework. It declares the CSS variables and it sizes like any
other component — but it carries **no agent**: `session` is what runs the chat, and
`agentak/pi` is the import that makes one.

```tsx
import { AgentakChat } from "agentak/react"; // or agentak/preact
import { createPiSession } from "agentak/pi";

const session = useMemo(() => createPiSession(), []);

<AgentakChat session={session} style={{ height: "600px" }} />;
```

```vue
<script setup lang="ts">
import { AgentakChat } from "agentak/vue";
import { createPiSession } from "agentak/pi";

const session = createPiSession();
onBeforeUnmount(() => session.dispose?.());
</script>

<template>
  <AgentakChat :session="session" class="h-[600px]" />
</template>
```

| Prop                      | What                                                     |
| ------------------------- | -------------------------------------------------------- |
| `session`                 | what runs the chat. **Required**                         |
| `generateTitle`           | ask the model to name the conversation. One more request |
| `tokens`                  | `false` if your page declares the CSS variables itself   |
| `actions`, `emptyActions` | header buttons, and content for the empty state          |
| `class` / `className`     | —                                                        |
| `style`                   | the box around the chat. Give it a height                |

`createPiSession()` takes the provider, the key and the loop's own options; it is
described below. **Whoever makes the session ends it** — the component never calls
`dispose()`, because it never made the object. One session lasts a whole conversation:
provider, model and key all change from the picker inside the composer, with the
transcript kept.

The chat is preact inside, in all three. React and vue therefore give it one `<div>`
that preact fills, and `actions` and `emptyActions` are preact children — build them
with `h()` from preact, or do not pass them.

### 🧩 In any page

A build step is not necessary, and neither is a framework. Import from a CDN and
`mount`:

```html
<div id="chat" style="height: 600px"></div>

<script type="module">
  import { mount } from "https://esm.sh/agentak";
  // the built-in agent — this import is what brings the loop
  import { createPiSession } from "https://esm.sh/agentak/pi";

  mount("#chat", { session: createPiSession() });
</script>
```

`mount(target, props)` is the wrappers' work for a page that has no framework: it
declares the CSS variables, makes the element a box the chat fills, and renders the
surface inside it. Size that element — the chat takes its height.

`target` is a selector or an element. `props` is every `AgentChat` prop, plus `tokens:
false` if your page declares the variables itself. It returns `{ update, unmount }`:
`update(props)` redraws in one diff, with the transcript kept, and `unmount()` empties
the element. Neither one ends the session — you made it, so you end it.

### 🧩 The surface, over a session you make

`AgentChat` is the same chat with nothing under it: it takes the session that runs it.
`createPiSession()` is the built-in one, and it is the import that brings the agent loop
with it. Create it one time, outside the tree — whoever makes a session ends it:

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
loaded — `agentak/pi` is the only entry that carries one.

```tsx
import { AgentChat, type ChatSession, type ChatSnapshot } from "agentak";

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

// The same surface, over your harness. No pi module is loaded.
<AgentChat session={session} />;
```

The framework wrappers take the same object, and they carry no loop either — so
`agentak/react` over your own harness resolves no pi module, exactly as the root does.

The five methods above and `subscribe` are all that a session must have. Everything
else is optional, and what you leave out is left out of the UI:

| Optional         | What it adds                              |
| ---------------- | ----------------------------------------- |
| `respond`        | approve or deny a tool call               |
| `dequeue`        | remove a message that waits its turn      |
| `selectProvider` | the provider level of the picker          |
| `selectModel`    | the model level                           |
| `saveKey`        | the key level                             |
| `setPickerOpen`  | your session opens the picker itself      |
| `setOptions`     | it receives `generateTitle` from the host |
| `dispose`        | you call it when the chat goes away       |

The snapshot works the same way. `messages` and `isStreaming` are required; `error`,
`title`, `agent`, `usage`, `queued`, `providers`, `providerId`, `models`,
`modelsLoading`, `modelId` and `pickerOpen` each turn on one part of the surface. With
no `providers`, the picker is your one model list. With no `usage`, the composer shows
no context meter.

`ChatSnapshot` is a subset of the props of `Chat`, thus the compiler holds the two
sides together.

### 🧱 Use the parts

```ts
import { Chat, injectTokens } from "agentak"; // only the surface — messages in, callbacks out
import { createAgent, useAgent } from "agentak/pi"; // only the loop
import { Message, PromptInput } from "agentak/components"; // the components
```

## 📤 Exports

| Import               | What                                        | Agent loop |
| -------------------- | ------------------------------------------- | ---------- |
| `agentak/react`      | `AgentakChat` — the chat as a react element | no         |
| `agentak/vue`        | the same, in vue                            | no         |
| `agentak/preact`     | the same, in preact                         | no         |
| `agentak`            | `Chat`, `AgentChat`, `mount()`, `tokens`    | no         |
| `agentak/pi`         | `createPiSession()`, and the parts below it | **yes**    |
| `agentak/components` | every built-in component                    | no         |

**`agentak/pi` is the only import that carries the loop.** Every other entry takes the
session as a prop, thus your bundle holds an agent runtime because you asked for one.

`react` and `vue` are optional peers: you install the one you use, and the other is
never resolved.

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
