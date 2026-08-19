// Docs: @docs/4.agents/2.pi/6.storage-and-api-keys.md
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
import type { PiStorage } from "../storage.ts";
import { createVault, type SecretLock, type SecretVault, type VaultOptions } from "./vault.ts";

/**
 * What a sealed value starts with, and which key sealed it. Anything else was
 * written in the clear.
 *
 * The mark is the one thing a stored value says about itself, and it has to say
 * this much: the ciphertext of the two keys is the same ciphertext, so without
 * it a value nothing can ever open looks exactly like a value one touch would.
 * A chat reading the first as the second offers an unlock that does nothing.
 */
const MARKS = {
  /** The key this browser keeps for itself. */
  device: "agentak-enc1:",
  /** The key the device's own authenticator derives. */
  passkey: "agentak-enc2:",
} as const;

type SealKind = keyof typeof MARKS;

const KINDS = Object.keys(MARKS) as SealKind[];

const kindOf = (value: string): SealKind | undefined =>
  KINDS.find((kind) => value.startsWith(MARKS[kind]));

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

async function seal(key: CryptoKey, kind: SealKind, value: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const body = await globalThis.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(value),
  );
  // One string: the mark, then the nonce in front of what it opens, base64 for
  // a store that takes text alone.
  const both = new Uint8Array(IV_BYTES + body.byteLength);
  both.set(iv);
  both.set(new Uint8Array(body), IV_BYTES);
  return MARKS[kind] + bytesToBase64(both);
}

async function unseal(key: CryptoKey, kind: SealKind, value: string): Promise<string | undefined> {
  try {
    const both = base64ToBytes(value.slice(MARKS[kind].length));
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

/**
 * What stands between a caller and the value under a name.
 *
 * `open` — nothing does. The name may hold a value or nothing at all; `get()`
 * is what says which, and this only says that no key is in the way.
 * `locked` — sealed by the device's authenticator, which has not been asked
 * this visit. One ceremony reads it.
 * `stale` — sealed by a key this browser no longer has: the passkey was deleted
 * or its record cleared, or the device key was replaced when the lock went on.
 * Nothing will open it, so the answer is to store the secret again.
 */
export type SealedState = "open" | "locked" | "stale";

/** A store whose secrets are sealed, and the lock over the key that seals them. */
export interface SecretStorage extends PiStorage {
  lock: SecretLock;
  /**
   * What is in the way of this name — the difference between a key to unlock
   * for, a key to give up on, and no key at all.
   *
   * Read the mark rather than try the key, so this costs no ceremony and no
   * dialog. It is answered against the lock as it stands, so a caller asks it
   * after `lock.ready`: before that the browser has not said which key it holds
   * and every sealed value would read as one for the other.
   */
  sealed(name: string): Promise<SealedState>;
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

  /** Which key is sealing now. The key is awaited first, because asking for it
   * is what waits on the browser saying which one this origin holds. */
  const sealInto = async (name: string, value: string) => {
    const key = await vault.key();
    const kind: SealKind = vault.lock.state() === "off" ? "device" : "passkey";
    return inner.set(name, await seal(key, kind, value));
  };

  return {
    lock: vault.lock,

    async sealed(name) {
      if (!secret(name)) return "open";
      const stored = await inner.get(name).catch(() => undefined);
      const kind = stored ? kindOf(stored) : undefined;
      if (!kind) return "open"; // nothing here, or nothing sealed
      const state = vault.lock.state();
      // A value and a lock that do not name the same key: the one that sealed
      // it is gone, whichever way round they are. The passkey's key goes when
      // its record does, and the device's goes when the lock is turned on.
      if (kind === "device") return state === "off" ? "open" : "stale";
      return state === "off" ? "stale" : state;
    },

    async get(name) {
      const stored = await inner.get(name);
      if (!stored || !secret(name)) return stored;

      const kind = kindOf(stored);
      if (!kind) {
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
      return key && unseal(key, kind, stored);
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
