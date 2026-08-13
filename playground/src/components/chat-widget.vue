<script setup lang="ts">
import { h } from "preact";
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue";

import { AgentChat } from "@/agent-chat";
import { createPiSession } from "@/agent/session";
import type { ChatSession } from "@/session";
import { u } from "@/styles/base";
import { ChatActions, StartDemo } from "../chat-actions";
import { chat, closeChat, openChat, setChatMode } from "../chat-store";
import { DemoAgent } from "../demo-agent";
import PreactHost from "./preact-host.vue";

/**
 * The in-page chatbox, the way a host page mounts one.
 *
 * It opens on the live agent — `AgentChat` over a pi session, mounted as a
 * preact island like every other piece of the library on this page. The page's
 * tokens reach it by inheritance, and the page's tailwind preflight reaches it
 * too: there is no shadow root between them. The agent starts on no provider:
 * the first message opens its picker, where the free ones need no key.
 *
 * The demo is not a mode a visitor lands on. It is one button under the
 * greeting, and taking it swaps the island for `DemoAgent` — the same surface
 * over the canned turns, streaming on mount.
 *
 * **One title bar.** The surface heads itself — the context meter and a new
 * conversation in the header, the model and the provider in the composer — so
 * the page puts no second bar over it. The page's own buttons go *into* that
 * header, and its demo launcher into the empty state: the `actions` and
 * `emptyActions` props, which both surfaces take.
 *
 * `generateTitle` is on here: the header names the conversation from the first
 * message, and the model renames it once the first answer lands. It is one
 * extra request, so the surface leaves it off unless a host asks.
 *
 * The panel hides rather than unmounts, so minimising keeps the transcript.
 * Switching surface does not — each holds its own.
 *
 * ## Three layouts, one surface
 *
 * The agent is mounted once and only ever restyled, so the transcript survives
 * a resize across every breakpoint:
 *
 * - **`lg` and up — a docked rail.** The widget is a column of the shell's row,
 *   sticky under the topbar and full height, mirroring the sidebar on the other
 *   side. It is chrome of the page rather than a box over it: the page narrows
 *   to make room, and minimising collapses the wrapper's width so the page
 *   takes that room back. The panel keeps the rail width inside that wrapper
 *   and is clipped by it, so it slides out past the right edge instead of
 *   reflowing its transcript on the way.
 * - **`sm` to `lg` — the floating box**, over the bottom-right corner.
 * - **Under `sm` — a sheet** on the whole viewport, no rounding and no border.
 *
 * The launcher is `fixed` in that corner in all three, and shows only while the
 * surface is minimised. It is a sibling of the rail, never a child: the
 * collapsed wrapper would clip it away.
 */
const playDemo = () => setChatMode("demo");
const goLive = () => setChatMode("live");

// The surface carries no loop, so the page picks one. Made on the first live
// mount, and ended with it — this page owns the session, so this page disposes
// it.
let session: ChatSession | undefined;

// Stable factories: `PreactHost` remounts its island when the prop changes.
const live = () => {
  session ??= createPiSession();
  return h(AgentChat, {
    actions: h(ChatActions, { onClose: closeChat }),
    emptyActions: h(StartDemo, { onStart: playDemo }),
    generateTitle: true,
    session,
    style: u.fill,
  });
};

const demo = () =>
  h(DemoAgent, {
    actions: h(ChatActions, { onClose: closeChat, onLive: goLive }),
    autoStart: true,
    style: u.fill,
  });

const surface = computed(() => (chat.mode === "live" ? live : demo));

// Neither surface keeps its transcript across the swap. `post`, so the island is
// already gone when the session it ran ends.
watch(
  () => chat.mode,
  (mode) => {
    if (mode === "live") return;
    session?.dispose?.();
    session = undefined;
  },
  { flush: "post" },
);

/**
 * The two queries that pick the layout, watched rather than read once: a resize
 * restyles the one surface instead of mounting a second.
 */
const phone = globalThis.matchMedia?.("(max-width: 39.999rem)");
const desktop = globalThis.matchMedia?.("(min-width: 64rem)");
const narrow = ref(phone?.matches ?? false);
const wide = ref(desktop?.matches ?? false);

function measure() {
  narrow.value = phone?.matches ?? false;
  wide.value = desktop?.matches ?? false;
}

// Rail and box both grow with the screen rather than sitting at one size: the
// `clamp` floor is a small laptop, the ceiling a wide monitor.
const RAIL = "w-[clamp(20rem,28vw,30rem)]";
const BOX =
  "h-[min(clamp(28rem,72dvh,44rem),calc(100dvh-7rem))] w-[min(clamp(23rem,30vw,32rem),calc(100vw-2rem))]";

