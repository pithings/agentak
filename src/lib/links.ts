// Docs: @docs/3.widget.md
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

/** What a click on a resolved url should do. */
export type LinkKind = "away" | "here" | "hash";

/**
 * Which of the three `url` is, read against the document the chat is in.
 *
 * `away` is another site, and opens a tab. `here` is this one: a link the model
 * wrote about the page it is on, so the click is answered in place rather than
 * in a second copy of the site the reader is already looking at. `hash` is a
 * fragment of the page already open, which the browser scrolls to itself.
 *
 * The test is the origin and not the shape of the href, because that is what
 * says where a click lands: `/config` under the panel's `linkBase` is another
 * site by the time it is read here, and the full url of this one is not.
 */
export function linkKind(url: string): LinkKind {
  if (typeof location === "undefined") return "away";
  let target: URL;
  try {
    target = new URL(url, location.href);
  } catch {
    return "away";
  }
  if (target.origin !== location.origin) return "away";
  return target.pathname === location.pathname && target.search === location.search
    ? "hash"
    : "here";
}

/**
 * A place in this document, through the history api rather than a load: the
 * entry is pushed and a `popstate` is raised behind it, which is the event a
 * client-side router listens on. So a chat on a documentation site answers a
 * link the way that site's own links answer — the page changes and the chat
 * beside it keeps its conversation, which a reload would have taken.
 *
 * The state pushed is `null` on purpose. A router keeps its own bookkeeping in
 * there, and handing it back the state of the entry being left would read as a
 * step through the history rather than a step into a new one; every router this
 * was written for repairs a null state on the way past.
 */
export function pushUrl(url: string): void {
  history.pushState(null, "", url);
  dispatchEvent(new PopStateEvent("popstate", { state: null }));
}
