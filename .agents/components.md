# Components

Read this before UI work, then the relevant focused file:

- [`components/styling.md`](components/styling.md): inline-style rules
- [`components/primitives.md`](components/primitives.md): intentional primitive limits
- [`components/porting.md`](components/porting.md): registry port workflow
- [`components/markdown.md`](components/markdown.md): untrusted Markdown and links

## Non-obvious rules

- Use Preact modules only. `memo` and `forwardRef` come from `preact/compat`.
  `reactAliasesEnabled: false` intentionally makes accidental React imports fail.
- Write SVG attributes in hyphenated form (`stroke-width`). Preact applies them verbatim.
- There is no `Slot`, `asChild`, or tooltip primitive. Triggers are real buttons; use the
  native `title` attribute.
- Components ship no stylesheet. Direct component/`AgentChat` users install the exported
  `tokens` CSS; `mountChat()` and wrappers inject it unless disabled. There is no shadow root.
- `_parked/` contains complete ports with no current product source. Keep them exported,
  but move them into the active tree only when something renders them.

## Chat layout invariants

- Error, queue, composer, and status bar form one absolutely positioned foot over the
  transcript. `ResizeObserver` and keyboard-inset code write CSS custom properties directly
  on the surface; do not convert these measurements to component state.
- The foot alone lifts over a virtual keyboard. The header and transcript remain fixed,
  and the transcript scrolls beneath it.
- Settings and history share one transcript slot and cannot be open together. Settings
  hides rather than unmounts the uncontrolled composer so its draft survives.
- `ChatMessage` compares message contents, not object identity. Sessions may rebuild the
  whole transcript on every event. Preserve the memo layers around messages and Markdown.
- The composer geometry is coupled: field height, 2 px padding, 1 px border, 42 px outer
  height, and 21 px radius. Change these values as one system.
- The composer measures nothing per keystroke. Its shape is CSS alone: one radius at every
  height, and a send button that keeps its place in the field's row. A layout read in an
  input handler — `getComputedStyle`, `scrollHeight`, `offsetHeight` — is a layout of the
  whole surface between the key and the letter, which a phone keyboard shows as lag.

## Exports

`src/components/index.ts` exports every included component. `src/index.ts` exports only
the chat shell. Register a renderer in `components/elements.tsx` only when Pi or a tool can
actually emit it; registration adds it to every chat bundle.

`progress` is registered because a provider can write a `::progress{…}` marker into the
words of a turn — `lib/progress.ts` parses it, `toViewMessages()` swaps it for the element
part. Only the four fields the bar reads cross over; the words come from a model. The
transcript's bar is `hideWhenDone`: a full one fades and leaves, and one that mounts full
— a stored conversation — never renders. The part stays in the transcript either way.
