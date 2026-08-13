<p align="center">
  <img src="assets/agentak.svg" alt="" width="104" height="104">
</p>

<h1 align="center">Agentak</h1>

<p align="center">
  Add an AI chat to any web page with one component.
</p>

- 🧩 **One component and one session.** `<AgentakChat session={…} />` gives you the full
  chat, including provider settings, styles, and tools.
- ⚡ **Works with React, Vue, Preact, or plain JavaScript.** Use the package for your
  framework, or call `mount()` on an element. You can also load it from a CDN.
- 🎨 **No stylesheet to import.** Components use inline styles, and the wrappers add the
  theme variables for you.
- 🔄 **Bring your own agent if you want.** The chat takes a `ChatSession`. You can use the
  included Pi agent or connect the UI to your own agent.
- 🔌 **Choose from 9 providers:** OpenAI, Groq, Cerebras, OpenRouter, Vercel AI Gateway,
  LLM7, OVHcloud, Kilo, and OpenCode Zen.
- 🚀 **Start chatting right away.** The message box includes the provider, model, and API
  key settings. If you have not chosen a provider, your first message opens the picker.
- 🧰 **Add your own tools.** The agent ships with none. Pass `tools` to give it the
  actions your app needs.
- 💬 **Includes streaming, tool approvals, Markdown, code blocks, and queued messages.**
- 🔒 **Your API keys are stored locally.** They are saved in `localStorage` and sent
  directly to the provider. You do not need your own server.
- 🌗 **Supports light and dark themes.** You can change the theme with CSS custom
  properties.
- 🧭 **Includes a Chrome side panel.** The MV3 extension gives you the same chat on every
  tab.

## 📦 Install

```sh
npx nypm i agentak
```

---

## 🚀 Quick start

```html
<div id="chat" style="height: 600px"></div>

<script type="module">
  // The chat UI
  import { mount } from "https://esm.sh/agentak";

  // The included Pi agent
  import { createPiSession } from "https://esm.sh/agentak/pi";

  mount("#chat", { session: createPiSession() });
</script>
```

That is all you need. When the user sends the first message, Agentak asks them to choose a
provider if they have not chosen one before. Free providers need no API key. Agentak
remembers the provider, model, and key for the next visit.

---

## 💬 Chat component

Agentak provides a component for React, Vue, and Preact. It also works without a
framework. The component handles the UI and styles, while the required `session` prop
runs the conversation.

### ⚛️ React

```tsx
import { useEffect, useMemo } from "react";
import { AgentakChat } from "agentak/react";
import { createPiSession } from "agentak/pi";

export function Assistant() {
  const session = useMemo(() => createPiSession(), []);
  useEffect(() => () => session.dispose(), [session]);

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

`target` can be a CSS selector or an element. `props` accepts every
[`AgentChat` prop](#agentchat). You can also pass `tokens: false` if your page already
provides the CSS variables.

`mount()` adds the CSS variables, prepares the target element, and renders the chat. Make
sure the target has a height because the chat fills the available space.

It returns `{ update, unmount }`. Use `update(props)` to apply new props without losing the
conversation. Use `unmount()` to clear the target element. Neither method ends the
session, so you must dispose of a session that you created.

### Props

`AgentakChat` accepts the same props in React, Vue, and Preact:

| Prop                  | Type            | Description                                                    |
| --------------------- | --------------- | -------------------------------------------------------------- |
| `session`             | `ChatSession`   | Runs the chat. **Required**                                    |
| `generateTitle`       | `boolean`       | Asks the model to name the conversation. Uses one request      |
| `tokens`              | `boolean`       | Set to `false` if your page already provides the CSS variables |
| `actions`             | Preact children | Adds buttons to the end of the header                          |
| `emptyActions`        | Preact children | Adds content below the greeting                                |
| `class` / `className` | `string`        | Adds a class to the element around the chat                    |
| `style`               | style object    | Styles the element around the chat. Give it a height           |

Use `class` with Vue and `className` with React or Preact. Vue also accepts `style`. These
props are added to the one wrapper element around the chat.

#### `AgentChat`

Import `AgentChat` from `agentak` when you want the chat UI without the wrapper element.
This is useful in a Preact layout that already controls the size of its children.

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

`AgentChat` accepts `session`, `generateTitle`, `actions`, `emptyActions`, `className`, and
`style`. It does not accept `tokens` because that prop belongs to the framework wrappers.
If you use `AgentChat` directly, call `injectTokens()` from `agentak` yourself.

### Notes

- **Dispose of sessions that you create.** The wrappers do not call `dispose()` because
  they do not create the session.
- **One session represents one conversation.** The user can change the provider, model,
  key, and thinking level without losing that conversation. To support several
  conversations, create several sessions and switch the `session` prop.
- **The chat UI uses Preact in every framework.** The React and Vue wrappers each provide
  a `<div>` for Preact to render into. This means `actions` and `emptyActions` must be
  Preact children. Create them with Preact's `h()`, or leave them out.
- **You can change `generateTitle` without creating a new session.** It is a component
  prop, so changing it keeps the current conversation.

---

## 🤖 Pi agent

`agentak/pi` provides the included agent. It combines
[pi-agent-core](https://www.npmjs.com/package/@earendil-works/pi-agent-core), your tools,
and the provider picker. This is the only Agentak import that includes an agent loop.

```ts
import { createPiSession } from "agentak/pi";

