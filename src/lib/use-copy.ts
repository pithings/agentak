import { useCallback, useEffect, useRef, useState } from "preact/hooks";

export interface Copy {
  /** The last copy went through, and is still being reported. */
  copied: boolean;
  /** Put `text` on the clipboard. Answers whether it went. */
  copy: (text: string) => Promise<boolean>;
}

/**
 * Copy to the clipboard, with the short "copied" state that follows it.
 *
 * The flag clears itself after `timeout`, so a button only swaps its icon and
 * nothing else has to reset it. The clipboard is missing on an insecure origin
 * and refuses without a gesture, so a failed copy answers `false` rather than
 * throwing at the caller.
 */
export function useCopy(timeout = 2000): Copy {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;

      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), timeout);
        return true;
      } catch {
        return false;
      }
    },
    [timeout],
  );

  return { copied, copy };
}
