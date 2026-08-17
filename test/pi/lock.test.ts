// The lock keeps its credential in IndexedDB, which jsdom does not have.
import "fake-indexeddb/auto";
import type { StreamFn } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { IDBFactory } from "fake-indexeddb";
import { waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fakeAuthenticator, type FakeAuthenticator } from "./authenticator.ts";
import { encryptedStorage, type SecretStorage } from "../../src/pi/storage/secret.ts";
import { createPiSession, type PiSession } from "../../src/pi/session.ts";
import { memoryStorage, type PiStorage } from "../../src/pi/storage.ts";

/** Takes a key, and its catalog is an import rather than a fetch. */
const KEYED = "openrouter";
const SECRET = "sk-or-v1-0123456789";

const answer: AssistantMessage = {
  role: "assistant",
  content: [{ type: "text", text: "Two plans." }],
  api: "openai-completions",
  provider: KEYED,
  model: "x",
  usage: {
    input: 10,
    output: 5,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 15,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 0,
};

/** Replays one prepared message, so no provider is involved. */
const scripted = (): StreamFn => () => {
  const stream = createAssistantMessageEventStream();
  stream.push({ type: "start", partial: { ...answer, content: [] } });
  stream.push({ type: "done", reason: "stop", message: answer });
  stream.end(answer);
  return stream;
};

let device: FakeAuthenticator;
/** What `localStorage` would be: one browser's store, across visits. */
let inner: PiStorage;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  device = fakeAuthenticator();
  inner = memoryStorage();
});

afterEach(() => device.restore());

const visit = (store: SecretStorage): PiSession =>
  createPiSession({ provider: KEYED, storage: store, streamFn: scripted() });

/** A model of the provider's own, so the session is one that can answer. */
const pickModel = async (session: PiSession) => {
  await waitFor(() => expect(session.snapshot().models?.length).toBeGreaterThan(0));
  session.selectModel?.(session.snapshot().models?.[0]?.id ?? "");
  await waitFor(() => expect(session.snapshot().modelId).toBeTruthy());
};

/** The first visit: a key saved, and the lock turned on over it. */
const setUp = async () => {
  const session = visit(encryptedStorage(inner));
  await session.ready;
  // A key, and then the provider it is for: a session built on a provider it
  // had no key for opened on none.
  session.saveKey?.(KEYED, SECRET);
  session.selectProvider?.(KEYED);
  await pickModel(session);

  session.setKeyLock?.(true);
  await waitFor(() => expect(session.snapshot().keyLock?.state).toBe("open"));
  await waitFor(() => expect(session.snapshot().keyLock?.busy).toBeFalsy());
  session.dispose();
};

