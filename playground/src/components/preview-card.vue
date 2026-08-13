<script setup lang="ts">
import type { CatalogEntry } from "../catalog";
import PreactHost from "./preact-host.vue";

defineProps<{
  entry: CatalogEntry;
  /** Where the header links. A component page passes nothing — it is there. */
  to?: string;
  note?: string;
}>();

/**
 * A popover panel is an absolutely positioned child of its anchor, not a
 * portal, so every box between the trigger and the page must let it out: the
 * card unclips itself while one is open, and the open card rises over its
 * neighbours so the panel is not painted under the next card.
 *
 * `[data-side]`, not a slot name: PopoverContent spreads the caller's props
 * last, so ModelSelector, DropdownMenu, HoverCard, InlineCitation and OpenIn
 * each replace `data-slot` with a name of their own. `data-side` is the side
 * the panel resolved to, which only PopoverContent writes.
 */
</script>

<template>
  <article
    class="flex flex-col overflow-hidden rounded-xl border border-line bg-page has-[[data-side]]:relative has-[[data-side]]:z-20 has-[[data-side]]:overflow-visible"
  >
    <header
      class="flex items-baseline gap-2 border-b border-line bg-surface px-3 py-1.5 font-mono text-xs text-soft"
    >
      <RouterLink v-if="to" :to="to" class="truncate hover:text-ink hover:underline">
        {{ entry.name }}
      </RouterLink>
      <span v-else class="truncate">{{ entry.name }}</span>
      <span v-if="note" class="ml-auto truncate font-sans text-[0.6875rem]">
        {{ note }}
      </span>
    </header>

    <!-- Every demo is arbitrary content, so the card clips it rather than
         letting one wide table stretch the grid column — unless a panel is
         open, which must not be cut off. -->
    <div class="overflow-x-auto p-3 has-[[data-side]]:overflow-visible">
      <PreactHost :preview="entry.render" />
    </div>
  </article>
</template>
