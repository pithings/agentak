<script setup lang="ts">
import { h } from "preact";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from "vue";

import { createPiSession, type PiSession } from "@/pi/session.ts";
import { u } from "@/styles/base.ts";
import { ChatPanel } from "@/vue/index.ts";
import { ChatActions, StartDemo } from "../chat-actions.tsx";
import {
  conversations,
  keepConversation,
  newConversation,
  storedConversation,
} from "../chat-history.ts";
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

// The header chrome and the demo launcher are preact children — the surface
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
 * ## One session, one conversation
 *
 * The session holds a single conversation and knows nothing of the ones beside
 * it, so the page keeps the list — `chat-history.ts` — and switches between them
 * by switching sessions. The transcript, the provider, the model and the
 * thinking level all travel in the snapshot, so a reload comes back on the same
 * model the answers were written by rather than whatever this browser used last.
 */
const session = shallowRef<PiSession>();

/** The conversation the live session holds, and the id its transcript is kept under. */
let held: string | undefined;
let untrack: (() => void) | undefined;
let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * Written a beat after the agent settles rather than on every event: a streamed
 * answer notifies per token, and each write is a `JSON.stringify` of the whole
 * transcript.
 */
const SETTLE = 400;

function store() {
  if (pending) {
    clearTimeout(pending);
    pending = undefined;
  }
  const live = session.value;
  if (!live || !held) return;

  const snapshot = live.save();
  // Empty, with something stored under the same id: the header's new
  // conversation button was taken. The stored one stays where it is, and the
  // box moves on to an id of its own.
  if (snapshot.messages.length === 0) {
    if (storedConversation(held)) newConversation();
    return;
  }
  keepConversation(held, snapshot);
}

function open(id: string | undefined) {
  store();
  untrack?.();
  untrack = undefined;
  session.value?.dispose();
  held = id;

  if (!id) {
    session.value = undefined;
    return;
  }
  const live = createPiSession({ snapshot: storedConversation(id) });
  session.value = live;
  untrack = live.subscribe(() => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(store, SETTLE);
  });
}

watch(
  () => (chat.mounted && chat.mode === "live" ? conversations.currentId : undefined),
  (id) => {
    // The id minted for the session already up: it is empty and nothing is
    // stored under the new id, so only the name of what is being written moves.
    // Picking a stored conversation is the other case, and that one swaps.
    if (id && held && session.value?.save().messages.length === 0 && !storedConversation(id)) {
      held = id;
      return;
    }
    open(id);
  },
  { immediate: true },
);

// A tab closing does not wait for the beat above.
const flush = () => store();

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
  globalThis.addEventListener("pagehide", flush);
  phone?.addEventListener("change", measure);
  desktop?.addEventListener("change", measure);
  measure();
});

onBeforeUnmount(() => {
  globalThis.removeEventListener("keydown", onKey);
  globalThis.removeEventListener("pagehide", flush);
  phone?.removeEventListener("change", measure);
  desktop?.removeEventListener("change", measure);
  store();
  untrack?.();
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
