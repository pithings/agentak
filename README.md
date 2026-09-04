<p align="center">
  <img src="assets/agentak.svg" alt="" width="104" height="104">
</p>

<h1 align="center">Agentak</h1>

<p align="center">
  Add browser-native AI chat and WebMCP tools to any web page.
</p>

Agentak provides a complete chat UI for React, Vue, Preact, and plain JavaScript. Use the
included Pi agent, let it discover tools published by the page through WebMCP, or connect
the UI to your own agent.

- Streams answers and renders Markdown and code blocks
- Discovers WebMCP tools from the page and follows tool changes
- Supports typed host tools, approvals, queued messages, and conversation restore
- Includes provider, model, thinking level, and API key controls
- Works with 8 AI providers, including free options that need no API key
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

  const session = createPiSession({ page: true });
  mountChat("#chat", { session });
</script>
```

When the user sends their first message, Agentak asks them to choose a provider if no
usable provider and model are already saved. Free providers need no API key. Keys entered
in the picker stay in the browser and are sent directly to the selected provider. Where a
host stores them in `localStorage`, they are encrypted with a non-extractable WebCrypto key.

## Side panel

The repository also builds a Chrome side panel over the same UI. It can read the active
page and discover the WebMCP tools that page publishes on `document.modelContext`.

```sh
pnpm build:extension
```

Open `chrome://extensions`, turn on developer mode, then load `extension/dist` unpacked.
Click the toolbar button to open the panel.

## Documentation

1. [Getting started](https://agentak.dev/getting-started)
2. [Chat components](https://agentak.dev/chat-components)
3. [Pi agent](https://agentak.dev/agents/pi)
4. [WebMCP page tools](https://agentak.dev/agents/pi/webmcp)
5. [Save conversations](https://agentak.dev/agents/pi/conversations)
6. [Custom agents](https://agentak.dev/agents/custom)

The documentation includes setup examples for React, Vue, Preact, and plain JavaScript.

## Credits

The chat components are a Preact port of [Vercel AI Elements](https://github.com/vercel/ai-elements).

## License

Published under the [MIT](./LICENSE) license.
