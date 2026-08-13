<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { CATALOG, ENTRIES, matches } from "../catalog";

defineProps<{ open: boolean }>();

const route = useRoute();
const router = useRouter();

/** The filter lives in the URL, so the sidebar and the grid read one value. */
const query = computed(() => (typeof route.query.q === "string" ? route.query.q : ""));
const draft = ref(query.value);
watch(query, (value) => {
  if (value !== draft.value) draft.value = value;
});

const search = useTemplateRef<HTMLInputElement>("search");

function onInput(event: Event) {
  draft.value = (event.target as HTMLInputElement).value;
  router.replace({ query: { ...route.query, q: draft.value || undefined } });
}

const groups = computed(() =>
  CATALOG.map((section) => ({
    section,
    entries: section.entries.filter((entry) => matches(entry, draft.value)),
  })).filter((group) => group.entries.length > 0),
);

const found = computed(() =>
  groups.value.reduce((count, group) => count + group.entries.length, 0),
);

/**
 * `/` focuses the filter. The composed path, not `event.target`: the chat is a
 * shadow root, so a keystroke in its textarea arrives retargeted to the host
 * element and would look like it came from the page.
 */
function onKey(event: KeyboardEvent) {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;

  const target = event.composedPath()[0] as HTMLElement | undefined;
  if (target?.isContentEditable) return;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

  event.preventDefault();
  search.value?.focus();
}

onMounted(() => globalThis.addEventListener("keydown", onKey));
onBeforeUnmount(() => globalThis.removeEventListener("keydown", onKey));
</script>

<template>
  <aside
    class="w-full shrink-0 border-r border-line bg-page lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] lg:w-64 lg:overflow-y-auto"
    :class="open ? 'fixed inset-x-0 top-14 bottom-0 z-30 block overflow-y-auto' : 'hidden'"
  >
    <div class="p-3">
      <label class="relative block">
        <svg
          viewBox="0 0 24 24"
          class="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-soft"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" stroke-linecap="round" />
        </svg>
        <input
          ref="search"
          :value="draft"
          type="search"
          placeholder="Filter components"
          aria-label="Filter components"
          class="w-full rounded-md border border-line bg-surface py-1.5 pr-8 pl-8 text-xs outline-none placeholder:text-soft focus:border-ring"
          @input="onInput"
        />
        <kbd
          class="pointer-events-none absolute top-1.5 right-2 rounded border border-line px-1 font-mono text-[0.625rem] text-soft"
        >
          /
        </kbd>
      </label>
    </div>

    <nav class="px-3 pb-8 text-sm">
      <RouterLink
        to="/"
        exact-active-class="bg-fill text-ink"
        class="flex items-center justify-between rounded-md px-2 py-1.5 text-soft hover:bg-fill hover:text-ink"
      >
        <span>All components</span>
        <span class="font-mono text-[0.6875rem]">{{ ENTRIES.length }}</span>
      </RouterLink>

      <div v-for="group in groups" :key="group.section.id" class="mt-5">
        <p class="px-2 pb-1 text-[0.6875rem] font-semibold tracking-wide text-soft uppercase">
          {{ group.section.title }}
        </p>
        <ul>
          <li v-for="entry in group.entries" :key="entry.name">
            <RouterLink
              :to="`/c/${entry.name}`"
              active-class="bg-fill text-ink"
              class="block truncate rounded-md px-2 py-1 font-mono text-xs text-soft hover:bg-fill hover:text-ink"
            >
              {{ entry.name }}
            </RouterLink>
          </li>
        </ul>
      </div>

      <p v-if="found === 0" class="px-2 py-6 text-xs text-soft">Nothing matches “{{ draft }}”.</p>
    </nav>
  </aside>
</template>
