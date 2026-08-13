# The session seam

`src/session.ts` — what stands between the chat surface and whatever runs it. The
built-in harness is pi ([`pi.md`](pi.md)); a host can bring another, and then no pi
module loads at all.

```
ChatSession  ->  AgentChat  ->  Chat
   ^                              ^
createPiSession()            ChatSnapshot = Pick<ChatProps, …>
(agentak/pi)
```

## The contract is a `Pick` of `ChatProps`

`ChatSnapshot` is not a type of its own — it is the subset of `Chat`'s props a harness
owns. So "compatible" is checked by tsc rather than promised by a doc. What is left out
of the `Pick` belongs to whoever mounts the chat: `style`, `className`, `actions`,
`emptyActions`.

`Pick` alone catches a rename, never an addition — a new prop on the surface that joined
no list would just be unreachable, which is how `providerLabel` was once stranded. So
the three lists are asserted to cover the props between them:

```ts
type Exhausted<T extends never> = T;
export type ChatPropsAccountedFor = Exhausted<
  Exclude<keyof ChatProps, keyof ChatSnapshot | HostOwned | Callbacks>
>;
```

A new `ChatProps` key belongs to the snapshot (a harness reports it), to `HostOwned` (the
mount declares it), or to `Callbacks` — anything `on*`, which `AgentChat` routes to the
session. One that joins none fails `pnpm typecheck` on that line. `ChatSessionOptions`
has the same guard against `CHAT_SESSION_OPTIONS`, the runtime key list `AgentChat`
forwards options by.

`ChatSession` is five required members — `subscribe`, `snapshot`, `send`, `stop`,
`reset` — plus optional ones for the parts of the surface that answer back:
`respondToTool`, `dequeue`, `dismissError`, `retry`, `selectProvider`, `selectModel`,
`setThinkingLevel`, `saveKey`, `setPickerOpen`, `setOptions`. **Absent means gone, not broken.** A harness with one
fixed model carries no `providers`, and `picker.tsx` then heads its own model list under
`providerLabel`; one with no token accounting carries no `usage`, and the composer shows
no meter; one with no `dismissError` shows an error row with nothing to close it.

Data and method pair up: `models` with `selectModel`, `providers` with `selectProvider`,
`queued` with `dequeue`, `thinkingLevels` with `setThinkingLevel`, and `error` with both
`dismissError` and `retry`. One without the other is a list nothing chooses from, or a
method nothing calls.

**`thinkingLevels` is what the chosen model offers, not the scale.** pi's scale is
`off | minimal | low | medium | high | xhigh | max`, but a model takes only part of it
and one that cannot reason takes `off` alone — one level is no choice, so the picker then
shows no level at all. The list travels rather than a `reasoning` flag, because only the
harness knows which of the seven a given model answers to. pi keeps the choice per
provider **and** model: one provider carries reasoning models beside models that take no
level, so a level restored per provider would be sent to a model that refuses it.

**The context warning rides inside `usage`, so it costs the seam nothing.** `nearLimit`
is one more field of `ChatUsage`, and the meter turns amber on it — where the line falls
belongs to whoever counts the tokens. pi puts it where its own harness would compact:
`shouldCompact(used, window, DEFAULT_COMPACTION_SETTINGS)`, which is the window less the
room a summary needs. Nothing here compacts yet, so the warning is all there is.

`respondToTool` takes a third argument, `reason`, which rides with a denial alone: the
harness gives it to the model in place of the tool's output, so a denial can steer the
next turn rather than only failing this one. pi's gate already took one — see
`approvals.ts`. `retry` is the error row's other button: pi drops the failed turn (an
empty assistant message carrying `errorMessage`) and calls `agent.continue()`, which
refuses a transcript ending on an assistant message. A catalog error retries the catalog
load instead, so the button is never the dead one.

Two rules a harness must keep:

1. **`snapshot()` is cheap and identity-stable between notifications.** The surface reads
   it more than once per render. A fresh object each call redraws the whole transcript.
   Cache it, and drop the cache in `notify()`. `useSession` re-reads once in dev and
   `console.warn`s the first time a session breaks this — the failure is otherwise silent.
2. **`subscribe` fires after the change, not before.** `useSession` reads the snapshot
   during the render and re-checks identity once the subscription lands, so an event in
   that gap is not lost — but it cannot recover a change nobody announced.

