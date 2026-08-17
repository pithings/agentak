# Hand-rolled primitives

`components/ui/` intentionally replaces Radix and carries only product-required behavior.
Do not assume upstream Radix APIs.

## Popover and hover card

- Popovers are absolutely positioned children, not portals. Overflow ancestors can clip
  them. Collision handling only flips sides; there is no axis shift, arrow, or exit
  animation.
- Dismiss on outside pointerdown and Escape uses `composedPath()`. Escape is prevented so
  a host does not also close its surface.
- Focus is trapped and restored. Hover cards disable focus trapping.
- Position is measured every open frame because the composer and virtual keyboard move
  without reliable scroll/resize events. Bounds intersect the visual viewport with the
  nearest clipping ancestor. Preserve the iOS coordinate fallback in `origin()`.
- `--popover-available` is always written so nested popovers do not inherit stale room.

## Dropdown menu

Adds menu semantics and roving keyboard focus to Popover. Items are real buttons or links;
there is no `asChild`, submenu, checkbox/radio item, typeahead, or `onSelect`.
`DropdownMenuItemLink` is the navigation item.

## Command

Filtering is case-insensitive substring matching unless replaced by `filter`. Hidden items
stay mounted so registration and keyboard order remain stable. `CommandList` normally caps
at `18rem`, but releases that cap while a virtual keyboard is open and uses the popover's
available room.

## Carousel

Uses native horizontal scrolling and scroll snap. It has no loop, plugins, autoplay,
custom drag layer, orientation option, or overlay controls.