const session = createPiSession();

// Mount the chat with this session.
session.dispose();
```

Call `createPiSession()` with no options to let the user choose a provider in the chat.
Free providers take one click and do not need an API key. Agentak saves provider settings
in `localStorage`. You can also choose the provider and key in code:

```ts
const session = createPiSession({
  provider: "openai",
  apiKey: "sk-…",
  systemPrompt: "You are a support agent for example.com. Keep answers short.",
  approvals: "never",
});
```

### Options

| Option          | Type                                                      | Description                                                             |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `provider`      | `string`                                                  | Provider to open. Uses the saved provider by default                    |
| `apiKey`        | `string \| Record<string, string>`                        | One key, or a key for each provider. Free providers need no key         |
| `generateTitle` | `boolean`                                                 | Lets the model name the conversation instead of using the first message |
| `thinkingLevel` | `off \| minimal \| low \| medium \| high \| xhigh \| max` | Starting thinking level. Defaults to `off`                              |
| `systemPrompt`  | `string`                                                  | Instructions for the agent. Defaults to a short browsing prompt         |
| `tools`         | `AgentTool[]`                                             | Agent tools. Empty by default                                           |
| `approvals`     | `"always" \| "once" \| "never"`                           | When to confirm tool calls. Defaults to once for each tool              |
| `streamFn`      | `StreamFn`                                                | Custom streaming function, mainly useful in tests                       |

`createPiSession()` returns a `PiSession`, which is a `ChatSession` with a `dispose()`
method. Create it once, outside your render function, and dispose of it when the
conversation is no longer needed.

### Providers

| Provider                           | API key  | API                |
| ---------------------------------- | -------- | ------------------ |
| LLM7, Kilo, OVHcloud, OpenCode Zen | Free     | openai-completions |
| Vercel AI Gateway, OpenRouter      | Required | Depends on model   |
| OpenAI                             | Required | openai-responses   |
| Groq, Cerebras                     | Required | openai-completions |

Agentak saves a separate key for each provider. When the user returns to a provider they
have already set up, Agentak does not ask for the key again. Keys are sent directly from
the browser to the provider.

Kilo and OpenCode Zen do not support CORS preflight requests. For that reason, regular web
pages can use 7 providers, while the Chrome side panel can use all 9. Agentak only loads a
provider's model list after the user chooses that provider. It also waits until the first
request to load the provider's API code.

### Tools

Agentak includes no tools. The agent answers from the conversation alone until you pass
some. A tool is a pi `AgentTool`: a name, a description, a TypeBox schema, and an
`execute()`.

```ts
import { Type } from "typebox";

