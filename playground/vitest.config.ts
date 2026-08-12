import { fileURLToPath } from "node:url";
// Aliases are off, as everywhere else: a stray `react` import must fail loudly
// instead of silently resolving to preact/compat.
import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

/** The tests that render from the demo fixtures: the catalog, and the chat. */
export default defineConfig({
  plugins: [preact({ reactAliasesEnabled: false })],
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
