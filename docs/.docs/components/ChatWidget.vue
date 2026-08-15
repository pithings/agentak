<script setup lang="ts">
import {
  type Component,
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watchEffect,
} from "vue";
import type { PiSession } from "../../../src/pi/index.ts";
// import type { PiSession } from "agentak/pi";

/**
 * The chat button of the documentation site, and the chat it opens.
 *
 * The chat is the real thing, not a screenshot: `ChatPanel` from `agentak/vue`
 * over a Pi session this component makes and ends itself. The session starts on
 * no provider, so the first message opens the picker, where the free providers
 * need no API key.
 *
 * `.docs/layouts/docs.vue` renders it beside the page, so the button is on
 * every documentation page.
 *
 * ## Two layouts, one surface
 *
 * The chat is never a box over the page. It is mounted once and only ever
 * restyled, so the transcript survives a resize:
 *
 * - **`lg` and up — a docked rail** on the right, full height. It is chrome of
 *   the site: the page shifts to make room, so the rail covers nothing.
 * - **Below `lg` — a sheet** over the whole screen. A small screen has no room
 *   beside the page, so the chat takes all of it and the page holds still
 *   underneath.
 *
 * The button opens both, and the panel grows out of it: the morph is a
 * `clip-path` circle centred on the button, so the chat unfolds from the round
 * button rather than appearing over it. Both layouts reach the bottom-right
 * corner, so that centre is the same one for each.
 */

/** The rail width, and therefore the room the page gives up for it. */
const RAIL = "clamp(20rem, 26vw, 28rem)";
const DURATION = 260;

const open = ref(false);
const wide = ref(false);

const Panel = shallowRef<Component>();
const session = shallowRef<PiSession>();
const ui = shallowRef<{ Button: unknown; h: typeof import("preact").h }>();

/**
 * Nothing loads until the button is taken.
 *
 * The docs are server rendered and the chat is a browser widget, so every
 * import here is dynamic — the server never loads them, and a reader who never
 * opens the chat never downloads the chat. Once mounted the panel is only
 * hidden, so minimising it keeps the transcript.
 */
async function load() {
  if (session.value) return;
  const [{ ChatPanel }, { createPiSession }, { Button }, preact] = await Promise.all([
    import("../../../src/vue/index.ts"),
    import("../../../src/pi/index.ts"),
    import("../../../src/components/index.ts"),
    import("preact"),
  ]);
  ui.value = { Button, h: preact.h };
  session.value = createPiSession();
  Panel.value = ChatPanel;
}

const close = () => {
  open.value = false;
};

function toggle() {
  open.value = !open.value;
  if (open.value) void load();
}

/**
 * The minimise button, on the chat's own header.
 *
 * The surface heads itself, so the site adds no second title bar: `actions`
 * goes at the end of that header, beside the chat's own buttons. It is a preact
 * child, whatever renders the page around it — `Button` from
 * `agentak/components` is the one the buttons beside it use, so they match.
 *
 * The chevron points at where the chat goes: down to the button below the box,
 * out to the right edge for the rail.
 */
const actions = computed(() => {
  if (!ui.value) return undefined;
  const { Button, h } = ui.value;
  return h(
    Button as never,
    {
      "aria-label": "Minimise the assistant",
      onClick: close,
      size: "icon-sm",
      title: "Minimise",
      variant: "ghost",
    },
    h(
      "svg",
      {
        fill: "none",
        stroke: "currentColor",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-width": "2",
        viewBox: "0 0 24 24",
      },
      h("path", { d: wide.value ? "m9 18 6-6-6-6" : "m6 9 6 6 6-6" }),
    ),
  );
});

/**
 * The page gives the rail its room.
 *
 * Padding on the root element rather than a wrapper: the header, the content
 * and the footer are all inside it, so the whole site narrows and the rail
 * covers none of it. The rail itself is fixed, so it stays out of that padding.
 */
