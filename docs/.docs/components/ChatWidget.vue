<script setup lang="ts">
import {
  type Component,
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watchEffect,
} from "vue";
import type { PiSession } from "../../../src/pi/index.ts";

/**
 * The chat button of the documentation site, and the chat it opens.
 *
 * The chat is the real thing, not a screenshot: `ChatPanel` from `agentak/vue`
 * over a Pi session this component makes and ends itself. The first message of
 * a first visit opens the picker, where the free providers need no API key; the
 * choice is kept in `localStorage`, so a reader is asked once. The conversations
 * go to the same store, so the chat carries its own history page and a reader
 * comes back to the last one on the next page of the site.
 *
 * `.docs/layouts/docs.vue` renders it beside the page, so the button is on
 * every documentation page.
 *
 * ## Two layouts, one surface
 *
 * The chat is never a box over the page. It is mounted once and only ever
 * restyled, so the transcript survives a resize:
 *
 * - **`lg` and up — a docked rail** on the right, full height, open with the
 *   page. It is chrome of the site rather than a dialog: the page gives up the
 *   room, so the rail covers nothing.
 * - **Below `lg` — a sheet** over the whole screen, opened by the button. A
 *   small screen has no room beside the page, so the chat takes all of it and
 *   the page holds still underneath. It grows out of the button: the morph is a
 *   `clip-path` circle centred on it.
 *
 * Either way the button is the way back once the chat is minimised.
 *
 * ## The stylesheet holds both defaults
 *
 * The panel, the room it takes and the button are placed by CSS alone, with no
 * class from this component: the rail is docked and the page is padded above
 * `lg`, the sheet is folded away below it. That is what the server renders and
 * what the browser paints first, so the page is served at the width it keeps —
 * the rail lands in room that was always there, and nothing shifts when the
 * script arrives.
 *
 * `html:has(.chat-panel …)` is what pads the page. The rule reaches the root
 * element, but only while this component is on the page, so a layout without
 * the chat keeps its full width.
 *
 * Script only says what the READER changed: `is-open` and `is-closed` are added
 * once this is mounted, and each one moves the panel away from the default its
 * layout carries.
 */
const open = ref(false);
const wide = ref(false);
const mounted = ref(false);

const panel = ref<HTMLElement>();
const button = ref<HTMLButtonElement>();

const Panel = shallowRef<Component>();
const session = shallowRef<PiSession>();
const ui = shallowRef<{ Button: unknown; h: typeof import("preact").h }>();

/**
 * What the reader has done with the chat, and nothing before that: the
 * stylesheet owns the state the page is served in, so no class of ours may
 * describe it. Hydration therefore changes no attribute the first paint set.
 */
const state = computed(() => (mounted.value ? (open.value ? "is-open" : "is-closed") : undefined));

/**
 * The chat loads with the rail, and not before.
 *
 * The docs are server rendered and the chat is a browser widget, so every
 * import here is dynamic — the server loads none of them. A small screen loads
 * nothing at all until the button is taken. Once mounted the panel is only
 * folded away, so minimising it keeps the transcript.
 */
async function load() {
  if (session.value) return;
  const [{ ChatPanel }, { browserStorage, createPiSession }, { Button }, preact] =
    await Promise.all([
      import("../../../src/vue/index.ts"),
      import("../../../src/pi/index.ts"),
      import("../../../src/components/index.ts"),
      import("preact"),
    ]);
  ui.value = { Button, h: preact.h };
  // `localStorage`, so the provider, model and key a reader picks are still
  // there on the next page of the documentation — and so are the conversations:
  // `history` keeps them in that same store, opens on the last one, and lists
  // the rest on the chat's own history page.
  session.value = createPiSession({ history: true, storage: browserStorage() });
  Panel.value = ChatPanel;
}

/**
 * Focus something a class change is about to reveal.
 *
 * Both states are held by the stylesheet, and a folded-away panel is
 * `visibility: hidden` — which takes no focus at all. So the element is asked
 * one frame after the class lands, when the style it is placed by has been
 * applied.
 */
