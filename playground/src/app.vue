<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute } from "vue-router";

import AppSidebar from "./components/app-sidebar.vue";
import AppTopbar from "./components/app-topbar.vue";
import ChatWidget from "./components/chat-widget.vue";

const route = useRoute();
const navOpen = ref(false);

// The narrow layout puts the sidebar over the page; a link closes it again.
watch(
  () => route.fullPath,
  () => (navOpen.value = false),
);
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppTopbar @toggle-nav="navOpen = !navOpen" />

    <div class="mx-auto flex w-full max-w-[110rem] flex-1 items-start">
      <AppSidebar :open="navOpen" />
      <main class="min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6">
        <RouterView />
      </main>
    </div>

    <ChatWidget />
  </div>
</template>
