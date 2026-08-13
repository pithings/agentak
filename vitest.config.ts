import { fileURLToPath } from "node:url";
// Aliases are off: the source is native preact, so a stray `react` import
// must not silently resolve to preact/compat. React itself is installed — it is
// an optional peer of `agentak/react` — and `test/eject.test.ts` is what holds
// the name to that one file.
import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

/** The library's own tests. The playground has none — a human checks the page. */
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
