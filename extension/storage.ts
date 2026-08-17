// Docs: @docs/7.extension.md
/**
 * Where the panel keeps the keys, the choices and the conversations.
 *
 * `chrome.storage.local` and not `localStorage`: it is the store an extension is
 * meant to use, it survives what clearing browsing data takes away, and it is
 * one area per extension rather than one per document — so two side panels, in
 * two windows, are looking at the same keys.
 *
 * The area is read and written as it is, with nothing kept in front of it: a
 * `PiStorage` answers with promises and so does `chrome.storage`. What the panel
 * used to hold in a map is what the session holds anyway, and the map was the
 * one thing that could lie — it read back a transcript the area had refused for
 * want of room, and the history learns a store is full by reading a write back.
 * Now a full area rejects, which is the answer the history is looking for. A
 * write that fails for any other reason is a value that lives as long as the
 * panel does, which is what a page whose storage is denied already gets.
 *
 * No prefix on the names. The area belongs to this extension alone, unlike the
 * `localStorage` of a host page that a chat is only a guest in.
 */
import type { PiStorage } from "@/pi/storage.ts";

export function chromeStorage(): PiStorage {
  return {
    async get(name) {
      try {
        const value: unknown = (await chrome.storage.local.get(name))[name];
        return typeof value === "string" ? value : undefined;
      } catch {
        // A panel that cannot reach its area still has to open. It then forgets
        // on close, which is what a page with denied storage gets.
        return undefined;
      }
    },

    set: (name, value) => chrome.storage.local.set({ [name]: value }),

    remove: (name) => chrome.storage.local.remove(name),
  };
}
