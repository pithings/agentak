import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { tokenize } from "rangi/core";
// Every grammar, aliases included — this runs at build time, so nothing ships.
import { languages } from "rangi/languages";
import { defineConfig, type Plugin } from "vite";

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escape = (text: string) => text.replaceAll(/[&<>]/g, (char) => ENTITIES[char]!);

/**
 * A fence, coloured by rangi the way `code-block.tsx` colours one: a span per
 * token, carrying the `--shj-*` the theme repoints. The return replaces the
 * whole block, so the `<pre><code>` wrapper is ours to write — without it the
 * code renders as running text. Undefined for a fence with no language, which
 * keeps md4x's own block and escaping.
 */
function highlight(code: string, { lang }: { lang: string }) {
  if (!lang) return;
  let html = "";
  for (const { text, type } of tokenize(code, { lang, languages })) {
    html += type
      ? `<span style="color:var(--shj-${type})${type === "cmnt" ? ";font-style:italic" : ""}">${escape(text)}</span>`
      : escape(text);
  }
  return `<pre><code class="language-${escape(lang)}">${html}</code></pre>`;
}

/**
 * `import html from "…/readme.md"` — md4x renders the file here, at build time,
 * so the page ships the HTML alone and no parser.
 */
function markdown(): Plugin {
  let md: Promise<typeof import("md4x/standalone")> | undefined;
  return {
    name: "playground:markdown",
    async transform(code, id) {
      if (!id.endsWith(".md")) return;
      md ??= import("md4x/standalone").then(async (mod) => (await mod.init(), mod));
      const html = (await md).renderToHtml(code, { highlighter: highlight });
      return { code: `export default ${JSON.stringify(html)};`, map: null };
    },
  };
}

/**
 * Playground dev server + static demo build.
 *
 * The page is a vue SPA in tailwind; the library it hosts is preact with inline
 * styles. Both plugins run — vue owns `.vue`, preact owns `.tsx` — so the
 * catalog previews and the chat widget mount as preact islands inside vue.
 *
 * `@` points at the library source, not at `dist` — the page is where the
 * library is worked on, so every change reloads.
 *
 * `public/assets` links to the repo's `assets/`, so the readme's relative
 * `assets/…` images resolve here the way they do on GitHub.
 */
export default defineConfig({
  plugins: [
    // `<agent-chat>` is the library's custom element, not a vue component.
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "agent-chat" } } }),
    preact({ reactAliasesEnabled: false }),
    tailwindcss(),
    markdown(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  server: {
    port: 4050,
  },
  // The demo is not shipped — it builds inside its own package, so the root
  // `dist/` stays the published library alone.
  build: {
    emptyOutDir: true,
  },
});
