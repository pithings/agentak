// Docs: @docs/7.extension.md
/**
 * The panel's conversations, one shelf per site.
 *
 * The keys, the provider and the model are one choice for the whole browser —
 * a key typed on one tab answers on the next, which is the point of an area
 * that belongs to the extension rather than to a document. The conversations
 * are not that. The panel reads the tab in front, so what was said is about the
 * site it was said on, and a list mixing every site a person visited is both
 * useless to read and more than the panel should show whoever is looking at the
 * screen now. So only the history is segmented, and it is segmented here rather
 * than in the store: `storage.ts` stays the one area, and each site gets its own
 * `PiHistory` over a slice of it.
 *
 * A shelf is a whole `createHistory()` over a `PiStorage` that renames every key
 * it is given. Nothing here knows what those keys are called, and the limit, the
 * eviction and the full-store retry are the library's own, unchanged. The count
 * they hold is per site, so twenty conversations on one site never push out the
 * one conversation on another.
 *
 * `follow()` is the other half: the panel outlives the tab it was opened from,
 * so the shelf in hand changes under it. A tab that comes forward on another
 * site moves the chat to that site's own newest conversation, or to a new one
 * where it has none. The conversation being left goes on being written to the
 * shelf it was had on — `owners` is what remembers that — so browsing away
 * mid-answer files nothing under the wrong site.
 */
import { createHistory, type PiHistory } from "@/pi/history.ts";
import type { PiSession } from "@/pi/session.ts";
import type { PiStorage } from "@/pi/storage.ts";

import { activeOrigin } from "./tab-tools.ts";

/** One site's slice of the area. The origin is in the name, and nothing else. */
function shelfStorage(storage: PiStorage, origin: string): PiStorage {
  const key = (name: string) => `history:${origin}/${name}`;
  const shelf: PiStorage = {
    get: (name) => storage.get(key(name)),
    set: (name, value) => storage.set(key(name), value),
  };
  // Answered only where the area answers it: a store without `remove` is one
  // the history writes an empty value to instead, and this must not hide that.
  const remove = storage.remove?.bind(storage);
  if (remove) shelf.remove = (name) => remove(key(name));
  return shelf;
}

export interface OriginHistory extends PiHistory {
  /**
   * Follow the tab in front, moving the chat with it. Call it once, with the
   * session this history was passed to. Returns the way to stop.
   */
  follow(session: PiSession): () => void;
}

/**
 * The conversations of whichever site is in front. Pass it as the `history`
 * option of `createPiSession()`, and give it the origin the panel opened on —
 * `activeOrigin()` — because a `PiHistory` lists synchronously and
 * `chrome.tabs` does not.
 */
export function originHistory(storage: PiStorage, origin: string): OriginHistory {
  const shelves = new Map<string, PiHistory>();
  /** Which shelf a conversation was filed on, for as long as this panel lives. */
  const owners = new Map<string, string>();
  let here = origin;
  /** Only the last tab change decides, where two land while one is being read. */
  let turn = 0;

  const shelf = (site: string): PiHistory => {
    let found = shelves.get(site);
    if (!found) {
      found = createHistory(shelfStorage(storage, site));
      shelves.set(site, found);
    }
    return found;
  };

  /** A conversation's own shelf: where it was written, else where we are now. */
  const shelfOf = (id: string) => shelf(owners.get(id) ?? here);

  return {
    // The shelf in front, because that is the list the panel opens on. Read
    // rather than held: another site's shelf is another wait, and `follow()`
    // does that one itself.
    get ready() {
      return shelf(here).ready;
    },

    list: () => shelf(here).list(),

    read: (id) => shelfOf(id).read(id),

    keep(id, snapshot, title) {
      // Bound on the first write and never moved. The session writes the
      // conversation it is leaving as part of moving off it, and by then the
      // tab in front is already the next site's.
      if (snapshot.messages.length > 0 && !owners.has(id)) owners.set(id, here);
      shelfOf(id).keep(id, snapshot, title);
    },

    forget(id) {
      shelfOf(id).forget(id);
      owners.delete(id);
    },

    follow(session) {
      const moved = async () => {
        const mine = ++turn;
        const site = await activeOrigin();
        if (mine !== turn || site === here) return;
        here = site;

        // A shelf reached for the first time reads its index out of the area,
        // and an unread shelf lists nothing — which would open a new
        // conversation on a site that already has some.
        const moving = shelf(site);
        await moving.ready;
        if (mine !== turn) return;

        // The transcript belongs to the site it was had on, so the panel moves
        // to this site's own: the newest conversation it holds, or a new one.
        // Both write the conversation being left first, so nothing is lost.
        const newest = moving.list()[0];
        if (newest && session.openConversation) session.openConversation(newest.id);
        else session.reset();
      };

      const changed = () => void moved();
      // A tab that navigates is a new site under the same tab. `url` is set on
      // that change alone, so a page that merely finished loading moves nothing.
      const updated = (_id: number, change: chrome.tabs.OnUpdatedInfo) => {
        if (change.url) void moved();
      };

      chrome.tabs.onActivated.addListener(changed);
      chrome.tabs.onUpdated.addListener(updated);

      return () => {
        chrome.tabs.onActivated.removeListener(changed);
        chrome.tabs.onUpdated.removeListener(updated);
      };
    },
  };
}
