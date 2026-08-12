# AI Elements port roadmap

The registry has 48 components (`https://elements.ai-sdk.dev/api/registry/{name}.json`).
There is no index endpoint — the list comes from `https://elements.ai-sdk.dev/sitemap.xml`.

35 are ported. 13 are left, and they no longer split cleanly by dependency: 10 still need a
new npm package, but `attachments`, `voice-selector` and `mic-selector` are merely unported —
the primitives they were blocked on (`popover`, `hover-card`, `command`) are now hand-rolled.
See [Blocked](#blocked). [The port recipe](#the-port-recipe) is how it is done.

## Done

The original seven:

- [x] `code-block` — rangi, not shiki
- [x] `conversation`
- [x] `message` — upstream has since added `button-group`/`tooltip` and the `@streamdown/*` set
- [x] `prompt-input` — composer only, 1464 lines to 5342 bytes
- [x] `reasoning`
- [x] `shimmer` — `@keyframes` instead of `motion`
- [x] `tool`

Then the rest of the dependency-free registry, ported in one parallel sweep:

- [x] `agent`, `chain-of-thought`, `plan`, `task` — agent progress
- [x] `checkpoint`, `commit`, `confirmation`, `queue`, `suggestion` — interaction
- [x] `environment-variables`, `speech-input`, `transcription` — input and media
- [x] `file-tree`, `package-info`, `snippet`, `sources` — tool output
- [x] `image` — `Experimental_GeneratedImage` inlined into `types.ts` as `GeneratedImage`
- [x] `artifact`, `sandbox`, `schema-display`, `web-preview` — panels
- [x] `stack-trace`, `test-results` — diagnostics

Then four that were blocked, unblocked by writing the dependency instead of adding it:

- [x] `terminal` — `src/lib/ansi.ts`, not `ansi-to-react`
- [x] `inline-citation` — `ui/carousel.tsx`, not `embla-carousel-react`, on `ui/hover-card.tsx`
- [x] `model-selector` — `ui/command.tsx`, not `cmdk`, on `ui/popover.tsx` instead of a dialog
- [x] `open-in-chat` — `ui/dropdown-menu.tsx`, not radix, on `ui/popover.tsx`

And one whose blocker was cut out rather than replaced:

- [x] `context` — `tokenlens` dropped; the window and the costs arrive as props

New `components/ui/` primitives, all hand-rolled from radix like `collapsible.tsx`:
`accordion`, `alert`, `avatar`, `card`, `scroll-area`, `separator`, `switch`, `tabs`, and
the panel set below — `popover`, `hover-card`, `dropdown-menu`, `command`, `carousel`.
`tooltip` was **not** built — see the note under [Deviations](#deviations).

### `popover` and `hover-card`

`ui/popover.tsx` replaces `@radix-ui/react-popover`, and `ui/hover-card.tsx` is a thin
layer on it — the same panel, opened by pointer and focus after a delay. Together they
unblock `attachments`, `inline-citation`, `open-in-chat`, `model-selector`,
`voice-selector` and `mic-selector`. `inline-citation`, `model-selector` and
`open-in-chat` are done, on the hand-rolled `carousel`, `command` and `dropdown-menu`
below; `voice-selector` and `mic-selector` are the same shape as `model-selector`, so
only the port is left.

What they do:

- `open`/`defaultOpen`/`onOpenChange` through `useControllableState`, `side` and `align`
  as plain CSS against the `Popover` root, which is the anchor.
- Dismissal on outside pointerdown and `Escape`, listeners on the owner document and
  attached only while open. Outside is decided by `composedPath()`, so the panel works
  inside the `<web-agent>` shadow root.
- Focus into the panel on open, `Tab` kept inside it, focus back to the trigger on close.
  `HoverCardContent` sets `trapFocus={false}`, so a hover card never moves the caret.

What they do **not** do:

- **No `asChild`.** Both triggers are real `<button>`s. `HoverCardTrigger` calls
  `preventDefault()` in `onClick`, which is how a caller tells `PopoverTrigger` to leave
  the open state alone.
- **No floating-ui.** The panel is an absolutely positioned child of the anchor, so it
  scrolls with it but is clipped by any ancestor with `overflow: hidden`. Collision
  handling is one flip to the opposite side, measured against the viewport on open,
  resize and scroll — nothing is shifted along its axis and nothing is clamped.
- **No portal, no arrow, no `collisionBoundary`/`collisionPadding`/`sticky`, and no exit
  animation** — the panel unmounts when closed rather than animating out.
- **No menu semantics.** The panel is a `dialog`, not a `menu`. That layer is
  `ui/dropdown-menu.tsx`, below.

### `dropdown-menu`

`ui/dropdown-menu.tsx` replaces `@radix-ui/react-dropdown-menu` for `open-in-chat`, its
only caller. It is the popover plus the layer the popover leaves out, and nothing else:
`role="menu"` over the panel's own `dialog`, `aria-haspopup="menu"` on the trigger,
`role="menuitem"` items at `tabIndex={-1}`, and roving focus — ArrowUp/ArrowDown with
wraparound, Home/End, Enter and Space to activate, and an activated item closes the menu.
`ArrowDown` on the trigger opens with focus on the first item, `ArrowUp` on the last;
a pointer click leaves focus on the panel, as radix does. Escape, outside dismissal and
the return of focus to the trigger are the popover's, untouched.

- The content finds its own panel through `usePopover().rootRef`, not through a ref of
  its own: `PopoverContent` owns its `ref`, and a second one passed in props would
  silently replace it and break dismissal.
- Enter and Space both `preventDefault()` and call `click()`, so an item activates once
  whether it is a `<button>` or an `<a>` — Space alone would not activate a link.
- No submenus, no checkbox or radio items, no typeahead, no `onSelect` (an item is a
  real button or link, so `onClick` is the event).
- `DropdownMenuItemLink` is the item that navigates, because there is no `asChild` to
  wrap an `<a>` in a `<button>`.

### `carousel`

`ui/carousel.tsx` replaces `embla-carousel-react`, which `inline-citation` is the only
caller of. The browser does the paging: one flex track with `scroll-snap-type: x mandatory`
and `overflow-x: auto`, slides at `flex: 0 0 100%`, and buttons that call `scrollTo` with
the slide's `offsetLeft`. A scroll listener, debounced 80 ms so a smooth scroll reports
once it lands, says which slide is nearest. `useCarousel()` is what embla's `api` was:
`current`, `count`, `canScrollPrev`/`canScrollNext`, `scrollTo`/`scrollPrev`/`scrollNext`.

Not there: drag and pointer gestures (the native scroll is the gesture), `loop`,
`align`/`slidesToScroll`/`orientation`, autoplay and every other plugin, the `setApi`
callback, and `CarouselPrevious`/`CarouselNext` as absolutely positioned overlays — they
are plain buttons the caller places.

### `command`

`ui/command.tsx` replaces `cmdk`: a filter input over a `role="listbox"`, with a roving
highlight. `model-selector` is the first caller; `voice-selector` and `mic-selector` are
the same shape and should build on it unchanged.

An item registers itself with the root in a layout effect — its id, its node, and the
text to match on — so the root can resolve the highlight, count the matches for the empty
state, and point `aria-activedescendant` at the right option. A filtered-out item is
`hidden`, never unmounted, so registration order stays DOM order and the keyboard order
never shifts under the filter. ArrowUp/ArrowDown wrap by default (`loop`), Home/End jump,
Enter clicks the highlighted item, and a pointer move highlights the item under it. Both
the filter text and the chosen value are controlled-or-uncontrolled through
`useControllableState`; `useCommand()` is exported for compound elements built on top.

Not there: cmdk's fuzzy scorer — filtering is a case-insensitive substring test over the
item's value, its `textValue` and its keywords, replaceable with one `filter` prop. Nor
`CommandDialog` (no dialog primitive — the caller puts a `Command` in a `Popover`),
`forceMount`, nested command lists, or `vim`-style `Ctrl-n`/`Ctrl-p` bindings. A group
with no visible item hides itself through `:has()`, not through state.

## Deviations

Worth knowing before reading a ported file against its upstream.

- **No `asChild`.** Upstream leans on radix `Slot` to stop a trigger from wrapping a
  button. Our `CollapsibleTrigger` is a real `<button>`, so `commit` splits its header
  into `CommitHeader` (a div) plus `CommitHeaderTrigger`, and `stack-trace` makes the
  root the `Collapsible` itself with a `role="button"` header. Both end up with fewer
  wrappers than upstream. Exporting the collapsible's context would remove the need.
- **Data props on compound elements.** A transcript part carries plain data, never JSX,
  so `test-results` gained `suites?`, `environment-variables` gained `variables?`, and
  `transcription`'s segment render prop became optional. Each extends the component's own
  `children ?? default` idiom. Everything else composes through a `demo-*.tsx` wrapper
  instead, which keeps the demo shape out of the shipped component — prefer that.
- **No model catalog.** `context` called `tokenlens`'s `getUsage()` to price every token
  count. The catalog is not bundled, so the limits and the money come in as props —
  `usedTokens`, `maxTokens`, `usage`, and a `costs` object in USD — and `modelId` is now
  only a label in the panel. `agent/models.ts` exists for the same reason.
- **Upstream bug fixed.** `environment-variables` ignored its controlled prop; it now uses
  `useControllableState`.
- **`accordion`** keeps `string[]` for both `type="single"` and `"multiple"`, where radix
  carries a bare string for `single`.
- **Tooltips** stay dropped. `checkpoint`, `artifact` and `web-preview` use the native
  `title` attribute, as `MessageAction` and `PromptInputButton` already did.
- **No floating panels.** `context` hung its breakdown off a radix `HoverCard`; it is a
  `Collapsible` now, so the panel opens on click and sits in the flow. Its `Progress` bar
  is a two-div meter, as `test-results` already had.
- **No `dangerouslySetInnerHTML`.** `schema-display` highlighted path parameters with it;
  it now splits on a captured `/(\{[^}]+\})/` and renders spans.
- **Own ANSI parser.** `terminal` ran its output through `ansi-to-react`, which is react-only
  and small enough to write instead. `src/lib/ansi.ts` splits text on SGR sequences, tracks
  the running state, and returns spans: the 16 base colors as `--wa-ansi-*` tokens, plus
  `38;5;<n>` / `48;5;<n>` and truecolor as `rgb()`. Every other CSI sequence — cursor moves,
  erases — is stripped rather than printed, and a sequence a stream cut short is dropped, so
  a half-arrived escape never flickers into the text. Command output is untrusted, so it
  reaches the DOM as spans and never as markup.
- **No remote provider logos.** `model-selector` fetched every logo from
  `https://models.dev/logos/<provider>.svg`, so `ModelSelectorLogo` and
  `ModelSelectorLogoGroup` are gone: a third-party request per item is not something a
  side panel or a host page should make, and the extension CSP blocks it. A caller puts
  its own inline icon in the item instead — `.wa-command-item > svg` already sizes it.
- **No command dialog.** `model-selector` was a `cmdk` palette inside a radix dialog, and
  exported `ModelSelectorDialog` for the ⌘K form. There is no dialog primitive, so the
  panel is a `Popover` and that export is gone, along with `ModelSelectorContent`'s
  `title` prop — `PopoverContent` is labelled by its trigger. `ModelSelectorValue` is new,
  since a popover trigger has to say what is chosen.
- **Dark mode.** Upstream's hard-coded tailwind color pairs (`package-info`,
  `schema-display`, `commit`, `test-results`) became `color-mix()` tints over the status
  tokens, so no ported component carries a dark-mode rule of its own.

- **Citation triggers are the badge.** `inline-citation` wrapped a `Badge` in an `asChild`
  `HoverCardTrigger`; with no `asChild` the trigger is the button and carries the badge
  classes, so there is one box instead of a span inside a button. `InlineCitationCard*`
  props are the hover-card's own types now, not `ComponentProps<typeof …>` of a radix part.
  The carousel context replaces upstream's `setApi` + `CarouselApiContext` pair, so
  `InlineCitationCarousel` holds no state of its own. `new URL(sources[0]).hostname` threw
  on anything that is not a URL; a source that does not parse is printed verbatim.

- **`open-in-chat` ships six providers, not seven.** The provider table upstream also
  holds a `github` entry whose `createUrl` is the identity function and which no exported
  component reads — dead code, and not a chat deep link, so it is gone with its mark.
  The six that ship (ChatGPT, Claude, Cursor, Scira, T3 Chat, v0) build their URLs exactly
  as upstream does. Upstream's per-provider prop aliases (`OpenInChatGPTProps` and the
  rest, all the same type) collapsed into one `OpenInProviderProps`, and `OpenInTrigger`
  wears the `Button` classes instead of wrapping a `Button` through `asChild`. The marks
  are `aria-hidden` and carry no `<title>`: the item text beside them already names the
  product. They are sized by `.wa-open-in-icon`, because upstream gives them no size at
  all.

