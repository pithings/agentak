import { fileURLToPath } from "node:url";
// Aliases are off: the source is native preact, so a stray `react` import
// must fail loudly instead of silently resolving to preact/compat.
import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

/** The library's own tests, plus the playground package's, in one run. */
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [preact({ reactAliasesEnabled: false })],
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        test: {
          name: "lib",
          environment: "jsdom",
          include: ["test/**/*.test.{ts,tsx}"],
          css: false,
        },
      },
      "./playground/vitest.config.ts",
    ],
    coverage: {
      include: ["src/components/**", "src/lib/**"],
    },
  },
});
