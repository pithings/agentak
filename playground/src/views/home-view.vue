<script setup lang="ts">
// The repo readme, rendered to HTML by md4x in `vite.config.ts` — a static
// string in the bundle, so the page parses nothing.
import readme from "../../../README.md";
</script>

<template>
  <div class="flex flex-col gap-6">
    <article class="readme max-w-3xl" v-html="readme" />

    <nav class="max-w-3xl border-t border-line pt-4 text-xs">
      <RouterLink to="/components" class="rounded-md border border-line px-3 py-2 hover:bg-fill">
        Browse the components →
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
/* Tailwind preflight strips the element styles, and the readme is raw HTML with
   no classes to hook — so the page paints it here, from the same tokens. */
.readme :deep(*) {
  min-width: 0;
}

.readme :deep(h1),
.readme :deep(h2),
.readme :deep(h3) {
  margin: 2rem 0 0.75rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  scroll-margin-top: 4.5rem;
}
.readme :deep(h1) {
  margin-top: 0;
  font-size: 1.5rem;
}
.readme :deep(h2) {
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.375rem;
  font-size: 1.125rem;
}
.readme :deep(h3) {
  font-size: 0.9375rem;
}

.readme :deep(p),
.readme :deep(ul),
.readme :deep(ol) {
  margin: 0.75rem 0;
  font-size: 0.875rem;
  line-height: 1.7;
}
.readme :deep(ul),
.readme :deep(ol) {
  padding-left: 1.25rem;
}
.readme :deep(ul) {
  list-style: disc;
}
.readme :deep(ol) {
  list-style: decimal;
}
.readme :deep(li) {
  margin: 0.25rem 0;
}

/* The masthead. `align` is the one centring attribute GitHub keeps, so the page
   honours it as well. */
.readme :deep([align="center"]) {
  text-align: center;
}
.readme :deep(img) {
  display: inline-block;
  max-width: 100%;
}

.readme :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.readme :deep(code) {
  border-radius: var(--radius-sm);
  background: var(--muted-surface);
  padding: 0.1em 0.35em;
  font-family: var(--font-mono);
  font-size: 0.8125em;
}
.readme :deep(pre) {
  overflow-x: auto;
  margin: 1rem 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--muted-surface);
  padding: 0.875rem 1rem;
  line-height: 1.6;
}
.readme :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 0.8125rem;
}

.readme :deep(table) {
  display: block;
  overflow-x: auto;
  margin: 1rem 0;
  border-collapse: collapse;
  font-size: 0.8125rem;
}
.readme :deep(th),
.readme :deep(td) {
  border: 1px solid var(--border);
  padding: 0.375rem 0.625rem;
  text-align: left;
  vertical-align: top;
}
.readme :deep(th) {
  background: var(--muted-surface);
  font-weight: 600;
}

.readme :deep(blockquote) {
  margin: 1rem 0;
  border-left: 2px solid var(--border);
  padding-left: 0.875rem;
  color: var(--muted-foreground);
}
.readme :deep(hr) {
  margin: 2rem 0;
  border: 0;
  border-top: 1px solid var(--border);
}
</style>
