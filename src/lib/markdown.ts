import type { ComarkNode } from "md4x/standalone";
import { useEffect, useState } from "preact/hooks";

let parse: typeof import("md4x/standalone").parseAST | undefined;
let loading: Promise<boolean> | undefined;

/**
 * Load and instantiate md4x once. The import is dynamic because the standalone
 * build carries the wasm inline, so a static one would put ~130 kB of base64 in
 * the entry chunk. Resolves false on failure — callers then fall back to plain
 * text rather than losing the message.
 */
export function loadMarkdown(): Promise<boolean> {
  loading ??= import("md4x/standalone")
    .then(async (md) => {
      await md.init();
      parse = md.parseAST;
      return true;
    })
    .catch(() => false);
  return loading;
}

/** Parse to an AST. Undefined until the parser is ready. */
export function parseMarkdown(text: string): ComarkNode[] | undefined {
  // `heal` closes the delimiters a stream leaves open mid-token.
  return parse?.(text, { heal: true }).nodes;
}

/** True once `parseMarkdown` returns nodes. */
export function useMarkdown(): boolean {
  const [isReady, setIsReady] = useState(parse !== undefined);

  useEffect(() => {
    if (isReady) return;
    let active = true;
    loadMarkdown().then((ok) => {
      if (active && ok) setIsReady(true);
    });
    return () => {
      active = false;
    };
  }, [isReady]);

  return isReady;
}
