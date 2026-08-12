/**
 * WIP side panel entry. Registering the element mounts `<web-agent>`.
 *
 * Next step: build a `PageBridge` that proxies `readPage`/`findElements` into the
 * active tab with `chrome.scripting.executeScript`, and pass it to the agent.
 */
import { defineWebAgent } from "@/element";

defineWebAgent();
