<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";

import type { CatalogEntry } from "../catalog";
import PreactHost from "./preact-host.vue";

defineProps<{
  entry: CatalogEntry;
  /** Where the header links. A component page passes nothing — it is there. */
  to?: string;
  note?: string;
}>();

const body = useTemplateRef<HTMLDivElement>("body");
/** Height an open popover panel needs, so the cards below it stay put. */
const reserved = ref(0);
let observer: MutationObserver | undefined;

/**
 * A popover panel is an absolutely positioned child of its anchor, not a
 * portal, so an open one hangs over the cards below. The card grows to hold it
 * instead, and gives the height back on close. Measured, because every panel is
 * a different height and the panel does not move as the card grows: it is
 * anchored to its trigger.
 *
 * `[data-side]`, not a slot name: PopoverContent spreads the caller's props
 * last, so ModelSelector, DropdownMenu, HoverCard, InlineCitation and OpenIn
 * each replace `data-slot` with a name of their own. `data-side` is the side
 * the panel resolved to, which only PopoverContent writes.
 */
function measure() {
  const el = body.value;
  if (!el) return;

  const panels = el.querySelectorAll<HTMLElement>("[data-side]");
  if (panels.length === 0) {
    reserved.value = 0; // The common case: nothing to measure.
    return;
  }

  const box = el.getBoundingClientRect();
  const pad = Number.parseFloat(getComputedStyle(el).paddingBottom) || 0;
  let need = 0;
  for (const panel of panels) {
    need = Math.max(need, panel.getBoundingClientRect().bottom + pad - box.top);
  }
  reserved.value = need;
}

onMounted(() => {
  if (!body.value) return;
  // A panel mounts and unmounts with the open state, and resizes as a list filters.
  observer = new MutationObserver(measure);
  observer.observe(body.value, { attributes: true, childList: true, subtree: true });
  measure();
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <article
    class="flex flex-col overflow-hidden rounded-xl border border-line bg-page has-[[data-side]]:overflow-visible"
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
    <div
      ref="body"
      class="overflow-x-auto p-3 has-[[data-side]]:overflow-visible"
      :style="reserved > 0 ? { minHeight: `${reserved}px` } : undefined"
    >
      <PreactHost :preview="entry.render" />
    </div>
  </article>
</template>
