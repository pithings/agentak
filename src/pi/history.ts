import { type PiSnapshot, readPiSnapshot } from "./snapshot.ts";
import { pageStorage, type PiStorage } from "./storage.ts";

/**
 * The conversations a session has had, in whatever store it keeps its choices.
 *
 * `save()` and the `snapshot` option are still the seam for a host that keeps
 * its own — a server, an account, a store the library knows nothing about. This
 * is the built-in answer for a host that would rather not: the session lists
 * what it has stored and opens one in place, so the chat grows a history page
 * without a line of host code. Which store it lands in is the host's choice all
 * the same: memory by default, `browserStorage()` for `localStorage`.
 *
 * Two keys, not one: an index of what exists, and one entry per conversation.
 * The page reads the index alone, so listing never parses a transcript, and one
 * conversation is dropped by its own key rather than by rewriting the rest.
 */
export interface PiHistoryEntry {
  id: string;
  /** What the list calls it — the model's title, or the first message. */
  title: string;
  /** When it was last written. The newest heads the list. */
  updated: number;
}

export interface PiHistory {
  /** Newest first. The same array until something changes it. */
  list(): PiHistoryEntry[];
  /** One transcript, if the shape is still one this build reads. */
  read(id: string): PiSnapshot | undefined;
  /** Write one under its id. An empty conversation is not kept. */
  keep(id: string, snapshot: PiSnapshot, title: string): void;
  forget(id: string): void;
}

const INDEX = "chats";
const entryKey = (id: string) => `chat:${id}`;

/** How many are kept. Past this the oldest goes, whatever the store allows. */
const LIMIT = 20;

/** A conversation's own name, minted when the session moves on to a new one. */
export const mintConversationId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `c${Date.now().toString(36)}${Math.random().toString(36)}`;

const isEntry = (value: unknown): value is PiHistoryEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as PiHistoryEntry).id === "string" &&
  typeof (value as PiHistoryEntry).title === "string" &&
  typeof (value as PiHistoryEntry).updated === "number";

/**
 * The conversations over a `PiStorage`.
 *
 * The default store is the page's memory, which is what makes this cost a host
 * nothing to turn on and lose everything on a reload — `browserStorage()` is
 * the one line that changes that, and it is the host's to write.
 */
export function createHistory(storage: PiStorage = pageStorage, limit = LIMIT): PiHistory {
  /**
   * Held rather than re-read: the page asks for the list on every redraw, and
   * the array is a snapshot field, so a fresh one each read would redraw the
   * list under the reader. One store shared by two sessions is the host's to
   * think about, exactly as the keys already are.
   */
  let items = storedIndex();

  function storedIndex(): PiHistoryEntry[] {
    const raw = storage.get(INDEX);
    if (!raw) return [];
    try {
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value) ? value.filter(isEntry) : [];
    } catch {
      return []; // a shape from another build, or a hand-edited one
    }
  }

  const writeIndex = () => storage.set(INDEX, JSON.stringify(items));

  // A store need not answer `remove`, and an empty value reads back as nothing.
  const drop = (name: string) => {
    if (storage.remove) storage.remove(name);
    else storage.set(name, "");
  };

  const forget = (id: string) => {
    items = items.filter((entry) => entry.id !== id);
    drop(entryKey(id));
    writeIndex();
  };

  /**
   * Write one transcript, giving up older ones until it fits.
   *
   * `set` reports nothing — `localStorage` throws when it is full, and
   * `browserStorage()` swallows it — so the write is read back. A long
   * conversation with tool output in it is not small, the oldest conversation is
   * the cheapest thing to give up, and with nothing left to give up the write
   * was never going to land.
   */
  function put(id: string, json: string): boolean {
    storage.set(entryKey(id), json);
    while (storage.get(entryKey(id))?.length !== json.length) {
      const oldest = items.filter((entry) => entry.id !== id).at(-1);
      if (!oldest) return false;
      forget(oldest.id);
      storage.set(entryKey(id), json);
    }
    return true;
  }

  return {
    list: () => items,

    read(id) {
      const raw = storage.get(entryKey(id));
      if (!raw) return undefined;
      try {
        return readPiSnapshot(JSON.parse(raw));
      } catch {
        return undefined;
      }
    },

    keep(id, snapshot, title) {
      // Nothing to come back to: a session that was reset holds no conversation,
      // and the one it held is already stored under its own id.
      if (snapshot.messages.length === 0) return;

      items = [{ id, title, updated: Date.now() }, ...items.filter((entry) => entry.id !== id)];
      for (const gone of items.slice(limit)) forget(gone.id);

      if (put(id, JSON.stringify(snapshot))) writeIndex();
      else forget(id);
    },

    forget,
  };
}