function focusLater(pick: () => HTMLElement | null | undefined) {
  // `preventScroll` because the page may still be on its way to an anchor: the
  // panel is fixed and already in view, so it needs no scrolling to reach.
  void nextTick(() => requestAnimationFrame(() => pick()?.focus({ preventScroll: true })));
}

/** The composer, by the name the library's own code reads it under. */
const input = () => panel.value?.querySelector<HTMLTextAreaElement>('textarea[name="message"]');

/**
 * The composer takes the focus whenever the chat opens — with the page on a
 * desktop, and on the button everywhere else. It is where a reader starts.
 *
 * A touch screen is the one exception: the focus would raise the virtual
 * keyboard over the transcript that has just opened.
 */
function focusComposer() {
  if (globalThis.matchMedia?.("(pointer: coarse)").matches) return;
  focusLater(input);
}

function close() {
  // The chat is about to become `inert`, so a focus inside it would be dropped
  // on the document. The button it folds into takes it instead — and a reader
  // whose focus is out on the page keeps it where it is.
  const inside = panel.value?.contains(document.activeElement);
  open.value = false;
  if (inside) focusLater(() => button.value);
}

/** Opening the chat is asking to say something, so the composer is ready for it. */
async function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  await load();
  focusComposer();
}

/**
 * The minimise button, on the chat's own header.
 *
 * The surface heads itself, so the site adds no second title bar: `actions`
 * goes at the end of that header, beside the chat's own buttons. It is a preact
 * child, whatever renders the page around it — `Button` is the one the buttons
 * beside it use, so they match.
 *
 * The chevron points at where the chat goes: out to the right edge for the
 * rail, down to the button for the sheet.
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
 * The page holds still under the sheet.
 *
 * The sheet covers the screen, so the document behind it must not scroll: the
 * chat contains its own scroll chain, but a drag on any part of it that does
 * not scroll would otherwise move the page under a panel that hides it. The
 * rail takes room rather than covering the page, so it leaves the scroll alone.
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
  mounted.value = true;
  // The rail is already docked, and the page already carries its room: this
  // only agrees with the stylesheet, and fetches the chat that goes in it. The
  // composer takes the focus once it is there, so the page opens ready to be
  // asked something.
  if (wide.value) {
    open.value = true;
    void load().then(focusComposer);
  }
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
  <!-- Rendered by the server, empty: the room and the panel in it are on the
       page before the chat is, so nothing moves when the chat arrives. -->
  <section ref="panel" :class="['chat-panel', state]" :inert="!open" aria-label="Assistant">
    <component
      :is="Panel"
      v-if="Panel && session"
      :actions="actions"
      :session="session"
      class="chat-surface"
    />

    <!-- The chat before it arrives: the lines it draws, at the sizes it draws
         them, so it takes this one's place without moving anything. -->
    <div v-else class="chat-ghost" aria-hidden="true">
      <div class="chat-ghost-head"></div>
      <div class="chat-ghost-body"></div>
      <div class="chat-ghost-foot"><div></div></div>
    </div>
  </section>

  <!-- The way back to a minimised chat, and the way into it on a small screen.
       It says what it does, so it needs no label of its own. -->
  <button
    ref="button"
    :class="['chat-button', state]"
    :aria-expanded="open"
    type="button"
    @click="toggle"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <!-- `BrainIcon`, the one the chat marks its own thinking with. -->
      <path d="M12 18V5" />
      <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
      <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
      <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
      <path d="M18 18a4 4 0 0 0 2-7.464" />
      <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
      <path d="M6 18a4 4 0 0 1-2-7.464" />
      <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
    </svg>
    Ask AI
  </button>
</template>

<!-- Not scoped: the padding that makes room for the rail belongs to the root
     element, which is nobody's child. -->
<style>
:root {
  --chat-rail: clamp(20rem, 26vw, 28rem);
  --chat-move: 260ms;
  /* The middle of the button, which is where the sheet grows from: the pill is
     `2.5rem` tall at `1rem`, and about `6rem` wide from the same edge. */
  --chat-origin: calc(100% - 4rem) calc(100% - 2.25rem);
}

.chat-panel {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--background);
}

.chat-surface {
  min-height: 0;
  flex: 1 1 auto;
}

