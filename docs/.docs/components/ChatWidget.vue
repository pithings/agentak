<script setup lang="ts">
import { ref } from "vue";
import { minimiseAction } from "../chat-widget/minimise-action.ts";
import { useChatAgent } from "../chat-widget/use-chat-agent.ts";
import { useChatShell } from "../chat-widget/use-chat-shell.ts";

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
 * The site is in the prompt as well as in the tools: `docs-prompt.ts` names the
 * project and tells the assistant how to search and read its documentation.
 *
 * `.docs/layouts/docs.vue` renders it beside the page, so the button is on
 * every documentation page.
 *
 * The parts are in `.docs/chat-widget/`: the session and its lazy imports, the
 * state the reader drives, the minimise button, the prompt and the stylesheet.
 * That folder is beside `components/` rather than inside it because Nuxt scans
 * `components/` for `.ts` as well, and would take each file there for a
 * component.
 *
 * ## Two layouts, one surface
 *
 * The chat is never a box over the page. It is mounted once and only ever
 * restyled, so the transcript survives a resize:
 *
 * - **`lg` and up — a docked rail** on the right, full height, slid in from the
 *   edge by the button. It is chrome of the site rather than a dialog: the page
 *   gives up the room while it is open, so the rail covers nothing.
 * - **Below `lg` — a sheet** over the whole screen, opened by the button. A
 *   small screen has no room beside the page, so the chat takes all of it and
 *   the page holds still underneath. It grows out of the button: the morph is a
 *   `clip-path` circle centred on it.
 *
 * Either way the button is the way in, and the way back once the chat is
 * minimised. Neither layout opens by itself.
 *
 * Both layouts are the stylesheet's own defaults, and the classes here only say
 * what the reader changed. `chat-widget/chat-widget.css` holds the rules and the
 * reason they are written that way.
 */
const panel = ref<HTMLElement>();
const button = ref<HTMLButtonElement>();

const { load, Panel, session, ui } = useChatAgent();
const shell = useChatShell({ button, load, panel });
const { open, state, toggle } = shell;
const actions = minimiseAction(ui, shell);
</script>

<template>
  <!-- Rendered by the server, empty and folded away: the panel is on the page
       before the chat is, so nothing moves when the chat arrives. -->
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

<style src="../chat-widget/chat-widget.css"></style>
