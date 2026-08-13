<script setup lang="ts">
import { h } from "preact";

import { openChat } from "../chat-store";
import PreactHost from "../components/preact-host.vue";
import { turns } from "../demo-chat";
import { DemoTranscript } from "../demo-transcript";

/**
 * The whole scripted conversation, settled — every part at the state the replay
 * leaves it in, with no playback. The chatbox streams the same turns; this page
 * is the one to read, and its approval gate still answers.
 */
// Stable factory: `PreactHost` remounts its island when the prop changes.
const transcript = () => h(DemoTranscript, {});
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold tracking-tight">Demo conversation</h1>
        <p class="mt-1 max-w-2xl text-[0.8125rem] text-soft">
          {{ turns.length }} turns of one session — a signup form breaks after a deploy, and the
          agent traces it, patches it and commits. Every renderer appears where that step puts it.
        </p>
      </div>
      <button
        type="button"
        class="rounded-md border border-line px-3 py-2 text-xs font-medium hover:bg-fill"
        @click="openChat('demo')"
      >
        Play it in the chatbox
      </button>
    </header>

    <!-- Unclipped while a popover panel is open: the panel is a child of its
         anchor, not a portal, so a clipping box would cut it off. -->
    <div
      class="overflow-hidden rounded-xl border border-line bg-page px-4 py-6 has-[[data-side]]:overflow-visible sm:px-6"
    >
      <PreactHost class="mx-auto max-w-3xl" :preview="transcript" />
    </div>
  </div>
</template>