/* The placeholder, which is the panel the server can draw: three hairlines at
   the chat's own measurements — the header rule (`2rem` of buttons in
   `0.375rem` of padding), the rule the composer sits above, and the box a
   message is typed into. Nothing else; the transcript between them is what the
   chat has yet to say. */
.chat-ghost {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.chat-ghost-head {
  height: 2.75rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.chat-ghost-body {
  flex: 1 1 auto;
}

.chat-ghost-foot {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  padding: 0.5rem;
}

.chat-ghost-foot > div {
  height: 6rem;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
}

/* A pill that says what it opens, rather than a circle the reader must read an
   icon out of. The brain is the mark the chat gives its own thinking. */
.chat-button {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 60;
  display: inline-flex;
  height: 2.5rem;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.875rem;
  border-radius: 9999px;
  background: var(--brand);
  color: var(--brand-foreground);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1;
  box-shadow: var(--shadow-modal);
  cursor: pointer;
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out,
    visibility 0s;
}

.chat-button:hover {
  opacity: 0.9;
}

.chat-button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.chat-button > svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

/* The sheet, below `lg`: the whole screen, folded into the button until the
   reader takes it. `clip-path` is the morph — a circle the size of the button,
   at the button, opening into the whole panel. */
@media (max-width: 63.999rem) {
  .chat-panel {
    inset: 0;
    visibility: hidden;
    clip-path: circle(1.25rem at var(--chat-origin));
    transition:
      clip-path var(--chat-move) ease-out,
      visibility 0s var(--chat-move);
  }

  .chat-panel.is-open {
    visibility: visible;
    clip-path: circle(150% at var(--chat-origin));
    transition: clip-path var(--chat-move) ease-out;
  }

  .chat-button.is-open {
    visibility: hidden;
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity 150ms ease-in,
      transform 150ms ease-in,
      visibility 0s 150ms;
  }
}

/* The rail, `lg` and up: docked to the right edge and open with the page, so
   the button is away until the reader minimises it. */
@media (min-width: 64rem) {
  /* The room the rail takes, reserved by the stylesheet: the page is SERVED
     narrowed, so the rail needs none of it back on hydration. `:has` is what
     keeps the rule to the pages this component is on. */
  html:has(.chat-panel:not(.is-closed)) {
    padding-right: var(--chat-rail);
  }

  /* The page moves only for the READER: the width is animated once one of the
     state classes is on the panel, and those arrive with the first minimise.
     A page that reaches this rule late — the dev server injects its styles from
     script — therefore lands at its width rather than sliding into it. */
  html:has(.chat-panel.is-open),
  html:has(.chat-panel.is-closed) {
    transition: padding-right var(--chat-move) ease-out;
  }

  .chat-panel {
    inset: 0 0 0 auto;
    width: var(--chat-rail);
    border-left: 1px solid var(--border);
    clip-path: none;
    transition:
      transform var(--chat-move) ease-out,
      visibility 0s;
  }

  .chat-panel.is-closed {
    visibility: hidden;
    transform: translateX(100%);
    transition:
      transform var(--chat-move) ease-out,
      visibility 0s var(--chat-move);
  }

  .chat-button:not(.is-closed) {
    visibility: hidden;
    opacity: 0;
    transform: scale(0.5);
    transition:
      opacity 150ms ease-in,
      transform 150ms ease-in,
      visibility 0s 150ms;
  }
}

/* The button stands where the rail's own header was, so minimising and opening
   again happen at the same corner of the screen. Only on a screen wide enough
   to hold it beside the header: below that the top-right corner is the site's
   navigation, so the button keeps to the bottom, out of its way. */
@media (min-width: 90.625rem) {
  .chat-button {
    top: 1rem;
    bottom: auto;
  }
}

/* Each state is named again, so that the rules above are matched on specificity
   rather than left to win it. */
@media (prefers-reduced-motion: reduce) {
  html,
  html:has(.chat-panel.is-open),
  html:has(.chat-panel.is-closed),
  .chat-panel,
  .chat-panel.is-open,
  .chat-panel.is-closed,
  .chat-button,
  .chat-button.is-open,
  .chat-button:not(.is-closed) {
    transition: none;
  }

  .chat-panel,
  .chat-panel.is-open {
    clip-path: none;
  }
}
</style>
