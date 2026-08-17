// The key lives in IndexedDB, and jsdom carries none.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { fakeAuthenticator, type FakeAuthenticator } from "./authenticator.ts";
import { passkeyFailure, passkeySupported } from "../../src/pi/passkey.ts";
import { encryptedStorage } from "../../src/pi/secret.ts";
import { memoryStorage, type PiStorage } from "../../src/pi/storage.ts";
import { createVault } from "../../src/pi/vault.ts";

const KEY = "api-key:openrouter";
const SECRET = "sk-or-v1-0123456789";

let device: FakeAuthenticator | undefined;

const wipeDatabases = () => {
  globalThis.indexedDB = new IDBFactory();
};

/** A visit: a fresh store over the same `localStorage` and the same IndexedDB. */
const visit = (inner: PiStorage) => encryptedStorage(inner);

afterEach(() => {
  device?.restore();
  device = undefined;
});

describe("passkeySupported", () => {
  it("goes on the extension the browser names, not on the authenticator", async () => {
    device = fakeAuthenticator({ prf: false });
    expect(await passkeySupported()).toBe(false);

    device.restore();
    device = fakeAuthenticator({ prf: true });
    expect(await passkeySupported()).toBe(true);
  });

  it("falls back to a platform authenticator where the browser answers no capabilities", async () => {
    device = fakeAuthenticator({ capabilities: false });
    expect(await passkeySupported()).toBe(true);
  });

  it("is false where the browser carries no WebAuthn at all", async () => {
    const held = globalThis.PublicKeyCredential;
    // @ts-expect-error a browser without it
    globalThis.PublicKeyCredential = undefined;
    expect(await passkeySupported()).toBe(false);
    globalThis.PublicKeyCredential = held;
  });
});

describe("the vault", () => {
  it("opens on the device key, and asks nobody for it", async () => {
    wipeDatabases();
    device = fakeAuthenticator();
    const vault = createVault();
    await vault.lock.ready;

    expect(vault.lock.state()).toBe("off");
    expect(await vault.key()).toBeDefined();
    expect(device.ceremonies()).toBe(0);
  });

  it("locks, and then reads nothing until it is unlocked", async () => {
    wipeDatabases();
    device = fakeAuthenticator();
    const inner = memoryStorage();

    const first = visit(inner);
    await first.lock.ready;
    await first.lock.enable();
    // The lock seals with another key, so the caller writes its secret again.
    await first.set(KEY, SECRET);
    expect(first.lock.state()).toBe("open");
    expect(await first.get(KEY)).toBe(SECRET);

    // The page again: the key that opens it is in the device, not the browser.
    const next = visit(inner);
    await next.lock.ready;
    expect(next.lock.state()).toBe("locked");
    expect(await next.get(KEY)).toBeUndefined();
    // And the store still says it holds one, which is what a chat asks before
    // it decides whether to ask for a key or for a finger.
    expect(await next.sealed(KEY)).toBe(true);

    await next.lock.unlock();
    expect(next.lock.state()).toBe("open");
    expect(await next.get(KEY)).toBe(SECRET);
  });

  it("leaves the lock shut where the person dismisses the dialog", async () => {
    wipeDatabases();
    device = fakeAuthenticator();
    const inner = memoryStorage();

    const first = visit(inner);
    await first.lock.enable();
    await first.set(KEY, SECRET);

    const next = visit(inner);
    await next.lock.ready;
    device.refuse();
    await expect(next.lock.unlock()).rejects.toThrow();
    expect(next.lock.state()).toBe("locked");

    device.allow();
    await next.lock.unlock();
    expect(await next.get(KEY)).toBe(SECRET);
  });

  it("reads nothing where the passkey itself is gone", async () => {
    wipeDatabases();
    device = fakeAuthenticator();
    const inner = memoryStorage();

    const first = visit(inner);
    await first.lock.enable();
    await first.set(KEY, SECRET);

    device.wipe(); // the person deleted it from the device's own list
    const next = visit(inner);
    await next.lock.ready;
    await expect(next.lock.unlock()).rejects.toThrow();
    expect(await next.get(KEY)).toBeUndefined();
  });

  it("takes the lock off again, and then needs nobody", async () => {
    wipeDatabases();
    device = fakeAuthenticator();
    const inner = memoryStorage();

    const store = visit(inner);
    await store.lock.enable();
    await store.set(KEY, SECRET);
    await store.lock.disable();
    // Same again: what the lock sealed is unreadable, so the caller rewrites.
    await store.set(KEY, SECRET);
    expect(store.lock.state()).toBe("off");

    const asked = device.ceremonies();
    const next = visit(inner);
    await next.lock.ready;
    expect(next.lock.state()).toBe("off");
    expect(await next.get(KEY)).toBe(SECRET);
    expect(device.ceremonies()).toBe(asked);
  });

  it("will not take the lock off while it is shut", async () => {
    wipeDatabases();
    device = fakeAuthenticator();
    const inner = memoryStorage();
    await visit(inner).lock.enable();

    const next = visit(inner);
    await next.lock.ready;
    await expect(next.lock.disable()).rejects.toThrow();
  });

  it("derives at creation where the browser answers the salt there", async () => {
    wipeDatabases();
    device = fakeAuthenticator({ atCreate: true });
    const inner = memoryStorage();

    const store = visit(inner);
    await store.lock.enable();
    await store.set(KEY, SECRET);
    // One dialog, not two: the create answered the salt itself.
    expect(device.ceremonies()).toBe(1);
    expect(await store.get(KEY)).toBe(SECRET);
  });

  it("refuses to seal with a device that carries no PRF", async () => {
    wipeDatabases();
    device = fakeAuthenticator({ prf: false });
    const vault = createVault();
    await vault.lock.ready;
    await expect(vault.lock.enable()).rejects.toThrow(/cannot hold a key/);
    expect(vault.lock.state()).toBe("off");
  });
});

describe("passkeyFailure", () => {
  it("words a dismissed dialog as an answer rather than a fault", () => {
    expect(passkeyFailure(new DOMException("", "NotAllowedError"))).toBe(
      "This device did not confirm it.",
    );
    expect(passkeyFailure(new Error("IndexedDB is blocked here."))).toBe(
      "IndexedDB is blocked here.",
    );
    expect(passkeyFailure("something")).toBe("Something went wrong.");
  });
});