watchEffect((onCleanup) => {
  if (!open.value || !wide.value) return;
  const { style } = document.documentElement;
  const before = { padding: style.paddingRight, transition: style.transition };
  const still = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!still) style.transition = `padding-right ${DURATION}ms ease-out`;
  style.paddingRight = RAIL;
  onCleanup(() => {
    style.paddingRight = before.padding;
    // The site keeps its width back at the same speed, and the inline
    // transition goes once it has.
    setTimeout(() => {
      if (style.paddingRight === before.padding) style.transition = before.transition;
    }, DURATION);
  });
});

/**
 * The page holds still under the sheet.
 *
 * The sheet covers the screen, so the document behind it must not scroll: the
 * chat contains its own scroll chain, but a drag on any part of it that does
 * not scroll would otherwise move the page under a panel that hides it.
 */
watchEffect((onCleanup) => {
  if (!open.value || wide.value) return;
  const { style } = document.documentElement;
  const before = { overflow: style.overflow, overscroll: style.overscrollBehavior };
  style.overflow = "hidden";
  style.overscrollBehavior = "none";
  onCleanup(() => {
    style.overflow = before.overflow;
    style.overscrollBehavior = before.overscroll;
  });
});

// Escape minimises the chat, from the page and from inside it alike — a
// keyboard event is composed. Unless the chat already used the key: one Escape
// must not close both a picker and the panel under it.
function onKey(event: KeyboardEvent) {
  if (event.key === "Escape" && !event.defaultPrevented) close();
}

const desktop = globalThis.matchMedia?.("(min-width: 64rem)");
const measure = () => {
  wide.value = desktop?.matches ?? false;
};

onMounted(() => {
  measure();
  desktop?.addEventListener("change", measure);
  globalThis.addEventListener("keydown", onKey);
});

// Whoever makes a session ends it.
onBeforeUnmount(() => {
  desktop?.removeEventListener("change", measure);
  globalThis.removeEventListener("keydown", onKey);
  session.value?.dispose();
  session.value = undefined;
});
</script>

<template>
  <Transition name="morph">
    <!-- Hidden rather than unmounted, so the transcript survives a minimise.
         `inert` is what keeps the hidden chat out of the tab order. -->
    <section
      v-if="session"
      v-show="open"
      :inert="!open"
      :style="wide ? { width: RAIL } : undefined"
      aria-label="Assistant"
      :class="[
        'fixed inset-y-0 right-0 z-[60] flex flex-col overflow-hidden bg-background',
        wide ? 'border-l border-border' : 'left-0 w-full',
      ]"
    >
      <component :is="Panel" :actions="actions" :session="session" class="min-h-0 flex-1" />
    </section>
  </Transition>

  <Transition
    enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
    leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
    enter-from-class="scale-50 opacity-0"
    leave-to-class="scale-50 opacity-0"
  >
    <!-- The button goes as the chat grows out of it, and comes back when the
         chat folds away. -->
    <button
      v-show="!open"
      type="button"
      :aria-expanded="open"
      aria-label="Open the assistant"
      class="fixed right-4 bottom-4 z-[60] grid size-12 place-items-center rounded-full bg-brand text-brand-foreground shadow-modal transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      @click="toggle"
    >
      <svg
        viewBox="0 0 24 24"
        class="size-5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-4-.8L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"
        />
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
/* The morph: a circle the size of the button, at the button, opening into the
   whole panel. Both layouts reach the bottom-right corner, so one centre
   serves them both. `clip-path` only applies while the transition runs, so the
   chat's own popovers are never clipped by it. */
.morph-enter-active,
.morph-leave-active {
  transition:
    clip-path 260ms ease-out,
    opacity 200ms ease-out;
}

.morph-enter-from,
.morph-leave-to {
  clip-path: circle(1.5rem at calc(100% - 2.5rem) calc(100% - 2.5rem));
  opacity: 0;
}

.morph-enter-to,
.morph-leave-from {
  clip-path: circle(150% at calc(100% - 2.5rem) calc(100% - 2.5rem));
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .morph-enter-active,
  .morph-leave-active {
    transition: opacity 100ms linear;
  }

  .morph-enter-from,
  .morph-leave-to {
    clip-path: none;
  }
}
</style>
