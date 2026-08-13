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

| Entry        | Harness                                        |
| ------------ | ---------------------------------------------- |
| `agentak`    | none — `AgentChat` takes the session as a prop |
| `agentak/pi` | `createPiSession()`                            |

The choice is the host's, and it is made at the mount: nothing in the library picks a
loop, and nothing registers anything as a side effect. A host that imports the root and
its own session never resolves pi.

**The session is required**, and required by the type: `AgentChatProps.session` has no
default, so a mount without one does not compile.

**Whoever made the session disposes it.** The surface calls nothing on unmount — it
never made the object, so it does not end it. `extension/panel.tsx` keeps one for the
life of the document; `playground/src/components/chat-widget.vue` makes one on the first
live mount and disposes it when the island goes away.

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
rename. `agent/store.ts` is the worked example: a mutating event source, one cached
snapshot, one `notify()`.

## What holds the seam shut

`test/harness.test.tsx` walks the source import graph from each entry and asserts that
`index.ts`, `components/index.ts` and `agent-chat.tsx` reach no `@earendil-works/*`
package — and that `agent/index.ts` still does. A split that holds only by accident is
one an import puts back. The same file renders `AgentChat` over a fake session, which is
the other half of the claim: the surface runs with no loop behind it.

The manifest is the honest part: pi stays in `dependencies`, because `agentak/pi` needs
it and an optional peer would break the CDN one-liner. The decoupling is in the module
graph, not the install — a bundler user who imports the root and their own session never
resolves pi. `dist/index.mjs` and `dist/components/index.mjs` list only preact and rangi;
pi is `dist/agent/index.mjs` alone.
