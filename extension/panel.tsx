/**
 * WIP side panel entry. Mounts the chat surface over the pi loop.
 *
 * `AgentakChat` from `agentak/preact` is the surface in a box, and it declares
 * the `--*` tokens — the panel document is ours rather than a host's, so nothing
 * else has to. It carries no loop: `createPiSession()` is the import that brings
 * one, and this is the only line here that knows about pi.
 *
 * Next step: keys from `chrome.storage` rather than `localStorage`, passed as
 * `apiKey` — the session is where the panel differs from a page, and the only
 * place it does.
 */
import { render } from "preact";

import { createPiSession } from "@/pi/session";
import { AgentakChat } from "@/preact";
import { u } from "@/styles/base";

// One session for the life of the panel, which is the life of the document.
render(
  <AgentakChat session={createPiSession()} style={u.fill} />,
  document.querySelector("#root")!,
);