## The port recipe

Each step, in order. `image` is the smallest worked example — read it beside this list.

1. **Get the source.** `curl -s https://elements.ai-sdk.dev/api/registry/<name>.json`. The
   file text is `.files[0].content`; `.dependencies` and `.registryDependencies` say what
   the component wants from npm and from the registry.
2. **Retarget the imports.** `react`/`react-dom` become `preact` and `preact/hooks`;
   `memo` and `forwardRef` come from `preact/compat`, which is preact's own module.
   `lucide-react` icons become `@/lib/icons` — add the icon there if it is missing, with
   the geometry from lucide. Radix `use-controllable-state` becomes
   `@/lib/use-controllable-state`. A radix primitive that has no `components/ui/` twin is
   a blocker: hand-roll the primitive first, as `ui/collapsible.tsx` was.

   **Write SVG attributes hyphenated**, never camelCase. React lowercases them; preact does
   not — it calls `setAttribute("strokeWidth")`, and the SVG namespace is case-sensitive, so
   the attribute is inert and silently falls back to the SVG default. Nothing warns. Copying
   `strokeWidth`/`strokeDasharray` straight from an upstream file is the easy way to ship a
   ring that always reads full or an icon at the wrong weight — both happened here.

3. **Cut the `ai` dependency.** Copy only the fields the component reads into
   `src/types.ts`, under the upstream type name in a comment.
