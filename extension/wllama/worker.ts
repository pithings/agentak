// Docs: @docs/7.extension.md
// Docs: @docs/4.agents/2.pi/3.on-device-models.md
/**
 * The worker wllama asked for, started from a file instead of a `blob:` url.
 *
 * `build.ts` rewrites the package's `createWorker()` to call this, so every
 * worker wllama starts comes through here. There are two: the one that runs
 * llama.cpp, and the one that writes the weights into OPFS. Both were written
 * beside the bundle by the same build, so what arrives here is the code the
 * panel already ships and this only has to say which file it is.
 *
 * The llama worker is the one that carries something this build could not know:
 * `RUN_OPTIONS`, which wllama writes into the first line of the code — where
 * the wasm is, and how many threads to run. The file reads it off its own url,
 * so it goes on as a query.
 */
/** Where the build wrote the two workers and the wasm, under the bundle. */
export const ASSETS = "wllama";

/** `const RUN_OPTIONS = {...};` — the line wllama writes for the llama worker. */
const OPTIONS = /^const RUN_OPTIONS = (\{.*\});/;

const asset = (name: string): URL => new URL(chrome.runtime.getURL(`${ASSETS}/${name}`));

/** Called by the rewritten `createWorker()`. Not called by anything else. */
export function __agentakWorker(code: string | Blob): Worker {
  if (typeof code !== "string") {
    throw new Error("wllama: a worker built from a blob cannot run in an extension page");
  }

  const match = code.match(OPTIONS);
  if (!match) return new Worker(asset("opfs.worker.js"), { type: "module" });

  const options = JSON.parse(match[1]!) as { nbThread?: number; compat?: boolean };
  // Compat mode swaps the glue for another build, which the file beside the
  // bundle is not. Chrome never asks for it, and nothing here turns it on.
  if (options.compat) {
    throw new Error("wllama: compat mode is not the build this extension ships");
  }
  // 0 is wllama's own word for a single thread. Threads mean pthreads, and
  // emscripten starts one of those from a blob too — so the panel would be back
  // where it started. It cannot happen while the manifest declares no
  // cross-origin isolation, because wllama asks for SharedArrayBuffer first.
  if (options.nbThread) {
    throw new Error(`wllama: ${options.nbThread} threads cannot run in an extension page`);
  }

  const url = asset("llama.worker.js");
  url.searchParams.set("run", match[1]!);
  return new Worker(url, { type: "module" });
}
