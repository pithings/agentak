import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig, type Plugin } from "vite";

import { wllamaAssets, wllamaWorkers } from "./wllama/build.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

// The panel is not shipped in the package — it builds inside its own package,
// so the root `dist/` stays the published library alone.
const outDir = fileURLToPath(new URL("./dist", import.meta.url));

/**
 * WIP MV3 build. `@` points at the library source, as in the playground — the
 * panel hosts the surface itself, and is not a consumer of `dist`.
 */
export default defineConfig({
  plugins: [
    preact({ reactAliasesEnabled: false }),
    copyStatic(),
    wllamaWorkers(),
    wllamaAssets(outDir),
  ],
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

/**
 * The manifest and the icons are read by chrome, not imported by anything, so
 * vite never sees them. Copy them beside the bundle.
 */
function copyStatic(): Plugin {
  return {
    name: "copy-static",
    closeBundle() {
      cpSync(`${root}manifest.json`, `${outDir}/manifest.json`);
      cpSync(`${root}icons`, `${outDir}/icons`, { recursive: true });
    },
  };
}