4. **Convert the classes.** Every tailwind string becomes one `css` block, exported as
   `<name>Styles` at module scope, above the component. Class names are `wa-` prefixed and
   semantic, and are reused when a rule already exists (`.wa-control`, `.wa-tool-body`,
   `.wa-chevron`). Spacing, color and radius come from the tokens in `styles/base.ts` —
   a component must not carry a dark-mode rule of its own.
5. **Register the block.** Add the `*Styles` export to `BLOCKS` in `styles/sheet.tsx`, in
   cascade order: primitives, then composites, then `agent-chat`. An override that layer
   order cannot express is a compound selector, not a bet on order.
6. **Show it in the demo.** A port is not done until a human can see it in a browser.
   Register the component in `ELEMENTS` in `src/components/elements.tsx`, then add a
   canned reply to `replies` in `src/demo-chat.ts` that renders it with realistic fixture
   data. The transcript carries it as a `{ kind: "element", name, props }` part, which
   `agent-chat.tsx` looks up in the registry — so a new element needs no change to the
   `ViewPart` union and no branch of its own. Interactive components get static props and
   no-op callbacks; the demo store holds no state for them.
7. **Drop what needs a new package.** Tooltips fall back to the native `title` attribute.
   Say what was dropped in this file, so the choice is deliberate and reversible.
