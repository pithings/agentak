import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

/** Library build: the importable API plus the self-registering custom element. */
export default defineConfig({
  plugins: [preact({ reactAliasesEnabled: false })],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: "dist/lib",
    emptyOutDir: true,
    lib: {
      entry: {
        "web-agent": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
        element: fileURLToPath(new URL("./src/element.tsx", import.meta.url)),
        components: fileURLToPath(new URL("./src/components/index.ts", import.meta.url)),
        pi: fileURLToPath(new URL("./src/agent/index.ts", import.meta.url)),
      },
      formats: ["es"],
    },
  },
});
