<p align="center">
  <img src="assets/agentak.svg" alt="" width="104" height="104">
</p>

<h1 align="center">Agentak</h1>

<p align="center">
  An agent chat for any web page. Mount one component and you're done.
</p>

- 🧩 **One component, one session.** `<AgentakChat session={…} />` is the entire chat —
  providers, styles and tools included. Two imports, no setup.
- ⚡ **React, Vue, Preact, or no framework at all.** There's a subpath for each, or call
  `mount()` on any element — a single call, straight from a CDN.
- 🎨 **No stylesheet ships.** Every style is inline on the element that carries it, so the
  chat won't touch anything on your page.
- 🔄 **The agent is a separate import.** The chat surface has no loop of its own — it takes
  a `ChatSession`. Use the built-in pi agent, or put your own harness behind the same UI.
- 🔌 **9 providers** — OpenAI, Groq, Cerebras, OpenRouter, Vercel AI Gateway, LLM7,
  OVHcloud, Kilo and OpenCode Zen.
- 🚀 **No setup screen.** The composer has a single picker for provider, model and key, and
  the first message opens it. Picking a free provider is one click.
- 👀 **The agent reads the page.** The `read_page` and `find_elements` tools are built in,
  so it can answer questions about whatever the user is looking at.
- 💬 **Streaming, tool approvals, markdown, code blocks and a message queue.**
- 🔒 **Keys never leave the browser** (`localStorage`). Requests go straight to the
  provider, so you don't need a server.
- 🌗 **Light and dark themes**, driven by CSS custom properties you can override.
- 🧭 **A Chrome side panel** is included (MV3), giving you the same chat on every tab.

## 📦 Install

```sh
npx nypm i agentak
```

---

## 🚀 Quick Start

```html
<div id="chat" style="height: 600px"></div>

<script type="module">
  // Renders chat UI (no agent, no provider, no loop)
  import { mount } from "https://esm.sh/agentak";

  // The built-in PI agent
  import { createPiSession } from "https://esm.sh/agentak/pi";

  mount("#chat", { session: createPiSession() });
</script>
```

That's it. The chat opens with no provider chosen — the first message opens the picker in
the composer, a free provider is one click away and needs no key, and the answers are still
there on the next visit.

---

## 💬 Chat Component

One element for your framework. It declares the CSS variables and sizes like any other
component, but it brings **no agent** with it: `session` is what actually runs the chat.

### ⚛️ React

```tsx
import { useMemo } from "react";
import { AgentakChat } from "agentak/react";
import { createPiSession } from "agentak/pi";

export function Assistant() {
  const session = useMemo(() => createPiSession(), []);
  return <AgentakChat session={session} style={{ height: "600px" }} />;
}
```

### 🟢 Vue

```vue
<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { AgentakChat } from "agentak/vue";
import { createPiSession } from "agentak/pi";

const session = createPiSession();
onBeforeUnmount(() => session.dispose());
</script>

<template>
  <AgentakChat :session="session" class="h-[600px]" />
</template>
```

### 🟣 Preact

```tsx
import { AgentakChat } from "agentak/preact";
import { createPiSession } from "agentak/pi";

const session = createPiSession();

<AgentakChat session={session} style={{ height: "600px" }} />;
```

### 🧩 No framework

```ts
import { mount } from "agentak";
import { createPiSession } from "agentak/pi";

const chat = mount("#chat", { session: createPiSession() });
```

#### `mount(target, props)`

