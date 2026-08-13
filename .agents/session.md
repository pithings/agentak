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
owns. So "compatible" is checked by tsc rather than promised by a doc, and a new prop on
the surface cannot quietly leave the seam behind. What is left out of the `Pick` belongs
to whoever mounts the chat: `style`, `className`, `actions`, `emptyActions`.

`ChatSession` is six required members — `subscribe`, `snapshot`, `send`, `stop`,
`reset` — plus optional ones for the parts of the surface that answer back:
`respond` (tool confirmations), `dequeue`, `selectProvider`, `selectModel`, `saveKey`,
`setPickerOpen`, `setOptions`, `dispose`. **Absent means gone, not broken.** A harness
with one fixed model carries no `providers`, and `picker.tsx` then heads its own model
list; one with no token accounting carries no `usage`, and the composer shows no meter.

Two rules a harness must keep:

1. **`snapshot()` is identity-stable between notifications.** The surface reads it on
   every render. A fresh object each call redraws the whole transcript. Cache it, and
   drop the cache in `notify()`.
2. **`subscribe` fires after the change, not before.** `useSession` reads the snapshot
   during the render and re-checks identity once the subscription lands, so an event in
   that gap is not lost — but it cannot recover a change nobody announced.

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
| `agentak/preact`, `agentak/react`, `agentak/vue` | none either — same prop, same rule             |
| `agentak/pi`                                     | `createPiSession()`                            |

The choice is the host's, and it is made at the mount: nothing in the library picks a
loop, and nothing registers anything as a side effect. A host that imports a surface
entry and its own session never resolves pi.

**The session is required**, and required by the type: `session` has no default on
`AgentChat` or on any wrapper, so a mount without one does not compile. A wrapper that
made one from options beside it would put pi in every bundle that renders a chat —
which is the seam, spent for one saved import.

**Whoever made the session disposes it.** Nothing in the library calls `dispose()` on
unmount — it never made the object, so it does not end it. `extension/panel.tsx` keeps
one for the life of the document; `playground/src/components/chat-widget.vue` makes one
on the first live mount and ends it when the mode changes or the widget goes away.

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
};

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
