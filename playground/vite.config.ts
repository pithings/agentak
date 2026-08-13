import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

/**
 * Playground dev server + static demo build.
 *
 * `@` points at the library source, not at `dist` — the page is where the
 * library is worked on, so every change reloads.
 */
export default defineConfig({
  plugins: [preact({ reactAliasesEnabled: false })],
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
