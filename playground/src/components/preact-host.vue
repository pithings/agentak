<script setup lang="ts">
import { type ComponentChildren, render } from "preact";
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";

/**
 * A preact island inside vue.
 *
 * The page is vue; every component in this library is preact. The bridge is one
 * div that vue owns and preact fills — vue renders it empty and never patches
 * its children, so the two never fight over the same nodes.
 */
const props = defineProps<{ preview: () => ComponentChildren }>();

const host = useTemplateRef<HTMLDivElement>("host");

function mount() {
  if (host.value) render(props.preview(), host.value);
}

onMounted(mount);
// A new factory is a new island: the route swapped the entry under it.
watch(() => props.preview, mount);
onBeforeUnmount(() => {
  if (host.value) render(null, host.value);
});
</script>

<template>
  <div ref="host" />
</template>
