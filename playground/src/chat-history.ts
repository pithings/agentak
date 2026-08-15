import { useEffect, useState } from "preact/hooks";
import { reactive, watch } from "vue";

import { type PiSnapshot, readPiSnapshot } from "@/pi/snapshot.ts";
import { toTitle } from "@/pi/title.ts";
import { toViewMessages } from "@/pi/transcript.ts";

/**
 * The conversations this browser has had, kept in `localStorage`.
 *
 * A session is one conversation and knows nothing of the ones beside it — see
 * [`session.md`](../../.agents/session.md) — so listing them is the host's work,
 * and this is a host doing it. `PiSession.save()` hands over the transcript and
 * the choices it ran under; everything here is about where they go and how they
 * come back.
 *
 * Two keys, not one: an index of what exists, and one entry per conversation.
 * The menu reads the index alone, so opening it never parses a transcript, and
 * a conversation is dropped by its own key rather than by rewriting the rest.
 *
 * `localStorage` throws rather than returns null where a page denies it, and it
 * throws again when it is full, so every access is guarded: a failure means the
 * conversation lives for this page load and no longer.
 */
const PREFIX = "agentak-playground:";
const INDEX = `${PREFIX}chats`;
const entryKey = (id: string) => `${PREFIX}chat:${id}`;

/** How many are kept. Past this the oldest goes, whatever the store allows. */
const LIMIT = 20;

/** What the menu lists. The transcript itself stays under its own key. */
export interface ChatEntry {
  id: string;
  title: string;
  /** When it was last written, so the newest conversation heads the list. */
  updated: number;
}

const read = (name: string): string | undefined => {
  try {
    return globalThis.localStorage?.getItem(name) ?? undefined;
  } catch {
    return undefined; // storage is denied here
  }
};

const write = (name: string, value: string): boolean => {
  try {
    globalThis.localStorage?.setItem(name, value);
    return true;
  } catch {
    return false; // denied, or full
  }
};

const drop = (name: string) => {
  try {
    globalThis.localStorage?.removeItem(name);
  } catch {
    // Nothing to do: it was never written.
  }
};

const isEntry = (value: unknown): value is ChatEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as ChatEntry).id === "string" &&
  typeof (value as ChatEntry).title === "string" &&
  typeof (value as ChatEntry).updated === "number";

const storedIndex = (): ChatEntry[] => {
  const raw = read(INDEX);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isEntry) : [];
  } catch {
    return []; // a shape from another build, or a hand-edited one
  }
};

const mint = () => globalThis.crypto?.randomUUID?.() ?? `c${Date.now().toString(36)}`;

/**
 * The list, and the conversation the box is on.
 *
 * The page opens on the newest one, so a reload keeps whatever was being said.
 * A conversation with no messages is not in the list: nothing is written until
 * there is something to come back to.
 */
export const conversations = reactive({
  items: storedIndex(),
  currentId: "",
});

conversations.currentId = conversations.items[0]?.id ?? mint();

const writeIndex = () => write(INDEX, JSON.stringify(conversations.items));

/** Take one out of the list and off the store. */
const forget = (id: string) => {
  conversations.items = conversations.items.filter((entry) => entry.id !== id);
  drop(entryKey(id));
};

/**
 * Write one transcript, giving up older ones until it fits.
 *
 * A browser allows a few megabytes across the whole origin, and a long
 * conversation with tool output in it is not small. The oldest conversation is
 * the cheapest thing to give up; when there is nothing left to give up, the
 * write was never going to land.
 */
function put(id: string, json: string): boolean {
  while (!write(entryKey(id), json)) {
    const oldest = conversations.items.filter((entry) => entry.id !== id).at(-1);
    if (!oldest) return false;
    forget(oldest.id);
  }
  return true;
}

/** The name the menu lists it under: the model's, or the first thing asked. */
const label = (snapshot: PiSnapshot) =>
  snapshot.title ?? toTitle(toViewMessages(snapshot.messages)) ?? "New conversation";

/** What was stored for one, if the shape is still one this build reads. */
export function storedConversation(id: string): PiSnapshot | undefined {
  const raw = read(entryKey(id));
  if (!raw) return undefined;
  try {
    return readPiSnapshot(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

/**
 * Keep a conversation under its id. An empty one is not kept — a session that
 * was reset holds nothing to come back to, and the box mints a new id for it.
 */
export function keepConversation(id: string, snapshot: PiSnapshot) {
  if (snapshot.messages.length === 0) return;

  const entry: ChatEntry = { id, title: label(snapshot), updated: Date.now() };
  conversations.items = [entry, ...conversations.items.filter((item) => item.id !== id)];
  for (const gone of conversations.items.slice(LIMIT)) forget(gone.id);

  if (put(id, JSON.stringify(snapshot))) writeIndex();
  else forget(id);
}

/** Move the box to another conversation. The widget swaps the session on this. */
export function openConversation(id: string) {
  conversations.currentId = id;
}

/** A conversation with nothing in it. Nothing is stored until it is spoken to. */
export function newConversation() {
  conversations.currentId = mint();
}

export function forgetConversation(id: string) {
  forget(id);
  writeIndex();
  if (conversations.currentId === id) newConversation();
}

/**
 * The list, read from a preact island — the chat header is preact whatever
 * renders the page around it. vue's reactivity is the source either way; this
 * only turns a change into a render.
 */
export function useConversations() {
  const [, setTick] = useState(0);
  useEffect(
    () =>
      watch(
        () => [conversations.currentId, conversations.items] as const,
        () => setTick((tick) => tick + 1),
        { deep: true },
      ),
    [],
  );
  return conversations;
}
