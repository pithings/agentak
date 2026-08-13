#!/usr/bin/env node
/**
 * Bundle size report for the chat widget.
 *
 * Bundles `src/element.tsx` — the whole widget — with every dependency inlined,
 * preact and md4x and pi included, then prints minified and gzipped sizes. The
 * library build keeps its dependencies external, so this is the only place the
 * shipped weight of the widget is visible.
 *
 * Two numbers matter, and the report keeps them apart: the initial chunk, which
 * a page pays for on load, and the chunks behind an `import()` — the markdown
 * parser, the provider model lists — which it pays for only on use.
 *
 * Run: `pnpm size`, or `node scripts/bundle.ts [entry]`.
 */
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { rolldown, type OutputChunk } from "rolldown";

const root = fileURLToPath(new URL("..", import.meta.url));
const entry = process.argv[2] ?? "src/element.tsx";

// --- colors -----------------------------------------------------------------

const on = !process.env.NO_COLOR && (!!process.env.FORCE_COLOR || process.stdout.isTTY);
const paint = (code: string) => (s: string) => (on ? `[${code}m${s}[0m` : s);
const c = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  blue: paint("34"),
  magenta: paint("35"),
  cyan: paint("36"),
};

/** Green under 50 kB gzipped, yellow under 150, red above. */
function heat(gz: number, text: string) {
  if (gz < 50_000) return c.green(text);
  return gz < 150_000 ? c.yellow(text) : c.red(text);
}

// --- sizes ------------------------------------------------------------------

const kB = (n: number) => `${(n / 1000).toFixed(1)} kB`;
const size = (s: string) => Buffer.byteLength(s);
const gzip = (s: string) => gzipSync(s, { level: 9 }).byteLength;

/** The package a module belongs to — `.pnpm` paths keep the last segment. */
function owner(id: string) {
  const at = id.lastIndexOf("node_modules/");
  if (at === -1) return "(src)";
  const rest = id.slice(at + "node_modules/".length).split("/");
  return rest[0].startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0];
}

// --- bundle -----------------------------------------------------------------

const build = await rolldown({
  input: { widget: entry },
  cwd: root,
  platform: "browser",
  // Nothing is external: the report is about the total a page downloads.
  external: [/^node:/],
});
const { output } = await build.generate({
  format: "es",
  minify: true,
  entryFileNames: "[name].mjs",
  chunkFileNames: "[name].mjs",
});
await build.close();

const chunks = output.filter((o): o is OutputChunk => o.type === "chunk");
const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));

// Initial = every chunk reachable from an entry through static imports alone.
// Whatever is left sits behind an `import()`.
const initial = new Set<OutputChunk>();
const queue = chunks.filter((chunk) => chunk.isEntry);
for (const chunk of queue) {
  if (initial.has(chunk)) continue;
  initial.add(chunk);
  for (const file of chunk.imports) {
    const next = byFile.get(file);
    if (next) queue.push(next);
  }
}
const lazy = chunks.filter((chunk) => !initial.has(chunk));

// --- report -----------------------------------------------------------------

const NAME = 38;
const COL = 11;

// Pad first, paint after — an escape code counts as width to `padEnd`.
const left = (text: string, tint: (s: string) => string) => tint(text.padEnd(NAME));
const right = (text: string, tint: (s: string) => string) => tint(text.padStart(COL));

const row = (name: string, tint: (s: string) => string, min: number, gz: number) =>
  `  ${left(name, tint)}${right(kB(min), c.bold)}${right(kB(gz), (s) => heat(gz, s))}${c.dim(" gz")}`;

function section(title: string, group: OutputChunk[]) {
  if (group.length === 0) return;
  const sorted = [...group].sort((a, b) => size(b.code) - size(a.code));
  const min = sorted.reduce((sum, chunk) => sum + size(chunk.code), 0);
  const gz = sorted.reduce((sum, chunk) => sum + gzip(chunk.code), 0);

  console.log(
    `\n${c.bold(title)} ${c.dim(`${sorted.length} chunk${sorted.length === 1 ? "" : "s"}`)}`,
  );
  for (const chunk of sorted) {
    console.log(row(chunk.fileName, c.cyan, size(chunk.code), gzip(chunk.code)));
  }
  if (sorted.length > 1) {
    console.log(`  ${c.dim("─".repeat(NAME + COL * 2))}`);
    console.log(row("subtotal", c.bold, min, gz));
  }
}

/**
 * Who fills the bundle. `renderedLength` is the module as it entered the chunk,
 * before the minifier ran over the whole file, so these bytes are larger than
 * the chunk sizes above — read them as shares, not as download weight.
 */
function packages() {
  const rows = new Map<string, { initial: number; lazy: number }>();
  for (const chunk of chunks) {
    const where = initial.has(chunk) ? "initial" : "lazy";
    for (const [id, mod] of Object.entries(chunk.modules)) {
      const key = owner(id);
      const cur = rows.get(key) ?? { initial: 0, lazy: 0 };
      cur[where] += mod.renderedLength;
      rows.set(key, cur);
    }
  }
  const sorted = [...rows].sort((a, b) => b[1].initial + b[1].lazy - (a[1].initial + a[1].lazy));
  const totals = { initial: 0, lazy: 0 };
  for (const [, part] of sorted) {
    totals.initial += part.initial;
    totals.lazy += part.lazy;
  }

  const cell = (bytes: number, total: number, tint: (s: string) => string) =>
    bytes === 0
      ? right("·", c.dim) + right("", c.dim)
      : right(kB(bytes), tint) + right(`${Math.round((bytes / total) * 100)}%`, c.dim);

  console.log(`\n${c.bold("packages")} ${c.dim("share of each side, before minify")}`);
  console.log(
    `  ${left("", c.dim)}${right("initial", c.dim)}${right("", c.dim)}${right("lazy", c.dim)}`,
  );
  for (const [name, part] of sorted) {
    const tint = name === "(src)" ? c.magenta : c.blue;
    const line = `  ${left(name, tint)}${cell(part.initial, totals.initial, c.bold)}${cell(
      part.lazy,
      totals.lazy,
      c.dim,
    )}`;
    console.log(line.trimEnd());
  }
}

const allMin = chunks.reduce((sum, chunk) => sum + size(chunk.code), 0);
const allGz = chunks.reduce((sum, chunk) => sum + gzip(chunk.code), 0);

console.log(`${c.bold("agentak")} ${c.dim(`${entry} · rolldown, minified, deps inlined`)}`);
section("initial", [...initial]);
section("lazy", lazy);
packages();
console.log(`\n${row("total", c.bold, allMin, allGz)}\n`);
