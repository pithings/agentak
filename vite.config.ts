import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

/** Playground dev server + static demo build. */
export default defineConfig({
  plugins: [preact({ reactAliasesEnabled: false })],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 4050,
  },
  build: {
    outDir: "dist/playground",
    emptyOutDir: true,
  },
});
