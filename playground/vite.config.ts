import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/**
 * Playground dev server + static demo build.
 *
 * The page is a vue SPA in tailwind; the library it hosts is preact with inline
 * styles. Both plugins run — vue owns `.vue`, preact owns `.tsx` — so the
 * catalog previews and the chat widget mount as preact islands inside vue.
 *
 * `@` points at the library source, not at `dist` — the page is where the
 * library is worked on, so every change reloads.
 */
export default defineConfig({
  plugins: [
    // `<agent-chat>` is the library's custom element, not a vue component.
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "agent-chat" } } }),
    preact({ reactAliasesEnabled: false }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  server: {
    port: 4050,
  },
  // The demo is not shipped — it builds inside its own package, so the root
  // `dist/` stays the published library alone.
  build: {
    emptyOutDir: true,
  },
});
