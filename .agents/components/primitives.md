# Hand-rolled primitives

`components/ui/` replaces every radix package. Read the limits before you build on one:
they are deliberate, and a caller that needs more must add the layer itself.

## `popover` and `hover-card`

`ui/hover-card.tsx` is a thin layer on `ui/popover.tsx` — the same panel, opened by
pointer and focus after a delay.

- `open`/`defaultOpen`/`onOpenChange` through `useControllableState`; `side` and
  `align` are plain CSS against the `Popover` root, which is the anchor.
- Dismissal on outside pointerdown and `Escape`, on the owner document, only while
  open. Outside is decided by `composedPath()`, so the panel works inside the
  `<web-agent>` shadow root. Closing on `Escape` calls `preventDefault()`: the key is
  used, so a host that closes its own surface on `Escape` keeps it open behind a panel.
- Focus into the panel on open, `Tab` kept inside, focus back to the trigger on close.
  `HoverCardContent` sets `trapFocus={false}`, so a hover card never moves the caret.
- **No floating-ui.** The panel is an absolutely positioned child of the anchor, so it
  scrolls with it but is clipped by any ancestor with `overflow: hidden`. Collision
  handling is one flip to the opposite side (`fitSide`), measured on open, resize and
  scroll; nothing is shifted along its axis and nothing is clamped. `side` stays the
  wanted side, never the resolved one, so the flip cannot oscillate.
- **No portal, no arrow, no `collisionBoundary`/`collisionPadding`/`sticky`, no exit
  animation** — the panel unmounts when closed.
- **No menu semantics.** The panel is a `dialog`. That layer is `dropdown-menu`.

## `dropdown-menu`

The popover plus the layer it leaves out, and nothing else: `role="menu"` over the
panel, `aria-haspopup="menu"` on the trigger, `role="menuitem"` items at
`tabIndex={-1}`, and roving focus — ArrowUp/ArrowDown with wraparound, Home/End, Enter
and Space to activate, and an activated item closes the menu. `ArrowDown` on the
trigger opens on the first item, `ArrowUp` on the last.

- The content finds its panel through `usePopover().rootRef`, not a ref of its own:
  `PopoverContent` owns its `ref`, and a second one passed in props would silently
  replace it and break dismissal.
- Enter and Space both `preventDefault()` and call `click()`, so an item activates once
  whether it is a `<button>` or an `<a>` — Space alone would not activate a link.
- `DropdownMenuItemLink` is the item that navigates, because there is no `asChild`.
- No submenus, no checkbox or radio items, no typeahead, no `onSelect` (an item is a
  real button or link, so `onClick` is the event).

## `carousel`

The browser does the paging: one flex track with `scroll-snap-type: x mandatory` and
`overflow-x: auto`, slides at `flex: 0 0 100%`, and buttons that call `scrollTo` with
the slide's `offsetLeft`. A scroll listener, debounced so a smooth scroll reports once
it lands, says which slide is nearest. `useCarousel()` gives `current`, `count`,
`canScrollPrev`/`canScrollNext`, `scrollTo`/`scrollPrev`/`scrollNext`.

Not there: drag gestures (the native scroll is the gesture), `loop`,
`align`/`slidesToScroll`/`orientation`, autoplay and every plugin, the `setApi`
callback, and prev/next as absolutely positioned overlays — they are plain buttons the
caller places.

## `command`

A filter input over a `role="listbox"`, with a roving highlight. An item registers
itself with the root in a layout effect — its id, its node, and the text to match on —
so the root can resolve the highlight, count the matches for the empty state, and point
`aria-activedescendant` at the right option. **A filtered-out item is `hidden`, never
unmounted**, so registration order stays DOM order and the keyboard order never shifts
under the filter. A group reads its own items from the rendered tree and hides itself
when all of them are hidden, because a caller can wrap `CommandItem` in a component of
its own. Both the filter text and the chosen value go through `useControllableState`;
`useCommand()` is exported for compound elements.

Not there: cmdk's fuzzy scorer — filtering is a case-insensitive substring test over
the item's value, its `textValue` and its keywords, replaceable with one `filter` prop.
Nor `CommandDialog` (no dialog primitive — put a `Command` in a `Popover`),
`forceMount`, nested lists, or `Ctrl-n`/`Ctrl-p`.
