# Components

Preact components under `src/components/`: `ui/` are shadcn primitives, `ai-elements/`
are ports of the [AI SDK Elements](https://elements.ai-sdk.dev) registry, and
`chat.tsx` assembles them over the rows in `chat/`. Every registry component that
needs no new npm dependency is ported; the rest is in
[components/porting.md](components/porting.md).

`_parked/` holds what nothing renders. `_parked/ai-elements/` and `_parked/ui/` are ports
still waiting on a source the chat does not have — a tool, a message role — and
`_parked/chat/picker.tsx` is the composer popover the settings page replaced. The ports
stay exported from `components/index.ts` and stay in the playground catalog, so parking
costs a host nothing; the split only keeps what the chat draws apart from what is merely
finished. `picker.tsx` was never exported and stays that way. A parked file moves back
the day something renders it, and its `ui/` primitive travels with it when nothing else
uses that primitive. What is registered in `elements.tsx` is a narrower set again — see
[`pi.md`](pi.md).

Read this page first — the rules below hold everywhere. Then read the one page in
`components/` for the job at hand.

| File                                                   | Read it when                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| [`components/styling.md`](components/styling.md)       | writing or changing any component — the inline-style system       |
| [`components/primitives.md`](components/primitives.md) | building on `ui/`, the hand-rolled replacements for radix         |
| [`components/porting.md`](components/porting.md)       | porting a registry element, or asking why a port reads as it does |
| [`components/markdown.md`](components/markdown.md)     | touching `<Markdown>`, `CodeBlock`, or syntax highlighting        |

## Preact, not react

- Import `preact`, `preact/hooks`, and `preact/compat` for `memo`/`forwardRef` only —
  that is preact's own module, not a react shim.
- `reactAliasesEnabled: false` in every vite and vitest config, so a stray `react`
  import fails the build instead of resolving. `test/eject.test.ts` asserts this.
- `tsconfig.json` sets `jsxImportSource: "preact"` and maps no `react` path.
- **Write SVG attributes hyphenated** (`stroke-width`), never camelCase. Preact calls
  `setAttribute` verbatim and the SVG namespace is case-sensitive, so a camelCase
  attribute is inert and nothing warns — the icon simply renders at the SVG default.
- No `asChild` / `Slot`. A trigger is a real `<button>`.
- No tooltip primitive — use the native `title` attribute.

## No stylesheet

The library injects no stylesheet, into a document or a shadow root. A component's
styles are **inline style objects**, merged with `sx()`. The one thing a host must do is
declare the `tokens` text:

```html
<style>
  /* the `tokens` export, verbatim */
</style>
```

**A `var()` with no token behind it resolves to nothing, not to a default** — a host that
skips the snippet gets an unpainted tree. Everything else about the system, and the
rules that cost the most to learn, is in [components/styling.md](components/styling.md).

## The foot floats

In `chat.tsx` the error line, the queue and the composer are one **absolute** row over
the foot of the transcript, not a flex row under it. `ConversationContent` and the
scroll button end above it, by the height a `ResizeObserver` reads off that row.

That is what makes room for a virtual keyboard without moving the surface.
`watchKeyboardInset` reports how much of the layout viewport the keyboard covers —
`innerHeight - visualViewport.height - visualViewport.offsetTop`, touch only, at most once
a frame — and the foot lifts by it. The header and the transcript stay where they are, and
only the composer rides up; the transcript keeps its height and scrolls under it. Where
the browser honours `interactive-widget=resizes-content` the layout viewport shrinks on
its own, the inset is 0, and the same code does nothing.

A lifted foot is nowhere near the home bar, so `--chat-safe-bottom` goes to `0px` there;
the composer's `padding-bottom` reads that var with `env(safe-area-inset-bottom)` as its
fallback, so a composer used on its own still clears the bar.

**Neither number is state.** `useFootHeight` and `useKeyboardLift` write them on the
surface as `--chat-foot` and `--chat-inset`, and everything that has to end above the foot
reads the one `CLEAR` string. Both move while the reader types — the textarea is
`field-sizing: content`, so the row grows with every line it wraps, and iOS scrolls the
visual viewport a pixel at a time to follow the caret — so as state each was a render of
the whole surface per keystroke. Preact's style diff writes the keys of the style object
and no others, so a property set by hand on the same element survives.

`lib/utils.ts` holds `media()` for the same reason: every `matchMedia()` call makes another
live query list for the browser to re-evaluate on each viewport change, and `isTouch()` is
read while rendering while `prefersReducedMotion()` is read once per streamed word.

`useKeyboardOpen()` sits beside it, in the same file, and answers the other question: not
where the keyboard is, but whether there is one. It is the inset **or** a focused text
field, because the inset is 0 on every browser that shrinks its own layout viewport and
there is then nothing left to measure — on a phone a focused field means a keyboard
either way. Anything that should spend the room a keyboard leaves asks this;
`CommandList` is the first, and gives up its height cap while one is up.

## A turn redraws when it changes

`ChatMessage` is `memo`ed on the **contents** of its `ViewMessage`, not on its identity. A
session rebuilds its whole transcript on every event — the pi one does, and `ChatSession`
asks only that a snapshot hold still _between_ events — so a fresh object is not a changed
turn. Without the comparison every token, every keyboard and every resize redrew every
turn in the transcript, however far above the one that moved. `onRespond` is compared by
presence: `AgentChat` builds a fresh closure each render and each one calls the same
session.

`Markdown` and `MessageResponse` carry their own `memo` under this one, which is what
keeps the wasm parse and the syntax pass off a re-render.

## Two pages, one slot

`chat/settings.tsx` and `chat/history.tsx` both stand **where the transcript is**, not in a
popover over it: a provider list and a list of conversations are read, and a panel the
height of a phone keyboard is not where either belongs. `chat.tsx` holds one flag per page
and opens only one at a time — opening either puts the other away, so the transcript is
never behind two pages. The header follows: the back arrow takes the leading spot from the
history button while a page is up, and the title says which page it is.

The settings page also puts the composer away — its `hidden` prop, which is `display: none`
and not an unmount, so the uncontrolled textarea keeps its draft. Nothing is said to a
provider that is still being chosen, and the floating foot is then only the error row that
opened the page, so `CLEAR` measures the room that row needs and no more. The history page
keeps the composer.

Each flag is controllable, so a session can own it instead — see [`session.md`](session.md).

## Exports

`src/index.ts` exports the shell, not single elements, so a new component needs no
barrel change; `src/components/index.ts` is the named export of every built-in.
