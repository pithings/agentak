/**
 * WIP side panel entry. Registering the element mounts `<web-agent>`.
 *
 * The panel document is ours, not a host's, so this is where the `--wa-*`
 * tokens are declared — the element itself injects nothing, and every `var()`
 * inside it resolves through inheritance, which crosses the shadow boundary.
 *
 * Next step: build a `PageBridge` that proxies `readPage`/`findElements` into the
 * active tab with `chrome.scripting.executeScript`, and pass it to the agent.
 */
import { defineWebAgent } from "@/element";
import { tokens } from "@/styles/base";

const style = document.createElement("style");
style.textContent = tokens;
document.head.append(style);

defineWebAgent();
