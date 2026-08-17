<script setup lang="ts">
import { h } from "preact";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from "vue";

import { createPiSession, type PiSession } from "@/pi/session.ts";
import { browserStorage } from "@/pi/storage.ts";
import { u } from "@/styles/base.ts";
import { ChatPanel } from "@/vue/index.ts";
import { ChatActions, StartDemo } from "../chat-actions.tsx";
import { chat, closeChat, openChat, setChatMode } from "../chat-store.ts";
import { DemoAgent } from "../demo-agent.tsx";
import PreactHost from "./preact-host.vue";

/**
 * The in-page chatbox, the way a host page mounts one.
 *
 * It opens on the live agent — `ChatPanel` from `agentak/vue`, the surface as
 * a vue element, over a pi session this page makes and ends itself. The wrapper
 * carries no loop, so `createPiSession()` below is the one import that brings
 * one. The page's tokens reach the surface by inheritance, and the page's
 * tailwind preflight reaches it too: there is no shadow root between them. The
 * agent starts on no provider: the first message opens its picker, where the
 * free ones need no key.
 *
 * The demo is not a mode a visitor lands on. It is one button under the
 * greeting, and taking it swaps the island for `DemoAgent` — the same surface
 * over the canned turns, streaming on mount.
 *
 * **One title bar.** The surface heads itself — the title, a new conversation
 * and the stored ones over the transcript, the model, the provider and the
 * context meter in the bar under the composer — so the page puts no second bar
 * over it. The page's own buttons go *into* that bar, and its demo launcher
 * into the empty state: the `actions` and `emptyActions` props, which both
 * surfaces take.
 *
 * `generateTitle` is on here: the header names the conversation from the first
 * message, and the model renames it once the first answer lands. It is one
 * extra request, so the surface leaves it off unless a host asks.
 *
 * The panel hides rather than unmounts, so minimising keeps the transcript. The
 * demo swap ends the live session instead — but the conversation is stored
 * before it goes, so coming back reopens it where it was left.
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

// The bar chrome and the demo launcher are preact children — the surface
// inside the element is preact, whatever renders the page around it. Constants:
// nothing in them changes, so the island is never redrawn for their sake.
const actions = h(ChatActions, { onClose: closeChat });
const startDemo = h(StartDemo, { onStart: playDemo });

/**
 * The loop. The surface takes a session and makes none, so the page picks one —
 * and whoever makes a session ends it.
 *
 * Made on the first live mount rather than at setup: a phone lands minimised and
 * unmounted, and a session made there would load a stored provider's model list
 * for a chat nobody opened. The demo swap ends it.
 *
 * ## The conversations are the session's own
 *
 * `history: true` is the whole of what this page writes for them: the session
 * keeps every conversation in the same store as the keys, lists them on the
 * chat's own history page — the clock in the header — and replaces its state
 * with the one that is picked. Nothing is swapped around the chat, so the page
 * keeps no list and no ids of its own.
 *
 * A reload opens on a new conversation all the same — the stored ones are
 * reached from the page. The transcript, the provider, the model and the
 * thinking level travel together, so one that is opened comes back on the model
 * its answers were written by rather than whatever this browser used last.
 */
const session = shallowRef<PiSession>();

watch(
  () => chat.mounted && chat.mode === "live",
  (live) => {
    if (!live) {
      // Whoever made the session ends it, and ending it stores what it holds.
      session.value?.dispose();
      session.value = undefined;
      return;
    }
    // The session keeps its choices and its conversations in memory unless a
    // host asks for more. This page asks: the key and the model are typed once,
    // not once a reload, and the transcripts outlive the tab.
    // `page: true` offers the model whatever this document publishes on
    // `document.modelContext` — `page-tools.ts` is what it finds here.
    session.value ??= createPiSession({
      history: true,
      page: true,
      storage: browserStorage(),
    });
  },
  { immediate: true },
);

// The demo is the one surface the wrapper does not cover — canned turns, no
// loop — so it stays a hand-mounted island. A stable factory: `PreactHost`
// remounts when the prop changes.
const demo = () =>
  h(DemoAgent, {
    actions: h(ChatActions, { onClose: closeChat, onLive: goLive }),
    autoStart: true,
    style: u.fill,
  });

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
  // A tab that closes needs no flush of its own: the session writes the
  // conversation every time the loop settles.
  session.value?.dispose();
  session.value = undefined;
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
        <!-- One surface at a time: the watcher above ends the session with the
             mode, and stores the conversation on the way out. The demo keeps
             nothing — its turns are canned.
             `tokens` is off because `main.ts` declares them for the page. -->
        <ChatPanel
          v-if="session"
          class="min-h-0 flex-1"
          :actions="actions"
          :empty-actions="startDemo"
          generate-title
          :session="session"
          :tokens="false"
        />
        <PreactHost v-else-if="chat.mode === 'demo'" class="min-h-0 flex-1" :preview="demo" />
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
