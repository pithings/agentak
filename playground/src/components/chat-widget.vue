<script setup lang="ts">
import { h } from "preact";
import { onBeforeUnmount, onMounted } from "vue";

import { u } from "@/styles/base";
// Defines `<web-agent>`. Side effect: import it, then write the tag.
import "@/element";
import { type ChatMode, chat, closeChat, openChat, setChatMode } from "../chat-store";
import { DemoAgent } from "../demo-agent";
import PreactHost from "./preact-host.vue";

/**
 * The in-page chatbox, the way a host page mounts one.
 *
 * It opens on a chooser, so neither surface starts until it is asked for. Live
 * is then the custom element: a shadow root, so nothing of this page's tailwind
 * reaches the agent and nothing of the agent reaches the page — the only thing
 * that crosses is the `--wa-*` tokens, which inherit. Demo is the same surface
 * over the canned turns, mounted as a plain preact island. `Switch` in the
 * header goes back to the chooser, which drops whichever was running.
 *
 * The panel hides rather than unmounts, so minimising keeps the transcript.
 *
 * The launcher and the panel share the bottom-right corner: the button is the
 * one element in flow, the panel is absolute over it, and both scale from that
 * corner. So the bubble grows into the box and shrinks back out of it, and the
 * launcher is gone while the box is up — the header minimises it instead.
 */
const demo = () => h(DemoAgent, { autoStart: true, style: u.fill });

const SUBTITLE: Record<ChatMode, string> = {
  choose: "Pick a surface to open",
  live: "Live — your key, your provider",
  demo: "Demo — canned turns",
};

/**
 * Escape minimises the box, from the page and from inside the agent alike — a
 * keyboard event is composed, so it crosses the shadow boundary. Unless the box
 * already used the key: a popover that closes on Escape marks it handled, and
 * one Escape must not dismiss both the panel and the box under it.
 */
function onKey(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented || !chat.open) return;
  closeChat();
}

onMounted(() => globalThis.addEventListener("keydown", onKey));
onBeforeUnmount(() => globalThis.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="fixed right-4 bottom-4 z-50">
    <Transition
      enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
      enter-from-class="scale-90 opacity-0"
      leave-to-class="scale-90 opacity-0"
    >
      <section
        v-if="chat.mounted"
        v-show="chat.open"
        class="absolute right-0 bottom-0 flex h-[min(34rem,calc(100dvh-8rem))] w-[min(23rem,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-line bg-page shadow-2xl"
        aria-label="Assistant"
      >
        <header class="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <span class="grid size-7 place-items-center rounded-full bg-brand text-brand-ink">
            <svg
              viewBox="0 0 24 24"
              class="size-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="4" y="8" width="16" height="11" rx="3" />
              <path d="M12 4v4M9 13h.01M15 13h.01" stroke-linecap="round" />
            </svg>
          </span>
          <div class="min-w-0">
            <p class="text-[0.8125rem] leading-4 font-semibold">Assistant</p>
            <p class="truncate text-[0.6875rem] text-soft">{{ SUBTITLE[chat.mode] }}</p>
          </div>

          <div class="ml-auto flex items-center gap-1">
            <button
              v-if="chat.mode !== 'choose'"
              type="button"
              class="rounded border border-line px-1.5 py-1 text-[0.6875rem] text-soft hover:bg-fill hover:text-ink"
              @click="setChatMode('choose')"
            >
              Switch
            </button>
            <button
              type="button"
              class="rounded p-1 text-soft hover:bg-fill hover:text-ink"
              aria-label="Minimise the assistant"
              @click="closeChat()"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        <div class="min-h-0 flex-1">
          <div v-if="chat.mode === 'choose'" class="flex h-full flex-col justify-center gap-2 p-4">
            <button
              type="button"
              class="rounded-xl border border-line p-3 text-left hover:bg-fill"
              @click="setChatMode('live')"
            >
              <span class="block text-[0.8125rem] font-medium">Live agent</span>
              <span class="mt-0.5 block text-[0.6875rem] text-soft">
                The real loop over this page. Asks for a provider key, kept in this browser.
              </span>
            </button>
            <button
              type="button"
              class="rounded-xl border border-line p-3 text-left hover:bg-fill"
              @click="setChatMode('demo')"
            >
              <span class="block text-[0.8125rem] font-medium">Demo</span>
              <span class="mt-0.5 block text-[0.6875rem] text-soft">
                The canned turns, streamed. No key, and every ported element on show.
              </span>
            </button>
          </div>

          <web-agent v-else-if="chat.mode === 'live'" class="block h-full w-full" />
          <PreactHost v-else class="h-full" :preview="demo" />
        </div>
      </section>
    </Transition>

    <Transition
      enter-active-class="transition delay-75 duration-150 ease-out motion-reduce:transition-none"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
      enter-from-class="scale-50 opacity-0"
      leave-to-class="scale-50 opacity-0"
    >
      <button
        v-show="!chat.open"
        type="button"
        class="grid size-12 origin-bottom-right place-items-center rounded-full bg-brand text-brand-ink shadow-lg hover:opacity-90"
        aria-label="Open the assistant"
        :aria-expanded="chat.open"
        @click="openChat()"
      >
        <svg viewBox="0 0 24 24" class="size-5" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4-.8L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </Transition>
  </div>
</template>
