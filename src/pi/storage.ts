/**
 * Where the picker keeps the keys, the provider, the model and the level.
 *
 * Nothing reaches the browser on its own. The default store is memory, so the
 * choices live as long as the page does and go with it. One store serves every
 * session on the page, which is what makes a key typed in one conversation
 * answer in the next.
 *
 * A host that wants them to outlive a reload passes a store of its own through
 * the `storage` option — `browserStorage()` for `localStorage`, or an object
 * that reads and writes wherever the host keeps things.
 */
export interface PiStorage {
  get(name: string): string | undefined;
  /**
   * Put a value in. A store that lands the write itself returns nothing, and a
   * store that only sends it off returns a promise that rejects when it did not
   * land — `chrome.storage` is the second kind. Nothing waits for it except the
   * history, which gives up an older conversation when the store is full.
   */
  set(name: string, value: string): void | Promise<void>;
  /**
   * Take a value out. Optional, because a store of two methods is the whole of
   * what the picker needs — a conversation dropped from a store without it is
   * written empty instead, which reads back as nothing.
   */
  remove?(name: string): void;
}

const PREFIX = "agentak:";

/** A store that forgets: the choices last as long as the object does. */
export function memoryStorage(): PiStorage {
  const values = new Map<string, string>();
  return {
    get: (name) => values.get(name),
    set: (name, value) => {
      values.set(name, value);
    },
    remove: (name) => {
      values.delete(name);
    },
  };
}

/**
 * `localStorage`, for a host that asks for it. It throws rather than returns
 * null in a sandboxed frame, and a host page may deny it outright, so every
 * access is guarded and a failure means "nothing stored".
 */
export function browserStorage(): PiStorage {
  return {
    get(name) {
      try {
        return globalThis.localStorage?.getItem(PREFIX + name) ?? undefined;
      } catch {
        return undefined; // storage is denied here
      }
    },
    set(name, value) {
      try {
        globalThis.localStorage?.setItem(PREFIX + name, value);
      } catch {
        // Nothing to do: the value lives for this session only.
      }
    },
    remove(name) {
      try {
        globalThis.localStorage?.removeItem(PREFIX + name);
      } catch {
        // Nothing to do: it was never written.
      }
    },
  };
}

/** The default store, shared by every session that names none. */
export const pageStorage = memoryStorage();

/** The choices a store holds, named. */
export interface PiChoices {
  storedApiKey(provider: string): string | undefined;
  storeApiKey(provider: string, key: string): void;
  /** Take a key back out, so the browser holds it no longer. */
  forgetApiKey(provider: string): void;
  storedProviderId(): string | undefined;
  storeProviderId(id: string): void;
  storedModelId(provider: string): string | undefined;
  storeModelId(provider: string, id: string): void;
  storedThinkingLevel(provider: string, model: string): string | undefined;
  storeThinkingLevel(provider: string, model: string, level: string): void;
}

/**
 * The choices over a store. One key per provider, so switching back to one
 * already set up asks nothing.
 */
export function createChoices(storage: PiStorage = pageStorage): PiChoices {
  // A store need not answer `remove`, and an empty value reads back as nothing.
  const drop = (name: string) => {
    if (storage.remove) storage.remove(name);
    else storage.set(name, "");
  };

  return {
    storedApiKey: (provider) => storage.get(`api-key:${provider}`),
    storeApiKey: (provider, key) => storage.set(`api-key:${provider}`, key),
    forgetApiKey: (provider) => drop(`api-key:${provider}`),

    storedProviderId: () => storage.get("provider"),
    storeProviderId: (id) => storage.set("provider", id),

    storedModelId: (provider) => storage.get(`model:${provider}`),
    storeModelId: (provider, id) => storage.set(`model:${provider}`, id),

    // Per model, not per provider: one provider carries reasoning models beside
    // models that take no level at all.
    storedThinkingLevel: (provider, model) => storage.get(`thinking:${provider}:${model}`),
    storeThinkingLevel: (provider, model, level) =>
      storage.set(`thinking:${provider}:${model}`, level),
  };
}
