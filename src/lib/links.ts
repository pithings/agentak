/**
 * What a relative link is relative to.
 *
 * A page answers this by itself: `/config` in an answer rendered on
 * `example.com` opens `example.com/config`, because the browser resolves an
 * `href` against the document that holds it. A surface that is not the document
 * it talks about has no such answer — the side panel is `chrome-extension:`, so
 * the same link would send the reader to a file the extension does not have.
 *
 * So the host says what the base is, through `linkBase` on `Chat` and
 * `AgentChat`, and the markdown renderer reads it here. No base is the page's
 * own case, where the href goes to the dom as the model wrote it.
 */
import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const LinkBase = createContext<string | undefined>(undefined);

/** The base a relative link resolves against, or undefined for the document's. */
export const useLinkBase = (): string | undefined => useContext(LinkBase);

/** A scheme, and so an url that is already absolute — `mailto:` included. */
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/**
 * `url` against `base`, where it needs one. An url that names its own scheme
 * comes back untouched, the unsafe ones included — a caller still checks what
 * this returns. A base that is not an url resolves nothing.
 */
export function resolveUrl(url: string, base?: string): string {
  if (!base || !url || HAS_SCHEME.test(url)) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}
