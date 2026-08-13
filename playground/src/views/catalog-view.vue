<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import { CATALOG, ENTRIES, matches } from "../catalog";
import { openChat } from "../chat-store";
import PreviewCard from "../components/preview-card.vue";

const route = useRoute();

const query = computed(() => (typeof route.query.q === "string" ? route.query.q : ""));

const sections = computed(() =>
  CATALOG.map((section) => ({
    ...section,
    entries: section.entries.filter((entry) => matches(entry, query.value)),
  })).filter((section) => section.entries.length > 0),
);

const found = computed(() =>
  sections.value.reduce((count, section) => count + section.entries.length, 0),
);
</script>

<template>
  <div class="flex flex-col gap-8">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold tracking-tight">Components</h1>
        <p class="mt-1 max-w-2xl text-[0.8125rem] text-soft">
          {{ ENTRIES.length }} components — shadcn primitives and AI SDK Elements, ported to preact.
          The chatbox in the corner renders the same set.
        </p>
      </div>
      <button
        type="button"
        class="rounded-md border border-line px-3 py-2 text-xs font-medium hover:bg-fill"
        @click="openChat('demo')"
      >
        Replay the demo turns
      </button>
    </header>

    <p v-if="query" class="-mt-4 text-xs text-soft">
      {{ found }} of {{ ENTRIES.length }} match “{{ query }}”.
    </p>

    <section v-for="section in sections" :key="section.id" :id="section.id">
      <div
        class="sticky top-14 z-10 -mx-4 flex items-baseline gap-2 border-b border-line bg-page px-4 py-2 sm:-mx-6 sm:px-6"
      >
        <h2 class="text-[0.9375rem] font-semibold">{{ section.title }}</h2>
        <span class="truncate text-xs text-soft">{{ section.note }}</span>
        <span class="ml-auto font-mono text-[0.6875rem] text-soft">{{
          section.entries.length
        }}</span>
      </div>

      <div
        class="mt-4 grid items-start gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(min(24rem, 100%), 1fr))"
      >
        <PreviewCard
          v-for="entry in section.entries"
          :key="entry.name"
          :entry="entry"
          :to="`/c/${entry.name}`"
        />
      </div>
    </section>

    <p v-if="found === 0" class="py-16 text-center text-sm text-soft">
      No component matches “{{ query }}”.
    </p>
  </div>
</template>
