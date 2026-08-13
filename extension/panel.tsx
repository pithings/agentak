/**
 * WIP side panel entry. Mounts the chat surface over the pi loop.
 *
 * The panel document is ours, not a host's, so this is where the `--*`
 * tokens are declared — the library injects nothing, and every `var()` inside it
 * resolves through inheritance.
 *
 * Next step: build a `PageBridge` that proxies `readPage`/`findElements` into the
 * active tab with `chrome.scripting.executeScript`, and pass it as `page` below —
 * the session is where the panel differs from a page, and the only place it does.
 * Keys from `chrome.storage` arrive the same way, as `apiKey`.
 */
import { render } from "preact";

import { AgentChat } from "@/agent-chat";
import { createPiSession } from "@/agent/session";
import { tokens, u } from "@/styles/base";

const style = document.createElement("style");
style.textContent = tokens;
document.head.append(style);

// One session for the life of the panel, which is the life of the document.
render(<AgentChat session={createPiSession()} style={u.fill} />, document.querySelector("#root")!);