8. **Check.** `pnpm typecheck`, `pnpm vitest run`, `pnpm lint`, `pnpm fmt`.
   `test/render.test.tsx` fails on a block the manifest misses, but it only sees classes on
   what it renders — add a render test for anything the chat does not yet mount.

`src/index.ts` exports the shell, not single elements, so a port needs no barrel change.

## To port

Nothing — every registry component that needs no new npm dependency is ported. What is
left is in [Blocked](#blocked); restore one of those deliberately, with its dependency.

The `test/render.test.tsx` suite drives all of them from the demo fixtures: one test asserts
every `{ kind: "element" }` name in `demo-chat.ts` resolves in the `ELEMENTS` registry,
another renders the whole demo transcript and asserts every `wa-` class it emits is
declared in the sheet.

## Blocked

Each needs a new npm dependency. Restore deliberately, not by default.

| Component                                                              | Blocker                                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `canvas`, `connection`, `controls`, `edge`, `node`, `panel`, `toolbar` | `@xyflow/react` is react-only. Needs `preact/compat` aliasing, which `test/render.test.tsx` asserts against. |
| `persona`                                                              | `@rive-app/react-webgl2`, react-only                                                                         |
| `jsx-preview`                                                          | `react-jsx-parser`, react-only                                                                               |
| `audio-player`                                                         | `media-chrome` (web components, so framework-neutral) plus `button-group`                                    |
| `attachments`                                                          | radix `hover-card` — `ui/hover-card.tsx` covers it, so this one is unported, not blocked                     |
| `voice-selector`, `mic-selector`                                       | `cmdk` — `ui/command.tsx` covers it, so only the port is left; `model-selector` is the worked example        |
