/**
 * WIP side panel entry. Mounts the chat surface over the pi loop.
 *
 * `ChatPanel` from `agentak/preact` is the surface in a box, and it declares
 * the `--*` tokens — the panel document is ours rather than a host's, so nothing
 * else has to. It carries no loop: `createPiSession()` is the import that brings
 * one, and this is the only line here that knows about pi.
 *
 * Next step: keys from `chrome.storage` rather than `localStorage`, passed as
 * `apiKey` in place of the `storage` store below — the session is where the
 * panel differs from a page, and the only place it does.
 */
import { render } from "preact";

import { createPiSession } from "@/pi/session.ts";
import { browserStorage } from "@/pi/storage.ts";
import { ChatPanel } from "@/preact/index.tsx";
import { u } from "@/styles/base.ts";

// One session for the life of the panel, which is the life of the document. The
// session forgets its choices with the document unless a host asks for more, and
// a panel that asked nothing would ask for the key every time it opens.
render(
  <ChatPanel session={createPiSession({ storage: browserStorage() })} style={u.fill} />,
  document.querySelector("#root")!,
);
