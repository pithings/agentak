import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig, type Plugin } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

// The panel is not shipped in the package — it builds inside its own package,
// so the root `dist/` stays the published library alone.
const outDir = fileURLToPath(new URL("./dist", import.meta.url));

/**
 * WIP MV3 build. `@` points at the library source, as in the playground — the
 * panel is where the element is hosted, not a consumer of `dist`.
 */
export default defineConfig({
  plugins: [preact({ reactAliasesEnabled: false }), copyManifest()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: `${root}sidepanel.html`,
        background: `${root}background.ts`,
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});

/** The manifest is not an import, so vite never sees it. Copy it beside the bundle. */
function copyManifest(): Plugin {
  return {
    name: "copy-manifest",
    closeBundle() {
      copyFileSync(`${root}manifest.json`, `${outDir}/manifest.json`);
    },
  };
}
