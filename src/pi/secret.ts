// Docs: @docs/4.agents/2.pi-agent/6.storage-and-api-keys.md
/**
 * The secrets in a store, sealed — so what `localStorage` holds is ciphertext
 * and what it is read with is a key no script can copy out.
 *
 * A key in `localStorage` is a string any script on the origin can lift and
 * send somewhere. WebCrypto cannot take that away — a script that runs here can
 * still ask this layer to decrypt — but it can take away the part that outlives
 * the visit: the AES key is never stored in a form anything can export, so a
 * dump of the origin's storage carries the ciphertext without the means to open
 * it. What is worth hiding is hidden; the rest — the provider, the model, the
 * level, the conversations — stays plain, because reading it back must not wait
 * on anything and there is nothing in it to steal.
 *
 * Where that key lives, and whether a person's finger is needed to have it, is
 * `vault.ts`. This file only seals and unseals with whatever it hands over.
 */
import type { PiStorage } from "./storage.ts";
import { createVault, type SecretLock, type SecretVault, type VaultOptions } from "./vault.ts";

/** What a sealed value starts with. Anything else was written in the clear. */
const MARK = "agentak-enc1:";

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;

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
    // replaced by turning the lock on. The value cannot be read and is not one,
    // so it reads back as nothing and the next write replaces it.
    return undefined;
  }
}

/** A store whose secrets are sealed, and the lock over the key that seals them. */
export interface SecretStorage extends PiStorage {
  lock: SecretLock;
  /**
   * Whether this name holds a sealed value. True even while the lock is shut and
   * the value cannot be read — which is how a caller tells a key it has to
   * unlock for from a key that was never stored.
   */
  sealed(name: string): Promise<boolean>;
}

export interface SecretStorageOptions extends VaultOptions {
  /**
   * Which names hold a secret. The default is the picker's own — `api-key:*` —
   * and a host that keeps something else worth sealing in the same store passes
   * a wider test.
   */
  secret?: (name: string) => boolean;
  /** The key source. One is made where none is passed. */
  vault?: SecretVault;
}

/**
 * A store whose secrets are sealed, and whose other values are not.
 *
 * Everything the lock is shut for reads back as nothing: a caller asking for a
 * key it cannot have is told it does not have one, and `sealed()` is how it
 * learns the difference. Nothing here opens a dialog on its own — the ceremony
 * needs a click, so it belongs to whoever the person clicked.
 */
export function encryptedStorage(
  inner: PiStorage,
  options: SecretStorageOptions = {},
): SecretStorage {
  const secret = options.secret ?? isSecret;
  const vault = options.vault ?? createVault(options);

  const sealInto = async (name: string, value: string) =>
    inner.set(name, await seal(await vault.key(), value));

  return {
    lock: vault.lock,

    async sealed(name) {
      if (!secret(name)) return false;
      const stored = await inner.get(name).catch(() => undefined);
      return stored?.startsWith(MARK) === true;
    },

    async get(name) {
      const stored = await inner.get(name);
      if (!stored || !secret(name)) return stored;

      if (!stored.startsWith(MARK)) {
        // A key written before this build, or by a host that stored one itself.
        // It is handed back as it is and sealed behind the reader, so the plain
        // copy leaves the browser on the first read rather than on the next
        // write. A browser that cannot seal — or a lock that is shut — keeps
        // what it has.
        void sealInto(name, stored).catch(() => {});
        return stored;
      }
      // A shut lock has no key to give, which reads back as the same nothing a
      // value this browser never held does — `sealed()` is what tells the two
      // apart. The chat asks the person to unlock; it does not ask the
      // authenticator behind their back.
      const key = await vault.key().catch(() => undefined);
      return key && unseal(key, stored);
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

/** Whether a store seals what it holds, and so has a lock worth showing. */
export const isSecretStorage = (storage: PiStorage): storage is SecretStorage =>
  typeof (storage as SecretStorage).sealed === "function" &&
  typeof (storage as SecretStorage).lock === "object";
