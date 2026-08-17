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
import { originHistory } from "./history.ts";
import { chromeStorage } from "./storage.ts";
import { activeOrigin, activeTabTools } from "./tab-tools.ts";
import { followColorScheme, useSystemColors } from "./theme.ts";

// Before the session, because a provider picked on the first frame loads its
// catalog at once. The default source is a url this document may not import.
useBundledCatalogs();

// Before the first paint, so the panel never opens light and then turns dark.
// The library ships both palettes and the host says which is on; the browser
// then says what its own document colours are, which is the nearest thing to
// the shell this panel is docked in.
followColorScheme();
useSystemColors();

// The store is read before anything mounts: `PiStorage` answers synchronously,
// and the session reads the provider, the model and the key while it is being
// made. Mounting first would show a chat that has forgotten every choice, then
// change it under the reader.
//
// One session for the life of the panel, which is the life of the document. It
// keeps its conversations in that same store, so the panel opens on a new chat
// and lists what came before on its own history page — this site's own, and not
// every site's. The origin is read beside the store and for the same reason: a
// history answers synchronously and `chrome.tabs` does not.
//
// `page` is the one thing the panel passes that a page does not: its own
// document carries no tools, so the source reads the tab in front instead.
void Promise.all([chromeStorage(), activeOrigin()]).then(([storage, origin]) => {
  const history = originHistory(storage, origin);
  const session = createPiSession({ history, page: activeTabTools(), storage });
  // The panel outlives the tab it was opened from, so the chat follows the site
  // in front: another site is another shelf, and another conversation.
  history.follow(session);

  render(
    <ChatPanel
      // The panel is the whole document, and it was opened to be typed in:
      // nothing else here wants the caret, so the composer takes it at once.
      autoFocus
      session={session}
      style={u.fill}
    />,
    document.querySelector("#root")!,
  );
});
