import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig, type Plugin } from "vite";

const root = fileURLToPath(new URL("./extension", import.meta.url));

const outDir = fileURLToPath(new URL("./dist/extension", import.meta.url));

export default defineConfig({
  root,
  plugins: [preact({ reactAliasesEnabled: false }), copyManifest()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: `${root}/sidepanel.html`,
        background: `${root}/background.ts`,
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});

/** WIP MV3 build. `pnpm build:extension`, then load dist/extension unpacked. */
function copyManifest(): Plugin {
  return {
    name: "copy-manifest",
    closeBundle() {
      copyFileSync(`${root}/manifest.json`, `${outDir}/manifest.json`);
    },
  };
}