// The rail's column. `contents` below `lg`: the wrapper leaves the flow
// altogether, and the `fixed` panel under it lands in the corner on its own.
const wrapper = computed(() =>
  wide.value
    ? `sticky top-14 h-[calc(100dvh-3.5rem)] shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none ${RAIL}`
    : "contents",
);

// Width is all the collapse animates. The panel holds the rail width, so it
// travels right and out as the wrapper narrows; `undefined` drops the inline
// value again and lets the class hold the open width.
const wrapperStyle = computed(() => (wide.value && !chat.open ? { width: "0px" } : undefined));

/**
 * The sheet keeps the whole viewport, keyboard or not.
 *
 * It took the *visual* viewport once — that height and that scroll offset — so
 * that it ended where a virtual keyboard began. But a browser that overlays the
 * keyboard rather than shrinking the layout viewport reports the change a frame
 * late, and every pixel the sheet gave up was a pixel of the page showing in
 * the strip below it. `inset-0` has nothing to show through. The agent lifts
 * its own composer over the keyboard instead, so only that row moves.
 */
const panel = computed(() => {
  if (wide.value) return `${RAIL} h-full border-l border-line bg-page`;
  if (narrow.value) return "fixed inset-0 z-50 h-dvh w-full origin-bottom bg-page";
  return `${BOX} fixed right-4 bottom-4 z-50 origin-bottom-right rounded-xl border border-line bg-page shadow-2xl`;
});

/**
 * The page holds still under the sheet.
 *
 * The sheet covers the screen under `sm`, so the document behind it must not
 * scroll: the agent contains its own scroll chain, but a drag on the backdrop
 * area — or any browser that chains anyway — would otherwise move the page
 * under a panel that hides it. The wider layouts keep their scroll: the box is
 * one corner of the page, and the rail one column of it.
 */
watchEffect((onCleanup) => {
  if (!chat.open || !narrow.value) return;
  const { style } = document.documentElement;
  const before = { overflow: style.overflow, overscrollBehavior: style.overscrollBehavior };
  style.overflow = "hidden";
  style.overscrollBehavior = "none";
  onCleanup(() => {
    style.overflow = before.overflow;
    style.overscrollBehavior = before.overscrollBehavior;
  });
});

/**
 * Escape minimises the surface while it covers the page, from the page and from
 * inside the agent alike — a keyboard event is composed, so it crosses the
 * shadow boundary. Unless the surface already used the key: a popover that
 * closes on Escape marks it handled, and one Escape must not dismiss both the
 * panel and the box under it.
 *
 * The docked rail hides nothing, so Escape leaves it alone: the key must not
 * take a whole column of the page away from under the composer.
 */
function onKey(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented || !chat.open || wide.value) return;
  closeChat();
}

onMounted(() => {
  globalThis.addEventListener("keydown", onKey);
  phone?.addEventListener("change", measure);
  desktop?.addEventListener("change", measure);
  measure();
});

onBeforeUnmount(() => {
  globalThis.removeEventListener("keydown", onKey);
  phone?.removeEventListener("change", measure);
  desktop?.removeEventListener("change", measure);
  session?.dispose?.();
  session = undefined;
});
</script>

<template>
  <div :class="wrapper" :style="wrapperStyle">
    <Transition
      enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
      leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
      enter-from-class="scale-90 opacity-0"
      leave-to-class="scale-90 opacity-0"
    >
      <!-- The rail stays displayed while minimised, and the wrapper clips it —
           so `inert` is what keeps the hidden transcript out of the tab order. -->
      <section
        v-if="chat.mounted"
        v-show="wide || chat.open"
        :class="panel"
        :inert="!chat.open"
        class="flex flex-col overflow-hidden"
        aria-label="Assistant"
      >
        <!-- One island, live or demo: a new factory is a new surface. -->
        <PreactHost class="min-h-0 flex-1" :preview="surface" />
      </section>
    </Transition>
  </div>

  <Transition
    enter-active-class="transition delay-75 duration-150 ease-out motion-reduce:transition-none"
    leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
    enter-from-class="scale-50 opacity-0"
    leave-to-class="scale-50 opacity-0"
  >
    <button
      v-show="!chat.open"
      type="button"
      class="fixed right-4 bottom-4 z-50 grid size-12 origin-bottom-right place-items-center rounded-full bg-brand text-brand-ink shadow-lg hover:opacity-90"
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
</template>
