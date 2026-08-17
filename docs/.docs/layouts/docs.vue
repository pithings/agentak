<script setup lang="ts">
import DocsLayout from "undocs/src/app/layouts/docs.vue";
import ChatWidget from "../components/ChatWidget.vue";

/**
 * The documentation layout, with the chat button added.
 *
 * A user layout replaces the built-in one of the same name, so this wraps the
 * built-in layout instead of copying it. The landing has no docs layout, so
 * `.docs/pages/index.vue` adds the same widget there.
 */
</script>

<template>
  <DocsLayout>
    <slot />
  </DocsLayout>
  <ChatWidget />
</template>
