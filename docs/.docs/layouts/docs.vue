<script setup lang="ts">
import DocsLayout from "undocs/src/app/layouts/docs.vue";
import ChatWidget from "../components/ChatWidget.vue";

/**
 * The documentation layout, with the chat button added.
 *
 * A user layout replaces the built-in one of the same name, so this wraps the
 * built-in layout instead of copying it: the page renders as before, and the
 * widget is a sibling of it. Every page of this site uses the `docs` layout,
 * so the button is on all of them.
 */
</script>

<template>
  <DocsLayout>
    <slot />
  </DocsLayout>
  <ChatWidget />
</template>