**`pickerOpen` is one piece of state, and `setPickerOpen` decides who holds it.** A
session that implements it owns both halves, and the surface reads `snapshot.pickerOpen`
alone; one that does not leaves both here. Implementing the setter and forgetting the
field would otherwise leave the picker shut for good.

**One session is one conversation.** Nothing here loads, lists or names a stored
transcript. A host that keeps several switches between them by switching sessions, which
`useSession` keys on — the seam does not grow a history API.

## Subscribe and snapshot, not a hook

The adapter is a plain object, not a `useSession`-shaped prop. Three reasons: a hook
prop cannot be swapped without breaking hook order; the surface is preact but the app
around it usually is not, and a vue or vanilla author can write subscribe/snapshot but
not a preact hook; and the pi side was already event-shaped, so this is a rewrap rather
than a rewrite.

## Who chooses the harness

| Entry                                            | Harness                                        |
| ------------------------------------------------ | ---------------------------------------------- |
| `agentak`                                        | none — `AgentChat` takes the session as a prop |
| `agentak/preact`, `agentak/react`, `agentak/vue` | none either — `ChatPanel` takes the same prop  |
| `agentak/pi`                                     | `createPiSession()`                            |

The choice is the host's, and it is made at the mount: nothing in the library picks a
loop, and nothing registers anything as a side effect. A host that imports a surface
entry and its own session never resolves pi.

**The session is required**, and required by the type: `session` has no default on
`AgentChat` or on `ChatPanel`, so a mount without one does not compile. A wrapper that
made one from options beside it would put pi in every bundle that renders a chat —
which is the seam, spent for one saved import.

**Whoever made the session disposes it.** Nothing in the library calls `dispose()` on
unmount — it never made the object, so it does not end it. So `dispose` is not on
`ChatSession` at all: `createPiSession()` returns `PiSession`, which is `ChatSession`
plus a required `dispose()`. It is the factory's contract with its caller, not what the
chat asks of a harness — an optional member nothing in the library calls would only read
as one the surface might. `extension/panel.tsx` keeps one for the life of the document;
`playground/src/components/chat-widget.vue` makes one on the first live mount and ends it
when the mode changes or the widget goes away.

Host-declared preferences travel as props rather than session options, so one can change
without a new session and a lost transcript: `generateTitle` on `AgentChat` is forwarded
through `setOptions()`.

## Bringing another harness

```tsx
import { AgentChat, type ChatSession } from "agentak";

const session: ChatSession = {
  subscribe: (listener) => { … },   // returns the unsubscribe
  snapshot: () => cached,            // stable until the next notify
  send: (text) => { … },
  stop: () => { … },
  reset: () => { … },
};                                   // the host ends whatever it built here

render(<AgentChat session={session} />, target);
```

`ViewPart` was inlined from AI SDK v7 UI types, so an `ai` `useChat` session is mostly a
rename. `pi/store.ts` is the worked example: a mutating event source, one cached
snapshot, one `notify()`.

## What holds the seam shut

`test/harness.test.tsx` walks the source import graph from each entry and asserts that
`index.ts`, `components/index.ts`, `agent-chat.tsx` and the three wrappers reach no
`@earendil-works/*` package — and that `pi/index.ts` still does. The same walk
polices the host frameworks: `react` is named in `react/index.ts` alone, `vue` in
`vue/index.ts` alone, and an optional peer that leaked into a shared module would be a
peer nobody opted into. A split that holds only by accident is
one an import puts back. The same file renders `AgentChat` over a fake session, which is
the other half of the claim: the surface runs with no loop behind it.

`test/wrapper.test.tsx` does the same for the wrappers, over the same fake session: the
preact one, and the vue one mounted for real — a preact island inside vue, which no
other test reaches. It pins that neither ends a session it did not make, and the two
things the vue props declaration decides at runtime: `class` falls through to the div,
and an absent `tokens` stays absent rather than becoming `false`.

The manifest is the honest part: pi stays in `dependencies`, because `agentak/pi` needs
it and an optional peer would break the CDN one-liner. The decoupling is in the module
graph, not the install — a bundler user who imports the root and their own session never
resolves pi. `dist/index.mjs` and `dist/components/index.mjs` list only preact and rangi;
pi is `dist/pi/index.mjs` alone.
