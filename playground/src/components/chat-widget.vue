<script setup lang="ts">
import { h } from "preact";
import { onBeforeUnmount, onMounted } from "vue";

import { u } from "@/styles/base";
// Defines `<web-agent>`. Side effect: import it, then write the tag.
import "@/element";
import { ChatActions, StartDemo } from "../chat-actions";
import { chat, closeChat, openChat, setChatMode } from "../chat-store";
import { DemoAgent } from "../demo-agent";
import PreactHost from "./preact-host.vue";

/**
 * The in-page chatbox, the way a host page mounts one.
 *
 * It opens on the live agent — the custom element, so the agent runs behind a
 * shadow root: nothing of this page's tailwind reaches in and nothing of the
 * agent reaches out, and the only thing that crosses is the `--wa-*` tokens,
 * which inherit. The agent starts on no provider: the first message
 * opens its picker, where the free ones need no key.
 *
 * The demo is not a mode a visitor lands on. It is one button under the
 * greeting, and taking it swaps the element for `DemoAgent` — the same surface
 * over the canned turns, mounted as a plain preact island, streaming on mount.
 *
 * **One title bar.** The surface heads itself — the context meter and a new
 * conversation in the header, the model and the provider in the composer — so
 * the page puts no second bar over it. The page's own buttons go *into* that
 * header, and its demo launcher into the empty state: light DOM under
 * `slot="actions"` and `slot="empty"` for the element, the matching props for
 * the demo island.
 *
 * The panel hides rather than unmounts, so minimising keeps the transcript.
 * Switching surface does not — each holds its own.
 *
 * The launcher and the panel share the bottom-right corner: the button is the
 * one element in flow, the panel is absolute over it, and both scale from that
 * corner. So the bubble grows into the box and shrinks back out of it, and the
 * launcher is gone while the box is up — the header minimises it instead.
 *
 * Under `sm` the panel leaves that corner: it goes `fixed` across the viewport,
 * a sheet on the bottom edge, and scales from the bottom instead. The launcher
 * keeps its corner — it is never on screen at the same time.
 */
const playDemo = () => setChatMode("demo");
const goLive = () => setChatMode("live");

// Stable factories: `PreactHost` remounts its island when the prop changes.
const liveActions = () => h(ChatActions, { onClose: closeChat });
const liveEmpty = () => h(StartDemo, { onStart: playDemo });

const demo = () =>
  h(DemoAgent, {
    actions: h(ChatActions, { onClose: closeChat, onLive: goLive }),
    autoStart: true,
    style: u.fill,
  });

// The box grows with the screen rather than sitting at one size: the `clamp` is
// the desktop range — a small laptop gets the floor, a wide monitor the ceiling.
// Under `sm` it stops being a floating box and becomes a sheet: the phone gets
// the whole width, so a gutter never eats a line of the transcript.
const box =
  "h-[min(clamp(28rem,72dvh,44rem),calc(100dvh-7rem))] w-[min(clamp(23rem,30vw,32rem),calc(100vw-2rem))] max-sm:h-[85dvh] max-sm:w-full";

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
        :class="box"
        class="absolute right-0 bottom-0 flex origin-bottom-right flex-col overflow-hidden rounded-xl border border-line bg-page shadow-2xl max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:origin-bottom max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0"
        aria-label="Assistant"
      >
        <!-- Light DOM: the element places these — the header, and the empty state. -->
        <web-agent v-if="chat.mode === 'live'" class="block min-h-0 flex-1">
          <div slot="actions" class="contents">
            <PreactHost class="contents" :preview="liveActions" />
          </div>
          <div slot="empty" class="contents">
            <PreactHost class="contents" :preview="liveEmpty" />
          </div>
        </web-agent>

        <PreactHost v-else class="min-h-0 flex-1" :preview="demo" />
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
