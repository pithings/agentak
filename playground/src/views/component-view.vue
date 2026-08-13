<script setup lang="ts">
import { computed } from "vue";

import { findEntry, neighbours, sourcePath } from "../catalog";
import PreviewCard from "../components/preview-card.vue";

const props = defineProps<{ name: string }>();

const entry = computed(() => findEntry(props.name));
const around = computed(() => neighbours(props.name));
</script>

<template>
  <div v-if="entry" class="flex max-w-5xl flex-col gap-6">
    <header class="flex flex-col gap-2">
      <nav class="flex items-center gap-1.5 text-xs text-soft">
        <RouterLink to="/" class="hover:text-ink hover:underline">Components</RouterLink>
        <span>/</span>
        <RouterLink :to="`/?q=${entry.section.title}`" class="hover:text-ink hover:underline">
          {{ entry.section.title }}
        </RouterLink>
      </nav>

      <div class="flex flex-wrap items-center gap-3">
        <h1 class="font-mono text-lg font-semibold tracking-tight">{{ entry.name }}</h1>
        <span class="rounded-full border border-line px-2 py-0.5 text-[0.6875rem] text-soft">
          {{ entry.section.title }}
        </span>
      </div>

      <p class="text-[0.8125rem] text-soft">{{ entry.section.note }}</p>
      <code class="w-fit rounded-md bg-surface px-2 py-1 font-mono text-xs text-soft">
        {{ sourcePath(entry) }}
      </code>
    </header>

    <PreviewCard :entry="entry" note="fixture data" />

    <nav class="flex items-center justify-between gap-3 border-t border-line pt-4 text-xs">
      <RouterLink
        v-if="around.prev"
        :to="`/c/${around.prev.name}`"
        class="rounded-md border border-line px-3 py-2 font-mono hover:bg-fill"
      >
        ← {{ around.prev.name }}
      </RouterLink>
      <span v-else />
      <RouterLink
        v-if="around.next"
        :to="`/c/${around.next.name}`"
        class="rounded-md border border-line px-3 py-2 font-mono hover:bg-fill"
      >
        {{ around.next.name }} →
      </RouterLink>
    </nav>
  </div>

  <div v-else class="py-24 text-center">
    <p class="text-sm">
      No component called <code class="font-mono">{{ name }}</code
      >.
    </p>
    <RouterLink to="/" class="mt-3 inline-block text-xs text-soft hover:text-ink hover:underline">
      Back to the catalog
    </RouterLink>
  </div>
</template>
