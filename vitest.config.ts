import { fileURLToPath } from "node:url";
// Aliases are off: the source is native preact, so a stray `react` import
// must fail loudly instead of silently resolving to preact/compat.
import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [preact({ reactAliasesEnabled: false })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    css: false,
    coverage: {
      include: ["src/components/**", "src/lib/**"],
    },
  },
});
