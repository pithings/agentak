<script setup lang="ts">
/**
 * The download button for the packed extension.
 *
 * The zip is a static file in `public/`, written by `scripts/pack.ts` when the
 * extension is built — which the docs build runs first. So this is a plain
 * `<a download>` and not the site's `Button`: `Button` links through `AppLink`,
 * which takes a path that starts with a slash for a route of the site and would
 * push it to the router instead of leaving it to the browser. Only the classes
 * are borrowed, so the button is the site's own.
 *
 * It carries the accent fill and not the monochrome `primary` one, because it
 * is the one thing the page asks for. `primary` is the near-black slab in light
 * and the near-white one in dark, and a white slab is what a docs page uses for
 * its chrome, not for its single action.
 *
 * The two `!` classes are the same guard `Card.vue` uses upstream. The site's
 * prose rule is `.md a`, a class and a tag, so it outweighs the single class of
 * a utility and paints the label with the link colour and an underline. Marking
 * the two declarations it sets is what takes them back — `not-prose` is a
 * Tailwind Typography word and this site does not read it.
 *
 * `puzzle` is one of the icons undocs bundles, so it draws with no request. An
 * icon outside that list falls back to the Iconify HTTP API.
 */
import { onMounted, ref } from "vue";
import Icon from "undocs/src/app/components/global/Icon.vue";
import { buttonVariants } from "undocs/src/app/components/ui/Button.ts";

const linkClass = [
  buttonVariants({ color: "brand", size: "lg" }),
  "text-brand-foreground! no-underline!",
].join(" ");

/**
 * Every build writes a new zip under the same name, so a browser or a cdn that
 * kept the last one would hand it back. The url carries the moment the page was
 * loaded, which no earlier download was under.
 *
 * It is written after mount, not in setup: the page is prerendered, and a moment
 * baked into that html is the moment the site was built. The first client render
 * matches what the server wrote, and the query lands before a click can.
 */
const zip = "/agentak-extension.zip";
const href = ref(zip);

onMounted(() => {
  href.value = `${zip}?t=${Date.now()}`;
});
</script>

<template>
  <div class="not-prose my-6 flex flex-wrap items-center gap-x-4 gap-y-2">
    <a :class="linkClass" :href="href" download="agentak-extension.zip">
      <Icon name="i-lucide-puzzle" />
      Download for Chrome
    </a>
  </div>
</template>