`target` is a selector or an element. `props` is every [`AgentChat` prop](#agentchat), plus
`tokens: false` if your page already declares the CSS variables.

`mount` does three things you'd otherwise do in a framework wrapper: it declares the CSS
variables, it turns your element into a box the chat fills, and it renders the surface
inside. **Give that element a size** — the chat takes its height from it.

You get back `{ update, unmount }`. `update(props)` redraws in one diff and keeps the
transcript; `unmount()` empties the element. Neither ends the session — you created it, so
you close it.


### Props

`AgentakChat` takes the same props in all three frameworks:

| Prop                  | Type            | What                                                      |
| --------------------- | --------------- | --------------------------------------------------------- |
| `session`             | `ChatSession`   | What runs the chat. **Required**                          |
| `generateTitle`       | `boolean`       | Ask the model to name the conversation. Costs one request |
| `tokens`              | `boolean`       | `false` if your page already declares the CSS variables   |
| `actions`             | preact children | Buttons for the end of the header                         |
| `emptyActions`        | preact children | Content for the empty state, under the greeting           |
| `class` / `className` | `string`        | Goes on the box around the chat                           |
| `style`               | style object    | The box around the chat. **Give it a height**             |

`class` is the Vue name and `className` the React and Preact one; Vue accepts `style` too.
Both land on the single element the wrapper owns.

#### `AgentChat`

`AgentChat` from the root entry is the same surface without the host box around it — it's
what the wrappers render. Reach for it inside a Preact tree that already sizes its
children:

```tsx
import { AgentChat } from "agentak";
import { createPiSession } from "agentak/pi";

const session = createPiSession({ provider: "openai", apiKey: "sk-…" });

<AgentChat
  session={session}
  style={{ height: "600px" }}
  actions={<button>Minimise</button>}
  emptyActions={<p>Ask me about this page.</p>}
/>;
```

It takes `session`, `generateTitle`, `actions`, `emptyActions`, `className` and `style` —
everything above except `tokens`, which belongs to the wrappers. Declare the variables
yourself with `injectTokens()` from `agentak`.

### Notes

- **Whoever creates the session closes it.** No wrapper calls `dispose()`, since none of
  them made the object.
- **One session is one conversation,** and it lasts as long as the conversation does:
  provider, model, key and thinking level all change from the picker in the composer,
  transcript intact. For several conversations, keep several sessions and swap the prop.
- **The chat is Preact under the hood, in all three frameworks.** React and Vue each hand
  it a single `<div>` that Preact fills, which makes `actions` and `emptyActions` Preact
  children — build them with `h()` from preact, or leave them out.
- **`generateTitle` is a prop, not a session option,** so you can change it without
  creating a new session and losing the transcript.

---

## 🤖 PI Agent

`agentak/pi` is the built-in harness: [pi-agent-core](https://www.npmjs.com/package/@earendil-works/pi-agent-core)
over the page tools, with the provider, model and key picker in front of it. It's the only
entry that carries an agent loop.

```ts
import { createPiSession } from "agentak/pi";

const session = createPiSession();
// … mount the chat over it …
session.dispose();
```

Pass nothing and the picker does the asking: the first message opens it, a free provider
takes one click, and the answers are kept in `localStorage` for next time. Or name the
provider and key yourself:

```ts
const session = createPiSession({
  provider: "openai",
  apiKey: "sk-…",
  systemPrompt: "You are a support agent for example.com. Answer from the page.",
  approvals: "never",
});
```

### Options

| Option          | Type                                                     | What                                                                     |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `provider`      | `string`                                                 | Which provider to open on. Defaults to the one this browser stored, if any |
| `apiKey`        | `string \| Record<string, string>`                       | A key for `provider`, or one per provider id. Free providers need none   |
| `generateTitle` | `boolean`                                                | Let the model name the conversation instead of the first message         |
| `model`         | `AnyModel`                                               | The model to start on. Defaults to the picker's, or the built-in default |
| `thinkingLevel` | `off \| minimal \| low \| medium \| high \| xhigh \| max` | Defaults to `off`, and never a level the model refuses                   |
| `systemPrompt`  | `string`                                                 | Defaults to a short browsing-assistant prompt                            |
| `page`          | `PageBridge`                                             | How the tools reach the page. Defaults to the document this script runs in |
| `tools`         | `AgentTool[]`                                            | Defaults to `read_page` and `find_elements`                              |
| `approvals`     | `"always" \| "once" \| "never"`                          | How often a tool call is confirmed. Defaults to `once` per tool          |
| `streamFn`      | `StreamFn`                                               | A scripted provider for tests. Defaults to the api the model names       |

`createPiSession()` returns a `PiSession` — a `ChatSession` plus `dispose()`. Create it
**once, outside the render tree**, and dispose it when the conversation goes away.

### Providers

| Provider                                 | Key      | Api                |
| ---------------------------------------- | -------- | ------------------ |
| LLM7, Kilo, OVHcloud, OpenCode Zen       | **free** | openai-completions |
| Vercel AI Gateway, OpenRouter (gateways) | yours    | per model          |
| OpenAI                                   | yours    | openai-responses   |
| Groq, Cerebras                           | yours    | openai-completions |

Keys go from the browser straight to the provider, and each one is stored per provider — so
switching back to a provider you've already set up asks for nothing.

**Two of the nine answer no CORS preflight** — Kilo and OpenCode Zen — so a web page gets 7
and the Chrome panel gets all 9. A model catalog is only fetched once its provider is
picked, and the api module only on the first turn that needs it, so a provider you don't
use costs you nothing.

### Page tools

`read_page` returns the visible text, the title and the url; `find_elements` runs a CSS
selector and returns what it matched. Both go through a `PageBridge`, which is just two
calls:

```ts
interface PageBridge {
  read(maxChars: number): Promise<PageSnapshot>;
  find(selector: string, limit: number): Promise<PageElement[]>;
}
```

By default it reads the document the script runs in. Pass `page` to read a different one —
an iframe, or a tab through `chrome.scripting`. Pass `tools` to replace the two tools
entirely.

### The parts

The session is the whole loop in one object, but the pieces are exported too:

```ts
import { createAgent, useAgent, createAgentStore } from "agentak/pi";
```

`createAgent()` gives you the pi `Agent` and the approval gate; `createAgentStore()` turns
its events into a snapshot; `useAgent()` is the same thing as a Preact hook, for when you
drive `Chat` yourself.

---

## 🔧 Custom Agents

The surface knows nothing about agent runtimes. Write a `ChatSession` and the built-in loop
never loads — `agentak/pi` is the only entry that carries one.

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
  // whole transcript — a dev build says so in the console if you slip.
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

The framework wrappers take the same object and carry no loop either, so `agentak/react`
over your own harness resolves no pi module — exactly like the root entry.

### The required five

`subscribe`, `snapshot`, `send`, `stop` and `reset` are all a session really needs.

Two rules keep the seam tight:

1. **`snapshot()` must be cheap, and return the same object between notifications.** The
   surface reads it more than once per render, so cache it and drop the cache when you
   notify.
2. **`subscribe` fires after the change, not before.**

### The optional rest

Whatever you leave out is left out of the UI — absent means gone, not broken:

| Optional           | What it adds                                    |
| ------------------ | ----------------------------------------------- |
| `respondToTool`    | approve or deny a tool call, and say why        |
| `dequeue`          | remove a message waiting its turn               |
| `dismissError`     | a button that closes the error row              |
| `retry`            | a button that runs the failed turn again        |
| `selectProvider`   | the provider level of the picker                |
| `selectModel`      | the model level                                 |
| `setThinkingLevel` | the thinking level, under the chosen model      |
| `saveKey`          | the key level                                   |
| `setPickerOpen`    | lets your session open and hold the picker      |
| `setOptions`       | receives `generateTitle` from the host          |

`dispose` isn't on the list: nothing in the library calls it, so it belongs to whoever made
the session. `createPiSession()` returns one that has it.

### The snapshot

`messages` and `isStreaming` are required. `error`, `title`, `agent`, `usage`, `queued`,
`providers`, `providerId`, `providerLabel`, `models`, `modelsLoading`, `modelId`,
`thinkingLevel`, `thinkingLevels` and `pickerOpen` each switch on one part of the surface.

Without `providers`, the picker is a single model list headed by `providerLabel`. Without
`usage`, the composer shows no context meter — and since `usage.nearLimit` is what turns
that meter amber, a harness that counts its own tokens decides for itself when the window
is as good as spent.

Data and method come in pairs: `models` with `selectModel`, `providers` with
`selectProvider`, `queued` with `dequeue`, `thinkingLevels` with `setThinkingLevel`. One
without the other leaves you a list nobody chooses from, or a method nobody calls.
`pickerOpen` is the one to watch — a session that answers `setPickerOpen` owns both halves,
and has to report `pickerOpen` as well.

`ChatSnapshot` is a subset of the props of `Chat`, so the compiler holds the two sides
together: a prop the surface gains can't go missing from the seam without breaking the
build.

### Use the parts

```ts
import { Chat, injectTokens } from "agentak"; // only the surface — messages in, callbacks out
import { Message, PromptInput } from "agentak/components"; // the components
```

---

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
session as a prop, so an agent runtime ends up in your bundle only if you asked for one.

`react` and `vue` are optional peers: install the one you use, and the other is never
resolved.

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
