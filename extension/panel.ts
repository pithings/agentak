/**
 * WIP side panel entry. Registering the element mounts `<agent-chat>`.
 *
 * The panel document is ours, not a host's, so this is where the `--*`
 * tokens are declared — the element itself injects nothing, and every `var()`
 * inside it resolves through inheritance, which crosses the shadow boundary.
 *
 * Next step: build a `PageBridge` that proxies `readPage`/`findElements` into the
 * active tab with `chrome.scripting.executeScript`, and pass it as `page` below —
 * the session is where the panel differs from a page, and the only place it does.
 * Keys from `chrome.storage` arrive the same way, as `apiKey`.
 */
import { createPiSession } from "@/agent/session";
import { defineAgentChat } from "@/element";
import { tokens } from "@/styles/base";

const style = document.createElement("style");
style.textContent = tokens;
document.head.append(style);

defineAgentChat({ session: () => createPiSession() });