const session = createPiSession({
  tools: [
    {
      name: "read_page",
      label: "Read the page",
      description: "Read the visible text of the current page.",
      parameters: Type.Object({}, { additionalProperties: false }),
      execute: () => {
        const text = document.body.innerText;
        return Promise.resolve({ content: [{ type: "text", text }], details: undefined });
      },
    },
  ],
});
```

The chat confirms every tool call. Use the `approvals` option to change how often it
asks.

### Lower-level APIs

`createPiSession()` gives you the full agent setup in one object. You can also use the
lower-level exports:

```ts
import { createAgent, useAgent, createAgentStore } from "agentak/pi";
```

`createAgent()` returns the Pi `Agent` and its approval handler. `createAgentStore()` turns
agent events into chat state. `useAgent()` provides the same state as a Preact hook when
you want to render `Chat` yourself.

---

## 🔧 Custom agents

The chat UI does not depend on a specific agent runtime. If you provide your own
`ChatSession`, the included Pi agent is not loaded. Only `agentak/pi` includes it.

```tsx
import { AgentChat, type ChatSession, type ChatSnapshot } from "agentak";

const listeners = new Set<() => void>();
let snapshot: ChatSnapshot = { isStreaming: false, messages: [] };

const session: ChatSession = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  // Return the same object until the state changes.
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

// Render the same chat UI with your session. The Pi agent is not loaded.
<AgentChat session={session} />;
```

The framework wrappers accept the same session object and do not load an agent loop. For
example, `agentak/react` can use your session without importing any Pi modules.

### Required methods

A session only needs five methods: `subscribe`, `snapshot`, `send`, `stop`, and `reset`.

Follow these two rules:

1. **Keep `snapshot()` fast and stable.** Return the same object until the session changes.
   Create a new object before you notify subscribers. The chat reads the snapshot more
   than once during a render.
2. **Call subscribers after the state changes.**

### Optional methods

Leave out any feature that your session does not support. Agentak will hide the related UI.

| Method             | What it enables                                    |
| ------------------ | -------------------------------------------------- |
| `respondToTool`    | Approve or deny a tool call and provide a reason   |
| `dequeue`          | Remove a message that is waiting                   |
| `dismissError`     | Close the error message                            |
| `retry`            | Run the failed request again                       |
| `selectProvider`   | Choose a provider                                  |
| `selectModel`      | Choose a model                                     |
| `setThinkingLevel` | Choose the thinking level for the current model    |
| `saveKey`          | Save an API key                                    |
| `setPickerOpen`    | Let the session control whether the picker is open |
| `setOptions`       | Receive `generateTitle` changes from the component |

`dispose` is not part of `ChatSession` because Agentak never calls it. The code that
creates a session is responsible for cleaning it up. The included `createPiSession()`
returns a session with a `dispose()` method.

### Snapshot fields

Every snapshot needs `messages` and `isStreaming`. The other fields are optional. Add them
to enable more parts of the UI:

`error`, `title`, `agent`, `usage`, `queued`, `providers`, `providerId`, `providerLabel`,
`models`, `modelsLoading`, `modelId`, `thinkingLevel`, `thinkingLevels`, and `pickerOpen`.

If you leave out `providers`, the picker shows one model list with `providerLabel` as its
heading. If you leave out `usage`, the chat does not show a context meter. Your session
sets `usage.nearLimit`, so it also decides when that meter turns amber.

Some fields and methods belong together:

- `models` and `selectModel`
- `providers` and `selectProvider`
- `queued` and `dequeue`
- `thinkingLevels` and `setThinkingLevel`

Provide both parts of a pair. A field without its method shows a choice the user cannot
make, while a method without its field is never called.

If your session implements `setPickerOpen`, it must also return `pickerOpen` in the
snapshot. The session then controls whether the picker is open.

`ChatSnapshot` is based on the props for `Chat`. TypeScript will report an error if the UI
and session contract no longer match.
