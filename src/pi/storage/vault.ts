// Docs: @docs/4.agents/2.pi/6.storage-and-api-keys.md
/**
 * Where the key that seals the secrets is kept, and what it takes to have it.
 *
 * Two answers, and the second is the first one locked. **Device**: an AES-GCM
 * key generated `extractable: false` and left in IndexedDB, which the browser
 * hands back to this origin and to nothing else, silently, for as long as the
 * site's data lives. **Passkey**: no stored key at all — the bytes come from the
 * device's own authenticator, once per visit, with the person's finger in front
 * of it. See `passkey.ts`.
 *
 * The device key is the default because it costs the reader nothing and takes
 * the plaintext out of `localStorage`. The passkey is the one a person turns on,
 * and what it adds is the part software cannot: a key in a chip, asked for by a
 * human, rather than a key a script on this origin can use whenever it likes.
 *
 * Switching between them changes what values already sealed can be read with,
 * and nothing here can re-seal them: only the caller holds the secrets in the
 * clear. So a switch is followed by the caller writing every secret again —
 * `PiSession` does exactly that with the keys it has in memory.
 */
import {
  createPasskey,
  derivePasskey,
  type PasskeyOptions,
  type PasskeyRecord,
  passkeySupported,
} from "./passkey.ts";

const DB_NAME = "agentak";
const DB_STORE = "crypto";
/** The device key itself, and the credential the passkey key is asked for by. */
const DEVICE_RECORD = "secret-key";
const PASSKEY_RECORD = "passkey";

const ALGORITHM = "AES-GCM";

/**
 * `off` — the key is this browser's own and comes back without asking.
 * `locked` — a passkey holds it and this visit has not asked yet.
 * `open` — it was asked for, and the key is in memory until the tab goes.
 */
export type SecretLockState = "off" | "locked" | "open";

export interface SecretLock {
  /** Resolved once the browser has said which of the two it holds. */
  ready: Promise<void>;
  state(): SecretLockState;
  /** Told whenever `state()` changes. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Whether this browser can put the keys behind its own hardware at all. */
  supported(): Promise<boolean>;
  /**
   * Register a passkey and seal with it from now on. Needs a user gesture, and
   * leaves everything already sealed unreadable — the caller writes its secrets
   * again straight after.
   */
  enable(): Promise<void>;
  /** Ask the authenticator for the key. Needs a user gesture. */
  unlock(): Promise<void>;
  /**
   * Back to the device key. The lock must be open, because the caller can only
   * write its secrets again if it could read them in the first place.
   */
  disable(): Promise<void>;
}

export interface SecretVault {
  /** The key to seal and unseal with. Rejects while the lock is shut. */
  key(): Promise<CryptoKey>;
  lock: SecretLock;
}

export interface VaultOptions {
  /** How the passkey is named where the browser lists it. */
  passkey?: PasskeyOptions;
}

/** A `CryptoKey` from another realm is still one. The name is what says so. */
const isCryptoKey = (value: unknown): value is CryptoKey =>
  typeof value === "object" &&
  value !== null &&
  "algorithm" in value &&
  "type" in value &&
  "usages" in value;

/** A copy in this realm: what IndexedDB hands back is a view from another one. */
const bytes = (view: ArrayBufferView): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));

/**
 * The credential this browser holds, where it holds one. Read by shape rather
 * than by `instanceof`, because a store hands its values back as views of its
 * own — and copied, because the arrays go straight to WebAuthn afterwards.
 */
const toPasskeyRecord = (value: unknown): PasskeyRecord | undefined => {
  if (typeof value !== "object" || value === null) return undefined;
  const { credentialId, salt } = value as Record<string, unknown>;
  if (!ArrayBuffer.isView(credentialId) || !ArrayBuffer.isView(salt)) return undefined;
  return { credentialId: bytes(credentialId), salt: bytes(salt) };
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) throw new Error("This browser keeps no IndexedDB.");
    const request = globalThis.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB is closed here."));
    // A blocked open is one an older version of this page is holding. It never
    // answers, so it is answered here rather than left hanging.
    request.onblocked = () => reject(new Error("IndexedDB is blocked here."));
  });
}

/** One transaction, opened and closed around whatever it is for. */
async function inStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, mode);
      let value: T;
      run(transaction.objectStore(DB_STORE), (answer) => {
        value = answer;
      });
      // Resolved on the commit and not on the request: a write that did not
      // land is one the next visit does not have.
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("IndexedDB refused the write."));
    });
  } finally {
    database.close();
  }
}

