import { fileURLToPath } from "node:url";
// Aliases are off, as everywhere else: a stray `react` import must fail loudly
// instead of silently resolving to preact/compat.
import preact from "@preact/preset-vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

/** The page and the fixtures: the vue shell, the catalog, and the chat. */
export default defineConfig({
  plugins: [
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "web-agent" } } }),
    preact({ reactAliasesEnabled: false }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  test: {
    name: "playground",
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    css: false,
  },
});
