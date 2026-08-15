<p align="center">
  <img src="assets/agentak.svg" alt="" width="104" height="104">
</p>

<h1 align="center">Agentak</h1>

<p align="center">
  Add an AI chat to any web page with one component.
</p>

Agentak provides a complete chat UI for React, Vue, Preact, and plain JavaScript. Use the
included Pi agent or connect the UI to your own agent.

- Streams answers and renders Markdown and code blocks
- Supports tool calls, approvals, queued messages, and conversation restore
- Includes provider, model, thinking level, and API key controls
- Works with 9 AI providers, including free options that need no API key
- Uses inline styles, with light and dark themes
- Includes a Chrome MV3 side panel

## Install

```sh
npx nypm i agentak
```

## Quick start

```html
<div id="chat" style="height: 600px"></div>

<script type="module">
  import { mountChat } from "https://esm.sh/agentak";
  import { createPiSession } from "https://esm.sh/agentak/pi";

  const session = createPiSession();
  mountChat("#chat", { session });
</script>
```

When the user sends their first message, Agentak asks them to choose a provider if no
usable provider and model are already saved. Free providers need no API key. Keys entered
in the picker stay in the browser and are sent directly to the selected provider.

## Documentation

1. [Getting started](https://agentak.dev/getting-started)
2. [Chat components](https://agentak.dev/chat-components)
3. [Pi agent](https://agentak.dev/pi-agent)
4. [Save conversations](https://agentak.dev/conversations)
5. [Custom agents](https://agentak.dev/custom-agents)

The documentation includes setup examples for React, Vue, Preact, and plain JavaScript.