const readRecord = (name: string): Promise<unknown> =>
  inStore<unknown>("readonly", (store, done) => {
    const request = store.get(name);
    request.onsuccess = () => done(request.result);
  });

const writeRecord = (name: string, value: unknown): Promise<void> =>
  inStore<void>("readwrite", (store) => {
    store.put(value, name);
  });

const dropRecord = (name: string): Promise<void> =>
  inStore<void>("readwrite", (store) => {
    store.delete(name);
  });

/**
 * The origin's device key: the one already stored, or `fresh` put there now.
 *
 * Read and write in one `readwrite` transaction, because two documents of the
 * same origin open at once each generate a key and only one may win. IndexedDB
 * runs those transactions one after the other, so the second sees what the first
 * wrote and drops its own — without that, one tab seals with a key the other
 * overwrote and both read back nothing.
 *
 * `fresh` is generated before the transaction opens: a transaction commits as
 * soon as it runs out of requests to make, and `generateKey` is a wait it would
 * not survive.
 */
async function deviceKey(): Promise<CryptoKey> {
  const fresh = await freshKey();
  return inStore<CryptoKey>("readwrite", (store, done) => {
    const request = store.get(DEVICE_RECORD);
    request.onsuccess = () => {
      if (isCryptoKey(request.result)) {
        done(request.result);
        return;
      }
      store.put(fresh, DEVICE_RECORD);
      done(fresh);
    };
  });
}

const freshKey = (): Promise<CryptoKey> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("This browser has no WebCrypto.");
  return subtle.generateKey({ name: ALGORITHM, length: 256 }, false, ["encrypt", "decrypt"]);
};

/**
 * The key, and the lock over it.
 *
 * Which of the two is in use is read from the browser once, at construction —
 * `lock.ready` is that read. Everything waits on it, so a value is never sealed
 * with a device key by a browser that had a passkey all along.
 */
export function createVault(options: VaultOptions = {}): SecretVault {
  let mode: "device" | "passkey" = "device";
  /** The key in hand: the device's, once read, or the passkey's, once asked. */
  let held: Promise<CryptoKey> | undefined;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  // A browser that will not answer at all is one with no passkey and no device
  // key — `key()` then fails on its own, and the write it fails is swallowed.
  const ready = readRecord(PASSKEY_RECORD)
    .then((stored) => {
      if (!toPasskeyRecord(stored)) return;
      mode = "passkey";
      notify();
    })
    .catch(() => {});

  const key = async (): Promise<CryptoKey> => {
    await ready;
    if (held) return held;
    if (mode === "passkey") throw new Error("The keys are locked.");
    // Cached as the promise: two secrets read at once ask the browser once.
    held = deviceKey().catch((failure: unknown) => {
      held = undefined;
      throw failure;
    });
    return held;
  };

  const lock: SecretLock = {
    ready,

    state: () => (mode === "device" ? "off" : held ? "open" : "locked"),

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    supported: passkeySupported,

    async enable() {
      await ready;
      if (mode === "passkey") return;
      const { key: derived, record } = await createPasskey(options.passkey);
      // The credential first, the old key after: a browser that stops between
      // the two has both, and the passkey is the one that wins on the next read.
      await writeRecord(PASSKEY_RECORD, record);
      await dropRecord(DEVICE_RECORD).catch(() => {});
      mode = "passkey";
      held = Promise.resolve(derived);
      notify();
    },

    async unlock() {
      await ready;
      if (mode !== "passkey" || held) return;
      const record = toPasskeyRecord(await readRecord(PASSKEY_RECORD));
      if (!record) throw new Error("This browser holds no passkey.");
      // Held only once it answers: a dismissed dialog leaves the lock shut.
      const derived = await derivePasskey(record);
      held = Promise.resolve(derived);
      notify();
    },

    async disable() {
      await ready;
      if (mode !== "passkey") return;
      if (!held) throw new Error("Unlock the keys before turning the lock off.");
      const fresh = await freshKey();
      await writeRecord(DEVICE_RECORD, fresh);
      await dropRecord(PASSKEY_RECORD);
      mode = "device";
      held = Promise.resolve(fresh);
      notify();
    },
  };

  return { key, lock };
}
