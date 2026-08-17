# ChatSession contract

`src/session.ts` is the boundary between the UI and any harness. Pi is one implementation;
a surface-only import must never load Pi.

## Required behavior

A session provides `subscribe`, identity-stable `snapshot`, `send`, `stop`, and `reset`.
Optional methods enable optional UI. Absence means the control is omitted, not broken.
Keep data and actions paired, for example models/selectModel, history/openConversation,
keyLock/setKeyLock/unlockKeys, and queued/dequeue.

Two strict rules:

1. `snapshot()` must be cheap and return the same object between notifications. Cache it
   and invalidate in `notify()`. A new object per read redraws the transcript.
2. Notify after mutation. `subscribe` must return an unsubscribe function.

`ChatSnapshot` remains a `Pick<ChatProps>`. When adding a `ChatProps` key, classify it as
session-owned, host-owned, or callback-owned. Keep the exhaustiveness guards and
`CHAT_SESSION_OPTIONS` synchronized.

## State ownership

- If a session implements `setPickerOpen` or `setHistoryOpen`, it must also report the
  matching snapshot field; otherwise the surface owns that state.
- Opening a stored conversation replaces state inside the existing session. Do not require
  the host to remount the chat.
- `retry` retries a failed turn. `retryFrom(id)` rewinds and resends an answered user turn.
  `fork(id)` preserves the old conversation, opens a branch before that message, and lets
  the surface put the message back in the composer.
- `callTool(name)` is a person-initiated tool run. It has no arguments and bypasses the
  model-call approval gate, but the harness must append call and result before continuing
  the model.
- `thinkingLevels` reports the selected model's supported subset, not a global scale.
- `usage.nearLimit` is only a warning; compaction belongs to the harness.

## Ownership and bundles

The creator disposes the session. UI components and framework wrappers never do.
`createPiSession()` returns `PiSession`, whose `dispose`, `save`, and `restore` are factory
APIs rather than UI contract members.

React and Vue wrappers host a Preact island. Host actions passed through them must be
Preact nodes. Import-graph tests must continue to prove that root/components/wrappers do
not reach Pi and that each optional framework appears only in its own entry.
