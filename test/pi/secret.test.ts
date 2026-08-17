// IndexedDB is where the origin's key lives, and jsdom carries none.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";

import { encryptedStorage, isSecret } from "../../src/pi/secret.ts";
import { browserStorage, memoryStorage, type PiStorage } from "../../src/pi/storage.ts";

const KEY = "api-key:openrouter";
const SECRET = "sk-or-v1-0123456789";

/** A browser that has forgotten everything but its `localStorage`. */
const wipeDatabases = () => {
  globalThis.indexedDB = new IDBFactory();
};

/** A store that says what it was handed, so the sealed form can be read. */
function watchedStorage(): PiStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    get: (name) => Promise.resolve(values.get(name)),
    async set(name, value) {
      values.set(name, value);
    },
    async remove(name) {
      values.delete(name);
    },
  };
}

describe("isSecret", () => {
  it("names the keys and nothing else the picker writes", () => {
    expect(isSecret("api-key:openrouter")).toBe(true);
    expect(isSecret("provider")).toBe(false);
    expect(isSecret("model:openrouter")).toBe(false);
    expect(isSecret("thinking:openrouter:gpt-5")).toBe(false);
    expect(isSecret("chats")).toBe(false);
    expect(isSecret("chat:c1")).toBe(false);
  });
});

describe("encryptedStorage", () => {
  it("seals a key and leaves the rest plain", async () => {
    wipeDatabases();
    const inner = watchedStorage();
    const store = encryptedStorage(inner);

    await store.set(KEY, SECRET);
    await store.set("provider", "openrouter");

    const sealed = inner.values.get(KEY) ?? "";
    expect(sealed).not.toContain(SECRET);
    expect(sealed.startsWith("agentak-enc1:")).toBe(true);
    expect(inner.values.get("provider")).toBe("openrouter");

    expect(await store.get(KEY)).toBe(SECRET);
    expect(await store.get("provider")).toBe("openrouter");
  });

  it("holds one key that no script can copy out", async () => {
    wipeDatabases();
    const store = encryptedStorage(memoryStorage());
    await store.set(KEY, SECRET);

    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = globalThis.indexedDB.open("agentak", 1);
      request.onsuccess = () => resolve(request.result);
    });
    const held = await new Promise<CryptoKey>((resolve) => {
      const request = database.transaction("crypto").objectStore("crypto").get("secret-key");
      request.onsuccess = () => resolve(request.result as CryptoKey);
    });
    database.close();

    expect(held.extractable).toBe(false);
    expect(held.algorithm.name).toBe("AES-GCM");
    await expect(globalThis.crypto.subtle.exportKey("raw", held)).rejects.toThrow();
  });

  it("reads back what the visit before it sealed", async () => {
    wipeDatabases();
    const inner = watchedStorage();
    await encryptedStorage(inner).set(KEY, SECRET);

    // The page again: a store of its own, over the same `localStorage` and the
    // same IndexedDB.
    expect(await encryptedStorage(inner).get(KEY)).toBe(SECRET);
  });

  it("seals a key that was stored in the clear, behind the reader", async () => {
    wipeDatabases();
    const inner = watchedStorage();
    inner.values.set(KEY, SECRET); // written by a build before this one
    const store = encryptedStorage(inner);

    expect(await store.get(KEY)).toBe(SECRET);
    await vi.waitFor(() => expect(inner.values.get(KEY)).not.toBe(SECRET));
    expect(await store.get(KEY)).toBe(SECRET);
  });

  it("reads nothing where the key it was sealed with is gone", async () => {
    wipeDatabases();
    const inner = watchedStorage();
    await encryptedStorage(inner).set(KEY, SECRET);

    wipeDatabases(); // site data cleared, `localStorage` kept
    expect(await encryptedStorage(inner).get(KEY)).toBeUndefined();
  });

  it("writes an empty value as it is, so a drop still reads as nothing", async () => {
    wipeDatabases();
    const inner = watchedStorage();
    const store = encryptedStorage(inner);

    await store.set(KEY, "");
    expect(inner.values.get(KEY)).toBe("");
    // Empty as the store under it holds it: nothing to unseal, and nothing a
    // caller reads as a key.
    expect(await store.get(KEY)).toBe("");
  });

  it("passes `remove` through, and answers none where the store has none", async () => {
    wipeDatabases();
    const inner = watchedStorage();
    const store = encryptedStorage(inner);
    await store.set(KEY, SECRET);
    await store.remove?.(KEY);
    expect(inner.values.has(KEY)).toBe(false);

    const { get, set } = memoryStorage();
    expect(encryptedStorage({ get, set }).remove).toBeUndefined();
  });

  it("keeps no secret where the browser has no IndexedDB", async () => {
    const held = globalThis.indexedDB;
    // @ts-expect-error a browser mode that offers none
    globalThis.indexedDB = undefined;
    try {
      const inner = watchedStorage();
      const store = encryptedStorage(inner);

      await expect(store.set(KEY, SECRET)).rejects.toThrow();
      expect(inner.values.has(KEY)).toBe(false);

      // The choices that are not secrets are still this browser's to keep.
      await store.set("provider", "openrouter");
      expect(await store.get("provider")).toBe("openrouter");
    } finally {
      globalThis.indexedDB = held;
    }
  });

  it("asks again after a browser that answered nothing", async () => {
    wipeDatabases();
    const held = globalThis.indexedDB;
    // @ts-expect-error a browser mode that offers none
    globalThis.indexedDB = undefined;
    const inner = watchedStorage();
    const store = encryptedStorage(inner);
    await expect(store.set(KEY, SECRET)).rejects.toThrow();

    globalThis.indexedDB = held;
    await store.set(KEY, SECRET);
    expect(await store.get(KEY)).toBe(SECRET);
  });

  it("is what `browserStorage()` puts over `localStorage`", async () => {
    wipeDatabases();
    localStorage.clear();
    const store = browserStorage();

    await store.set(KEY, SECRET);
    await store.set("provider", "openrouter");

    expect(localStorage.getItem(`agentak:${KEY}`)).not.toContain(SECRET);
    expect(localStorage.getItem("agentak:provider")).toBe("openrouter");
    expect(await store.get(KEY)).toBe(SECRET);
  });

  it("takes a wider test of what a secret is", async () => {
    wipeDatabases();
    const inner = watchedStorage();
    const store = encryptedStorage(inner, (name) => name.startsWith("chat:"));

    await store.set("chat:c1", "a conversation");
    await store.set(KEY, SECRET);

    expect(inner.values.get("chat:c1")).not.toContain("a conversation");
    expect(inner.values.get(KEY)).toBe(SECRET);
    expect(await store.get("chat:c1")).toBe("a conversation");
  });
});
