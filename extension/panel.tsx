/**
 * The side panel entry. Mounts the chat surface over the pi loop.
 *
 * `ChatPanel` from `agentak/preact` is the surface in a box, and it declares
 * the `--*` tokens — the panel document is ours rather than a host's, so nothing
 * else has to. It carries no loop: `createPiSession()` is the import that brings
 * one, and this is the only line here that knows about pi.
 *
 * The session is where the panel differs from a page, and nearly the only place
 * it does: the tools come from the tab in front rather than this document, the
 * catalogs are bundled rather than read from a url this document may not import,
 * and the keys are kept where an extension keeps things.
 */
import { render } from "preact";

import { createPiSession } from "@/pi/session.ts";
import { ChatPanel } from "@/preact/index.tsx";
import { u } from "@/styles/base.ts";
import { useBundledCatalogs } from "./catalogs.ts";
import { chromeStorage } from "./storage.ts";
import { activeTabTools } from "./tab-tools.ts";

// Before the session, because a provider picked on the first frame loads its
// catalog at once. The default source is a url this document may not import.
useBundledCatalogs();

// The store is read before anything mounts: `PiStorage` answers synchronously,
// and the session reads the provider, the model and the key while it is being
// made. Mounting first would show a chat that has forgotten every choice, then
// change it under the reader.
//
// One session for the life of the panel, which is the life of the document. It
// keeps its conversations in that same store, so the panel opens on the last one
// and lists the rest on its own history page.
//
// `page` is the one thing the panel passes that a page does not: its own
// document carries no tools, so the source reads the tab in front instead.
void chromeStorage().then((storage) => {
  render(
    <ChatPanel
      session={createPiSession({ history: true, page: activeTabTools(), storage })}
      style={u.fill}
    />,
    document.querySelector("#root")!,
  );
});