describe("a pi session over a store that can lock", () => {
  it("offers the lock, and turning it on seals the key it already had", async () => {
    const store = encryptedStorage(inner);
    const session = visit(store);
    await session.ready;
    expect(session.snapshot().keyLock).toEqual({ state: "off", busy: undefined, error: undefined });

    session.saveKey?.(KEYED, SECRET);
    session.setKeyLock?.(true);
    await waitFor(() => expect(session.snapshot().keyLock?.state).toBe("open"));

    // Sealed under the passkey's key now — the mark says which — and the
    // session still holds the key itself, so nothing was lost by moving it.
    await waitFor(async () =>
      expect((await inner.get(`api-key:${KEYED}`))?.startsWith("agentak-enc2:")).toBe(true),
    );
    expect(session.snapshot().providers?.find((entry) => entry.id === KEYED)?.hasKey).toBe(true);
  });

  it("opens on the locked provider rather than asking for a key it has", async () => {
    await setUp();

    const session = visit(encryptedStorage(inner));
    await session.ready;
    const keyed = session.snapshot().providers?.find((entry) => entry.id === KEYED);
    expect(session.snapshot().keyLock?.state).toBe("locked");
    expect(session.snapshot().providerId).toBe(KEYED);
    expect(keyed?.hasKey).toBe(true);
    expect(keyed?.locked).toBe(true);
  });

  it("unlocks on the first message, then sends it", async () => {
    await setUp();

    const session = visit(encryptedStorage(inner));
    await session.ready;
    await pickModel(session);
    const asked = device.ceremonies();

    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    expect(device.ceremonies()).toBe(asked + 1);
    expect(session.snapshot().keyLock?.state).toBe("open");
    expect(session.snapshot().providers?.find((entry) => entry.id === KEYED)?.locked).toBeFalsy();

    // The second message asks nobody: the key is in memory for the visit.
    session.send("and the other one?");
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(4));
    expect(device.ceremonies()).toBe(asked + 1);
  });

  it("holds the message where the device is dismissed, and sends it on the next try", async () => {
    await setUp();

    const session = visit(encryptedStorage(inner));
    await session.ready;
    await pickModel(session);

    device.refuse();
    session.send("what is this page?");
    await waitFor(() => expect(session.snapshot().keyLock?.error).toBeTruthy());
    // Nothing was sent, and the page that can answer for it is open.
    expect(session.snapshot().messages).toHaveLength(0);
    expect(session.snapshot().pickerOpen).toBe(true);
    expect(session.snapshot().keyLock?.state).toBe("locked");

    device.allow();
    session.unlockKeys?.();
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
    expect(session.snapshot().keyLock?.error).toBeUndefined();
  });

  it("takes the lock off again, and the next visit needs no device", async () => {
    await setUp();

    const first = visit(encryptedStorage(inner));
    await first.ready;
    first.unlockKeys?.();
    await waitFor(() => expect(first.snapshot().keyLock?.state).toBe("open"));
    first.setKeyLock?.(false);
    await waitFor(() => expect(first.snapshot().keyLock?.state).toBe("off"));
    await waitFor(() => expect(first.snapshot().keyLock?.busy).toBeFalsy());

    const asked = device.ceremonies();
    const next = visit(encryptedStorage(inner));
    await next.ready;
    await pickModel(next);
    expect(next.snapshot().keyLock?.state).toBe("off");

    next.send("what is this page?");
    await waitFor(() => expect(next.snapshot().messages).toHaveLength(2));
    expect(device.ceremonies()).toBe(asked);
  });

  it("asks for a key rather than an unlock nothing would answer", async () => {
    await setUp();

    // The site's data, cleared: the sealed key is still in `localStorage` and
    // the credential it was sealed for is gone.
    globalThis.indexedDB = new IDBFactory();
    const session = visit(encryptedStorage(inner));
    await session.ready;
    const keyed = () => session.snapshot().providers?.find((entry) => entry.id === KEYED);

    expect(session.snapshot().keyLock?.state).toBe("off");
    // Not a key to unlock for: a key to type again, and the page says why.
    expect(keyed()?.locked).toBeFalsy();
    expect(keyed()?.keyLost).toBe(true);
    expect(keyed()?.hasKey).toBe(false);
    // And the provider is one to set up again, so it is not the one that opens:
    // the head of the list is, which asks for a key of its own.
    expect(session.snapshot().providerId).not.toBe(KEYED);

    // The message is held for the settings page rather than for a dialog that
    // would never open, which is the dead end this marking is here to stop.
    session.send("what is this page?");
    expect(session.snapshot().pickerOpen).toBe(true);
    expect(session.snapshot().keyLock?.error).toBeUndefined();

    // Typing another key ends it: the provider runs, and nothing says lost.
    session.saveKey?.(KEYED, "sk-or-v1-another");
    session.selectProvider?.(KEYED);
    await pickModel(session);
    expect(keyed()?.keyLost).toBeFalsy();
    await waitFor(() => expect(session.snapshot().messages).toHaveLength(2));
  });

  it("shows no lock at all where the browser could not hold a key", async () => {
    device.restore();
    device = fakeAuthenticator({ prf: false });

    const session = visit(encryptedStorage(inner));
    await session.ready;
    expect(session.snapshot().keyLock).toBeUndefined();
  });

  it("shows none either where the store seals nothing", async () => {
    const session = createPiSession({ provider: KEYED, storage: memoryStorage() });
    await session.ready;
    expect(session.snapshot().keyLock).toBeUndefined();
  });
});
