# Styling

Inline style objects, no stylesheet. Read [components.md](../components.md) first.

An inline style outranks every rule, so a property goes inline unless nothing on the
element can carry it. What cannot go inline:

- **tokens** — the only CSS, and **the host declares it**. `styles/base.ts` exports the
  text as `tokens`, re-exported from the package root. A custom property inherits, and
  inheritance crosses a shadow boundary, so a host page's `:root` reaches every
  component — one the host mounted in a shadow root of its own included — and `.dark`
  re-points the same names with no per-component branch. **A `var()` with no token
  behind it resolves to nothing, not to a default** — a host that skips the snippet gets
  an unpainted tree.
- **`box-sizing`** — inline, but only in the style objects where a size meets a padding
  or a border, which is the only place it changes a pixel.
- **pseudo-elements** — none. The placeholder color comes from `color-scheme`, which
  inherits from the host and is in the `tokens` text, so it paints the UA grey; the
  selection highlight is the UA's.
- **`@keyframes`** — `useAnimation()`, below.

Everything else — layout, spacing, color, typography, every interaction state — is an
`Sx` object. That includes what a selector used to own: a sibling gap or a last-child
border is a `style` cloned onto the children (`ui/accordion.tsx`, `markdown.tsx`), and
a descendant another component stretches gets its `style` passed down
(`<Separator style={S.separator}/>` in `ai-elements/checkpoint.tsx`).

## Writing a component

```tsx
import { reset } from "@/styles/base";
import { useInteraction } from "@/lib/use-interaction";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  body: { overflowX: "auto", borderRadius: "var(--radius-md)" },
  bodyHover: { background: "var(--hover)" },
} satisfies Record<string, Sx>;

function ToolBody({ className, style, ...props }: WithSx<ComponentProps<"button">>) {
  const { hovered, handlers } = useInteraction<HTMLButtonElement>(props);

  return (
    <button
      className={className}
      style={sx(reset.button, S.body, hovered && S.bodyHover, style)}
      {...props}
      {...handlers}
    />
  );
}
```

- Values are **strings**. Preact appends `px` to a bare number.
- `WithSx<T>` narrows `style` to an object so `sx()` can fold a caller's style over the
  component's own. Always destructure `style` out — `{...props}` would overwrite the
  computed one. **A component that declares `WithSx` and then spreads `style` silently
  drops its own styles.**
- `sx(base, variant, state, style)` merges left to right, caller last. **Argument order
  does what cascade order used to.**
- `S` sits at module scope, so it is not rebuilt per render.
- Spacing, color and radius come from the tokens. A component must not carry a
  dark-mode branch of its own: a status tint is a `color-mix()` over a status token.

## The five rules that cost the most to learn

**1. Specificity first, source order second.** When reproducing an old rule, compare
source order only when specificity ties.

**2. An inline `display` breaks the `hidden` attribute.** `CollapsibleContent` and
`CommandItem` hide with `hidden`, and an inline `display` outranks the UA
`[hidden] { display: none }` rule. Keep `hidden` for accessibility and drive display
from the same expression:

```tsx
style={sx(S.content, !open && { display: "none" }, style)}
```

**3. A component's styles go inline only if every user goes through the component.** A
caller that cannot itself be a `<Button>` takes the values from `buttonSx()` in
`ui/button.tsx` or `controlSx()` in `ui/input.tsx`.

**4. A reset preset must be the FIRST `sx()` argument.** As an inline style the reset
beats everything, so `reset.*` reproduces its intended order only when merged first.
This is not neutral: in `markdown.tsx` a naive `reset.text` kills the sibling gap,
which is why `withGap()` clones the gap on last.

**5. Cross-element state needs a context, and the direction matters.** A parent styling
a child on hover (`queue.tsx`, `inline-citation.tsx`) owns `useInteraction` and
publishes down. A parent reacting to a child (`input-group.tsx`) is the mirror: the
group passes a _reporter_ down and the descendant calls it, counting reporters per flag
so two controls cannot clear each other. `:has()` has no inline form, so every use of
it is one of these two shapes now.

## Overriding another component

Pass the override as `style` — a class never beats an inline value:

```tsx
<Badge style={S.result} />
```

There is **no sheet to write a selector into**. If you reach for one, the property it
targets is already inline and the selector would match nothing.

## Animation

`@keyframes` has no inline form, so animations run through `useAnimation()` in
`lib/use-animation.ts` — a ref callback over the Web Animations API, cancelled on
unmount. `spinKeyframes` / `pulseKeyframes` and their options come from
`styles/base.ts`. It honours `prefers-reduced-motion` and degrades to a static element
where `element.animate` is missing (jsdom).

Frames and options must be referentially stable — a module constant, not an object
built in render — and a hook cannot run inside `.map()`, so animated list items need a
subcomponent each.

## What the checks catch, and what they do not

- **Nothing checks box-sizing.** An element that pairs a real size with a real padding
  or border and no `box-sizing: border-box` fails in the browser alone — the playground
  carries no tests, so the human catches it in the page.
- **`ships no stylesheet`**, in `test/eject.test.ts`, globs the components for a
  `*Styles` export and fails if one comes back.
- **Nothing catches an inverted `sx()` argument.** A state object merged before the
  resting value it overrides produces a wrong pixel and no failure. Read the order.
- **There are no `` classes.** `data-slot`, `data-variant`, `data-size` and
  `data-state` are the stable hooks. A class carries nothing — do not add one to style
  something, and do not expect a host to target it.

## The trade

Components render identically wherever they are embedded. There is no shadow root, so a
host page's stylesheet reaches them — but an inline style outranks it, and the look is
inline. In exchange a host cannot restyle them either (only the `--*` tokens are
open), styles re-emit per element per render, hover and focus cost a render, and **a
caller's own children get no reset** — a raw `<p>` under `AlertDescription` loses its
line-height. Children that come through `<Markdown>` are covered, which is every real
caller today.

The one thing a host must do:

```html
<style>
  /* the `tokens` export, verbatim */
</style>
```

The playground and the extension panel both do this in documents that are ours, not a
host's. The size is the host's too: `AgentChat` takes a `style` prop, and the element it
renders into is the one that has a height.

The style objects need modern CSS: `color-mix()` and `field-sizing`. `:has()` ships
nowhere — it survives only in the playground's own `<style>`.
