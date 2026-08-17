// Docs: @docs/4.agents/2.pi-agent/6.storage-and-api-keys.md
import { encryptedStorage, type SecretStorage, type SecretStorageOptions } from "./secret.ts";

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
 *
 * Every method answers with a promise, because most stores worth passing cannot
 * answer at once: `chrome.storage` and IndexedDB reply later, and a store that
 * encrypts what it holds waits on WebCrypto to read one value at all. So a
 * session opens on nothing and takes its choices a beat after —
 * `PiSession.ready` is the moment they are in hand.
 */
export interface PiStorage {
  get(name: string): Promise<string | undefined>;
  /**
   * Put a value in. The promise rejects where the write did not land — a full
   * `chrome.storage` is the one that does. Nothing waits for it except the
   * history, which gives up an older conversation when the store is full.
   */
  set(name: string, value: string): Promise<void>;
  /**
   * Take a value out. Optional, because a store of two methods is the whole of
   * what the picker needs — a conversation dropped from a store without it is
   * written empty instead, which reads back as nothing.
   */
  remove?(name: string): Promise<void>;
}

const PREFIX = "agentak:";

/** A store that forgets: the choices last as long as the object does. */
export function memoryStorage(): PiStorage {
  const values = new Map<string, string>();
  return {
    get: (name) => Promise.resolve(values.get(name)),
    set: (name, value) => {
      values.set(name, value);
      return Promise.resolve();
    },
    remove: (name) => {
      values.delete(name);
      return Promise.resolve();
    },
  };
}

/**
 * `localStorage`, for a host that asks for it. It throws rather than returns
 * null in a sandboxed frame, and a host page may deny it outright, so every
 * access is guarded and a failure means "nothing stored".
 *
 * The keys in it are sealed and the rest of it is not — see `secret.ts`. A key
 * is the one thing here worth lifting off a device, and `localStorage` hands a
 * string to whatever script asks; the provider, the model, the level and the
 * conversations are the person's own reading and stay as they are.
 *
 * The store it returns carries `lock`, the seam the chat's settings page shows:
 * a person who asks puts the keys behind this device's own authenticator, and
 * the chat then unlocks them once per visit. See `vault.ts`.
 */
export function browserStorage(options: SecretStorageOptions = {}): SecretStorage {
  return encryptedStorage(plainBrowserStorage(), options);
}

/** The store under it: `localStorage`, guarded, with nothing sealed. */
function plainBrowserStorage(): PiStorage {
  return {
    // Each answers with a promise the api itself does not need, because that is
    // what a `PiStorage` is: a store that reads at once still reads later here.
    async get(name) {
      try {
        return globalThis.localStorage?.getItem(PREFIX + name) ?? undefined;
      } catch {
        return undefined; // storage is denied here
      }
    },
    async set(name, value) {
      try {
        globalThis.localStorage?.setItem(PREFIX + name, value);
      } catch {
        // Nothing to do: the value lives for this session only. A full store is
        // read back short instead, which is what the history looks for.
      }
    },
    async remove(name) {
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

/**
 * The choices a store holds, named. Every one of them answers with a promise,
 * because the store under it does.
 *
 * A write is one nobody waits for, so a write that did not land is swallowed
 * here rather than left as a rejection nothing handles: a choice the store
 * refused is one this browser forgets, which is what a page with denied storage
 * already gets.
 */
export interface PiChoices {
  storedApiKey(provider: string): Promise<string | undefined>;
  storeApiKey(provider: string, key: string): Promise<void>;
  /** Take a key back out, so the browser holds it no longer. */
  forgetApiKey(provider: string): Promise<void>;
  storedProviderId(): Promise<string | undefined>;
  storeProviderId(id: string): Promise<void>;
  storedModelId(provider: string): Promise<string | undefined>;
  storeModelId(provider: string, id: string): Promise<void>;
  storedThinkingLevel(provider: string, model: string): Promise<string | undefined>;
  storeThinkingLevel(provider: string, model: string, level: string): Promise<void>;
}

/**
 * The choices over a store. One key per provider, so switching back to one
 * already set up asks nothing.
 */
export function createChoices(storage: PiStorage = pageStorage): PiChoices {
  // A store need not answer `remove`, and an empty value reads back as nothing.
  const drop = (name: string) => (storage.remove ? storage.remove(name) : storage.set(name, ""));

  // A store that refuses a read holds nothing this session can use, and one
  // that refuses a write holds nothing after it. Neither is a failure the chat
  // shows: the choice is simply one this browser does not have.
  const read = (name: string) => storage.get(name).catch(() => undefined);
  const write = (done: Promise<void>) => done.catch(() => {});

  return {
    storedApiKey: (provider) => read(`api-key:${provider}`),
    storeApiKey: (provider, key) => write(storage.set(`api-key:${provider}`, key)),
    forgetApiKey: (provider) => write(drop(`api-key:${provider}`)),

    storedProviderId: () => read("provider"),
    storeProviderId: (id) => write(storage.set("provider", id)),

    storedModelId: (provider) => read(`model:${provider}`),
    storeModelId: (provider, id) => write(storage.set(`model:${provider}`, id)),

    // Per model, not per provider: one provider carries reasoning models beside
    // models that take no level at all.
    storedThinkingLevel: (provider, model) => read(`thinking:${provider}:${model}`),
    storeThinkingLevel: (provider, model, level) =>
      write(storage.set(`thinking:${provider}:${model}`, level)),
  };
}
