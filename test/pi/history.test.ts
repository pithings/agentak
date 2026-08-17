import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";

import { createHistory } from "../../src/pi/storage/history.ts";
import { PI_SNAPSHOT_VERSION, type PiSnapshot } from "../../src/pi/snapshot.ts";
import { memoryStorage, type PiStorage } from "../../src/pi/storage.ts";

/** A conversation of roughly `size` characters, so a store can be filled. */
const snapshot = (size = 0): PiSnapshot => ({
  version: PI_SNAPSHOT_VERSION,
  messages: [{ role: "user", content: "x".repeat(size) } as unknown as AgentMessage],
});

/**
 * A store that holds only `room` characters of transcript, in the two ways a
 * store reports being full: `throws` is `localStorage`, which swallows the throw
 * and reads back short, and the other is `chrome.storage`, which rejects.
 */
function boundedStorage(room: number, kind: "throws" | "rejects"): PiStorage {
  const values = new Map<string, string>();
  const used = () =>
    [...values].reduce((sum, [name, value]) => sum + (isChat(name) ? value.length : 0), 0);
  const isChat = (name: string) => name.startsWith("chat:");

  return {
    get: (name) => Promise.resolve(values.get(name)),
    async set(name, value) {
      const over = isChat(name) && used() - (values.get(name)?.length ?? 0) + value.length > room;
      if (over && kind === "throws") return; // swallowed, exactly as browserStorage() does
      values.set(name, value);
      if (over) throw new Error("QUOTA_BYTES quota exceeded");
    },
    async remove(name) {
      values.delete(name);
    },
  };
}

/** The store settles a rejected write on a later microtask, so let it. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createHistory", () => {
  it("lists a kept conversation and reads it back", async () => {
    const history = createHistory(memoryStorage());
    history.keep("a", snapshot(10), "First");
    await settled();

    expect(history.list()).toEqual([{ id: "a", title: "First", updated: expect.any(Number) }]);
    expect((await history.read("a"))?.messages).toHaveLength(1);
  });

  it("keeps no more than the limit", async () => {
    const history = createHistory(memoryStorage(), 2);
    for (const id of ["a", "b", "c"]) history.keep(id, snapshot(), id);
    await settled();

    expect(history.list().map((entry) => entry.id)).toEqual(["c", "b"]);
    expect(await history.read("a")).toBeUndefined();
  });

  it("forgets a conversation by its own key", async () => {
    const history = createHistory(memoryStorage());
    history.keep("a", snapshot(), "First");
    history.keep("b", snapshot(), "Second");
    await settled();

    history.forget("a");
    expect(history.list().map((entry) => entry.id)).toEqual(["b"]);
    expect(await history.read("a")).toBeUndefined();
    expect(await history.read("b")).toBeDefined();
  });

  it("keeps nothing for an empty conversation", () => {
    const history = createHistory(memoryStorage());
    history.keep("a", { version: PI_SNAPSHOT_VERSION, messages: [] }, "Empty");
    expect(history.list()).toEqual([]);
  });

  // The store is full in both of the ways one can be. Each time the newest
  // conversation has to land, and the oldest is what pays for the room.
  for (const kind of ["throws", "rejects"] as const) {
    describe(`a store that ${kind}`, () => {
      it("gives up the oldest conversation to fit the newest", async () => {
        // Room for two of them and no more, counted as the store counts.
        const one = JSON.stringify(snapshot(150)).length;
        const history = createHistory(boundedStorage(one * 2, kind));

        history.keep("a", snapshot(150), "First");
        await settled();
        history.keep("b", snapshot(150), "Second");
        await settled();
        history.keep("c", snapshot(150), "Third");
        await settled();

        expect(await history.read("c")).toBeDefined();
        expect(history.list().map((entry) => entry.id)).toEqual(["c", "b"]);
        expect(await history.read("a")).toBeUndefined();
      });

      // The bug this covers: a store that only rejects looked like it had
      // stored the write, so the index kept a row that opened nothing.
      it("lists no conversation it could not store", async () => {
        const history = createHistory(boundedStorage(100, kind));

        history.keep("a", snapshot(5_000), "Too big");
        await settled();

        expect(history.list()).toEqual([]);
        expect(await history.read("a")).toBeUndefined();
      });
    });
  }
});
