import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";

/**
 * A conversation, as a host keeps it.
 *
 * `ChatSession` holds one live conversation and nothing else — it neither lists
 * nor names a stored one, see [`session.md`](../../.agents/session.md). So this
 * is pi's own shape, on `PiSession` beside `dispose()`: the factory's contract
 * with whoever called it, not something the surface asks of a harness. A host
 * stores what `save()` returns and opens on it again through the `snapshot`
 * option; where it keeps it — `localStorage`, `chrome.storage`, a server — is
 * the host's business, and one stored conversation per session is what
 * "switch conversations by switching sessions" costs.
 *
 * More than the transcript rides along, because the transcript alone comes back
 * under whatever model was last used rather than the one that wrote it. The
 * choices below are the conversation's own, and they win over the defaults
 * `storage.ts` keeps.
 */
export interface PiSnapshot {
  /** `PI_SNAPSHOT_VERSION` when written. A stored one from an older shape is dropped. */
  version: number;
  /** The transcript, as pi holds it — not the view the chat renders. */
  messages: AgentMessage[];
  /** The provider this conversation ran on. */
  provider?: string;
  /** Its model, restored once the provider's catalog is in hand. */
  model?: string;
  /** How hard that model was asked to think. */
  thinkingLevel?: ThinkingLevel;
  /**
   * The title the model wrote, if one was asked for. The first-message title is
   * not stored: it is derived from `messages`, so it comes back on its own.
   */
  title?: string;
}

/**
 * Raised when a stored snapshot can no longer be restored — not when a field is
 * added, which an older snapshot simply leaves absent.
 */
export const PI_SNAPSHOT_VERSION = 1;

/** Errors on anything but `never`, the same guard the session seam uses. */
type Exhausted<T extends never> = T;

/**
 * The fields at runtime, so `readSnapshot` keeps what it knows by list rather
 * than by hand.
 */
export const PI_SNAPSHOT_FIELDS = [
  "version",
  "messages",
  "provider",
  "model",
  "thinkingLevel",
  "title",
] as const satisfies readonly (keyof PiSnapshot)[];

/** A field added to `PiSnapshot` and to no list fails to compile here. */
export type PiSnapshotFieldsListed = Exhausted<
  Exclude<keyof PiSnapshot, (typeof PI_SNAPSHOT_FIELDS)[number]>
>;

/**
 * `PiSnapshot` with nothing left out. A field may be `undefined`, but it has to
 * be written down — `save()` builds one of these, so a new field fails there
 * rather than being quietly saved as nothing.
 */
export type WholePiSnapshot = PiSnapshot & Record<keyof PiSnapshot, unknown>;

/**
 * A turn that ended in an error: pi records one as an empty assistant message
 * carrying `errorMessage`. `retry()` drops it before running the turn again,
 * and a restore drops it too — `continue()` reads an assistant message as a turn
 * already answered, and an empty one is not a turn any provider accepts.
 */
export const isFailedTurn = (message: AgentMessage) =>
  message.role === "assistant" && Boolean(message.errorMessage);

/**
 * The part of a stored transcript a loop can be handed.
 *
 * A page closes wherever it closes — mid tool call, on a turn that failed, on a
 * confirmation nobody answered. A tool call the transcript never answers is the
 * one that cannot be restored at all: every provider expects its result in the
 * next message, and the request is rejected before the model reads a word of
 * it. So the transcript is cut at the first unanswered call, and any failed turn
 * left at the end goes with it.
 *
 * The approvals do not come back — the gate is per session — which is the same
 * cut: an unanswered call is gone, and the model is never asked to finish one.
 */
export function usablePiMessages(messages: AgentMessage[]): AgentMessage[] {
  const answered = new Set<string>();
  for (const message of messages) {
    if (message.role === "toolResult") answered.add(message.toolCallId);
  }

  const broken = messages.findIndex(
    (message) =>
      message.role === "assistant" &&
      message.content.some((block) => block.type === "toolCall" && !answered.has(block.id)),
  );

  let end = broken === -1 ? messages.length : broken;
  while (end > 0 && isFailedTurn(messages[end - 1])) end--;
  return end === messages.length ? messages : messages.slice(0, end);
}

/**
 * A stored snapshot, checked before it is trusted.
 *
 * Storage is the one input a host does not write itself: an older build wrote
 * it, or a person edited it. Anything that does not answer is `undefined`, which
 * is a new conversation rather than a failure. Fields this build does not know
 * are dropped, so a snapshot from a newer one restores as far as it goes.
 */
export function readPiSnapshot(value: unknown): PiSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const stored = value as Partial<PiSnapshot>;
  if (stored.version !== PI_SNAPSHOT_VERSION || !Array.isArray(stored.messages)) return undefined;

  const known: Partial<PiSnapshot> = {};
  for (const field of PI_SNAPSHOT_FIELDS) {
    const value = stored[field];
    if (value !== undefined) Object.assign(known, { [field]: value });
  }
  return { ...known, messages: stored.messages, version: PI_SNAPSHOT_VERSION };
}
