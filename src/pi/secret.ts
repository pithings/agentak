// Docs: @docs/4.agents/2.pi-agent/6.storage-and-api-keys.md
/**
 * The secrets in a store, sealed — so what `localStorage` holds is ciphertext
 * and what it is read with is a key no script can copy out.
 *
 * A key in `localStorage` is a string any script on the origin can lift and
 * send somewhere. WebCrypto cannot take that away — a script that runs here can
 * still ask this layer to decrypt — but it can take away the part that outlives
 * the visit: the AES key is generated `extractable: false` and kept in
 * IndexedDB, so it is usable and not readable. `crypto.subtle.exportKey` throws
 * on it, `structuredClone` of it carries no bytes, and a dump of the origin's
 * storage carries the ciphertext without the means to open it. What is worth
 * hiding is hidden; the rest — the provider, the model, the level, the
 * conversations — stays plain, because reading it back must not wait on
 * anything and there is nothing in it to steal.
 *
 * The seam is one wrapper over any `PiStorage`. `browserStorage()` puts it on
 * itself; a host with a store of its own wraps it the same way.
 */
import type { PiStorage } from "./storage.ts";

/** What a sealed value starts with. Anything else was written in the clear. */
const MARK = "agentak-enc1:";

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;

const DB_NAME = "agentak";
const DB_STORE = "crypto";
/** One key for the origin, under one name. Nothing else lives in that store. */
const DB_RECORD = "secret-key";

/**
 * Which names hold a secret: one API key per provider, and nothing else the
 * picker writes. `chat:` transcripts and `chats` are not secrets — they are the
 * conversation the person is already looking at.
 */
export const isSecret = (name: string): boolean => name.startsWith("api-key:");

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(text), (character) => character.charCodeAt(0));

/** A `CryptoKey` from another realm is still one. The name is what says so. */
const isCryptoKey = (value: unknown): value is CryptoKey =>
  typeof value === "object" &&
  value !== null &&
  "algorithm" in value &&
  "type" in value &&
  "usages" in value;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB is closed here."));
    // A blocked open is one an older version of this page is holding. It never
    // answers, so it is answered here rather than left hanging.
    request.onblocked = () => reject(new Error("IndexedDB is blocked here."));
  });
}

/**
 * The origin's key: the one already stored, or `fresh` put there now.
 *
 * Read and write in one `readwrite` transaction, because two documents of the
 * same origin open at once each generate a key and only one may win. IndexedDB
 * runs those transactions one after the other, so the second sees what the
 * first wrote and drops its own — without that, one tab seals with a key the
 * other overwrote and both read back nothing.
 *
 * `fresh` is generated before the transaction opens: a transaction commits as
 * soon as it runs out of requests to make, and `generateKey` is a wait it
 * would not survive.
 */
function keyIn(database: IDBDatabase, fresh: CryptoKey): Promise<CryptoKey> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DB_STORE, "readwrite");
    const store = transaction.objectStore(DB_STORE);
    const read = store.get(DB_RECORD);
    let held: CryptoKey | undefined;

    read.onsuccess = () => {
      if (isCryptoKey(read.result)) {
        held = read.result;
        return;
      }
      store.put(fresh, DB_RECORD);
    };
    // Resolved on the commit and not on the write: a key that did not land is
    // one the next visit does not have, and a value sealed with it is lost.
    transaction.oncomplete = () => resolve(held ?? fresh);
    transaction.onabort = transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB refused the key."));
  });
}

/**
 * The key, asked for once and held as a promise — every value on the page is
 * read and written with the same one.
 *
 * It rejects where the browser has no WebCrypto or no IndexedDB: an insecure
 * origin has no `crypto.subtle`, and a browser mode without IndexedDB has
 * nowhere to keep a key that a reload can still use. Neither is a failure the
 * chat shows — a secret is simply one this browser does not keep. It is the
 * caller's to swallow, which is what `createChoices` already does with a write.
 */
function holdKey(): () => Promise<CryptoKey> {
  let asked: Promise<CryptoKey> | undefined;

  const ask = async (): Promise<CryptoKey> => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle || !globalThis.indexedDB) {
      throw new Error("No WebCrypto or no IndexedDB: a secret is not stored here.");
    }
    const fresh = await subtle.generateKey({ name: ALGORITHM, length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    const database = await openDatabase();
    try {
      return await keyIn(database, fresh);
    } finally {
      database.close();
    }
  };

  return () => {
    // A rejection is not held: a browser that answered nothing this time is
    // asked again on the next write, rather than refusing for the whole visit.
    asked ??= ask().catch((failure: unknown) => {
      asked = undefined;
      throw failure;
    });
    return asked;
  };
}

async function seal(key: CryptoKey, value: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const body = await globalThis.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(value),
  );
  // One string: the nonce in front of what it opens, base64 for a store that
  // takes text alone.
  const both = new Uint8Array(IV_BYTES + body.byteLength);
  both.set(iv);
  both.set(new Uint8Array(body), IV_BYTES);
  return MARK + bytesToBase64(both);
}

async function unseal(key: CryptoKey, value: string): Promise<string | undefined> {
  try {
    const both = base64ToBytes(value.slice(MARK.length));
    const body = await globalThis.crypto.subtle.decrypt(
      { name: ALGORITHM, iv: both.subarray(0, IV_BYTES) },
      key,
      both.subarray(IV_BYTES),
    );
    return new TextDecoder().decode(body);
  } catch {
    // The key it was sealed with is gone — cleared with the site's data, or
    // written by a browser profile this one is not. The value cannot be read
    // and is not one, so it reads back as nothing and the next write replaces it.
    return undefined;
  }
}

/**
 * A store whose secrets are sealed, and whose other values are not.
 *
 * `secret` decides which is which, by name. The default is the picker's own —
 * `api-key:*` — and a host that keeps something else worth sealing in the same
 * store passes a wider test.
 */
export function encryptedStorage(
  inner: PiStorage,
  secret: (name: string) => boolean = isSecret,
): PiStorage {
  const key = holdKey();

  const sealInto = async (name: string, value: string) =>
    inner.set(name, await seal(await key(), value));

  return {
    async get(name) {
      const stored = await inner.get(name);
      if (!stored || !secret(name)) return stored;

      if (!stored.startsWith(MARK)) {
        // A key written before this build, or by a host that stored one itself.
        // It is handed back as it is and sealed behind the reader, so the plain
        // copy leaves the browser on the first read rather than on the next
        // write. A browser that cannot seal keeps what it has.
        void sealInto(name, stored).catch(() => {});
        return stored;
      }
      return unseal(await key(), stored);
    },

    async set(name, value) {
      // An empty value is what a store without `remove` drops one with. There
      // is nothing in it to hide, and sealing it would make it read back as a
      // key of no characters instead of as nothing at all.
      if (!value || !secret(name)) return inner.set(name, value);
      return sealInto(name, value);
    },

    // Passed through and not written over: a store that answers no `remove`
    // must still answer none, so its caller drops a value the other way.
    remove: inner.remove && ((name) => inner.remove?.(name) ?? Promise.resolve()),
  };
}
