/**
 * Where the panel keeps the keys, the choices and the conversations.
 *
 * `chrome.storage.local` and not `localStorage`: it is the store an extension is
 * meant to use, it survives what clearing browsing data takes away, and it is
 * one area per extension rather than one per document — so two side panels, in
 * two windows, are looking at the same keys.
 *
 * `PiStorage` reads synchronously and `chrome.storage` does not, so the area is
 * read once, in full, before the panel mounts. After that the map is the
 * answer and every write goes both places: into the map, which is what the next
 * read sees, and out to the area, which nobody waits for. A write that fails is
 * a value that lives as long as the panel does, which is what a page whose
 * storage is denied already gets.
 *
 * No prefix on the names. The area belongs to this extension alone, unlike the
 * `localStorage` of a host page that a chat is only a guest in.
 */
import type { PiStorage } from "@/pi/storage.ts";

/** Everything the area holds, then a store over it. Await before mounting. */
export async function chromeStorage(): Promise<PiStorage> {
  const values = new Map<string, string>();

  // Guarded whole: a panel that cannot reach its area still has to open. It
  // then forgets on close, which is what a page with denied storage gets.
  try {
    for (const [name, value] of Object.entries(await chrome.storage.local.get(null))) {
      if (typeof value === "string") values.set(name, value);
    }

    // The other window's panel writes to the same area. Hearing it keeps a key
    // typed there from being unknown here.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      for (const [name, change] of Object.entries(changes)) {
        if (typeof change.newValue === "string") values.set(name, change.newValue);
        else values.delete(name);
      }
    });
  } catch {
    // Nothing stored, then.
  }

  return {
    get: (name) => values.get(name),

    set(name, value) {
      values.set(name, value);
      void chrome.storage.local.set({ [name]: value }).catch(() => {});
    },

    remove(name) {
      values.delete(name);
      void chrome.storage.local.remove(name).catch(() => {});
    },
  };
}
