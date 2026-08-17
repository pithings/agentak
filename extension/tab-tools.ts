/**
 * The tools of the tab in front, for the side panel.
 *
 * Two things are offered, and the panel hands both over as one `PageTools`:
 *
 * 1. `read_page`, the panel's own — see `read-page.ts`. It is listed on every
 *    tab, because it is what makes the agent worth opening on an ordinary site.
 * 2. Whatever the page publishes on `document.modelContext` — WebMCP. Almost no
 *    page publishes any, so this half is usually empty and must never be what
 *    decides whether the model gets tools at all.
 *
 * The panel document is `chrome-extension:` and its own `document.modelContext`
 * is empty, so it reads the tab instead. A `RegisteredTool` carries a live
 * `Window` and crosses no boundary, so both halves of the work run in the page:
 * `getTools()` there, `executeTool()` there, and only names, schemas and JSON
 * strings come back. That is the whole of what `PageTools` asks for.
 *
 * WebMCP is injected in the `MAIN` world, where `document.modelContext` is
 * certainly the one the page registered on. That world has no `chrome.runtime`,
 * so the `toolchange` event is relayed out in two steps: the page posts a
 * message to itself, and a listener in the isolated world forwards it to the
 * panel. The reader needs none of that and runs in the isolated world, which
 * sees the same dom and touches none of the page's own globals.
 *
 * The manifest asks for every http origin, so the tab in front answers whether
 * or not the toolbar button was clicked on it. `activeTab` alone was the other
 * choice, and it costs the panel its point: the side panel outlives the tab it
 * was opened from, so a person who opens it and then browses would find the
 * agent blind to everything but the one tab it started on.
 */
import type { PageTool, PageTools } from "@/pi/page-tools.ts";

import { PAGE_LIMIT, readPageInTab, readPageTool } from "./read-page.ts";

/** What the page posts to itself, and what the panel hears. */
export const RELAY = "agentak:webmcp-toolchange";

/** Either half of an injected call: a page throws where the panel cannot catch. */
type Answered<T> = { ok: true; value: T } | { ok: false; message: string };

/** Runs in the page. Returns the data half of every tool it offers. */
export function readTools(): Promise<Answered<PageTool[]>> {
  const context = (document as { modelContext?: any }).modelContext;
  if (!context) return Promise.resolve({ ok: false, message: "This page has no WebMCP tools." });
  // A browser shipping the api today answers with JSON text for `inputSchema`:
  // the field was a `DOMString` until 2026-08-14. Parsed here, in the page,
  // because `toSchemaObject()` cannot be injected with this function.
  const schema = (value: unknown) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  };

  return context.getTools().then(
    (tools: any[]) => ({
      ok: true as const,
      value: tools.map((tool) => ({
        description: tool.description,
        inputSchema: schema(tool.inputSchema),
        name: tool.name,
        origin: tool.origin,
        readOnly: tool.annotations?.readOnlyHint ?? false,
        title: tool.title,
        untrusted: tool.annotations?.untrustedContentHint ?? false,
      })),
    }),
    (error: unknown) => ({ ok: false as const, message: String(error) }),
  );
}

/** Runs in the page. Finds the live tool again, because only its name travelled. */
function runTool(name: string, origin: string, args: string): Promise<Answered<string>> {
  const context = (document as { modelContext?: any }).modelContext;
  if (!context) return Promise.resolve({ ok: false, message: "This page has no WebMCP tools." });
  return context.getTools().then((tools: any[]) => {
    const found = tools.find((tool) => tool.name === name && tool.origin === origin);
    if (!found) return { ok: false as const, message: `The page no longer offers "${name}".` };
    return context.executeTool(found, args).then(
      (value: string) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, message: String(error) }),
    );
  });
}

/** Runs in the page. Posts every `toolchange` to whoever is listening. */
function relayInPage(relay: string) {
  const marked = window as { __agentakRelay?: boolean };
  const context = (document as { modelContext?: any }).modelContext;
  if (marked.__agentakRelay || !context) return;
  marked.__agentakRelay = true;
  context.addEventListener("toolchange", () => window.postMessage({ type: relay }, "*"));
}

/** Runs in the isolated world, which is the only one that can reach the panel. */
function relayOutOfPage(relay: string) {
  const marked = window as { __agentakForward?: boolean };
  if (marked.__agentakForward) return;
  marked.__agentakForward = true;
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source === window && (event.data as { type?: string })?.type === relay) {
      void chrome.runtime.sendMessage({ type: relay }).catch(() => {});
    }
  });
}

const activeTab = async (): Promise<chrome.tabs.Tab | undefined> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

/**
 * Where a result came from, for the model and for the transcript. The url is
 * there because the manifest asks for the origin; a tab that has none — the new
 * tab page, a settings screen — is named rather than left blank.
 */
const NO_ORIGIN = "the current tab";

const tabOrigin = (tab: chrome.tabs.Tab): string => {
  try {
    return new URL(tab.url ?? "").origin;
  } catch {
    return NO_ORIGIN;
  }
};

/**
 * The site in front, by the one name it is known under here. A tab with no
 * origin of its own — the new tab page, a `chrome:` screen, a local file — is
 * named rather than left blank, so every such tab answers alike.
 */
export const activeOrigin = async (): Promise<string> => {
  const tab = await activeTab();
  return tab ? tabOrigin(tab) : NO_ORIGIN;
};

/**
 * The url of the tab in front, and every change to it. It is what a relative
 * link in an answer is relative to: this document is `chrome-extension:`, so
 * `/config` would otherwise be a file the extension does not have.
 *
 * The whole url, not the origin — a link written as `./next` is relative to the
 * path as well. Whatever the tab is, too: a `chrome:` screen is a base the
 * markdown renderer refuses, which is the right answer for a link that could not
 * be opened anyway. Returns the way to stop, and calls the listener at once.
 */
export function watchActiveUrl(listener: (url: string | undefined) => void): () => void {
  /** Only the last change decides, where two land while one is being read. */
  let turn = 0;
  const read = async () => {
    const mine = ++turn;
    const tab = await activeTab();
    if (mine === turn) listener(tab?.url);
  };

  const changed = () => void read();
  // A tab that navigates is a new base under the same tab. Any other tab's
  // navigation reads the same url back, so nothing moves.
  const updated = (_id: number, change: chrome.tabs.OnUpdatedInfo) => {
    if (change.url) void read();
  };

  chrome.tabs.onActivated.addListener(changed);
  chrome.tabs.onUpdated.addListener(updated);
  void read();

  return () => {
    chrome.tabs.onActivated.removeListener(changed);
    chrome.tabs.onUpdated.removeListener(updated);
  };
}

/** One injected call, with the page's own failure turned back into a throw. */
export async function inTab<T, A extends unknown[]>(
  tabId: number,
  func: (...args: A) => Answered<T> | Promise<Answered<T>>,
  args: A,
  // The string form: `executeScript` takes the enum's values, not the enum.
  world: `${chrome.scripting.ExecutionWorld}` = "MAIN",
): Promise<T> {
  const [injected] = await chrome.scripting.executeScript({
    args,
    func,
    target: { tabId },
    world,
  });
  const answered = injected?.result as Answered<T> | undefined;
  if (!answered) throw new Error("The page did not answer.");
  if (!answered.ok) throw new Error(answered.message);
  return answered.value;
}

/**
 * Attach the relay once per page, on the way past. Both readers of a page call
 * it — the session listing tools and the badge counting them — and the page
 * marks its own window, so the second call does nothing.
 */
export async function relayToolChange(tabId: number): Promise<void> {
  const target = { tabId };
  await chrome.scripting.executeScript({
    args: [RELAY],
    func: relayInPage,
    target,
    world: "MAIN",
  });
  await chrome.scripting.executeScript({ args: [RELAY], func: relayOutOfPage, target });
}

/**
 * The tools of whichever tab is in front, as a `PageTools` source. Pass it as
 * the `page` option of `createPiSession()`.
 */
export function activeTabTools(): PageTools {
  /**
   * The readers this source handed out. A site may publish a tool named
   * `read_page` too — `pageToolName()` would rename that one, since ours is
   * listed first, but `call` is given the tool as the page named it. So the two
   * are told apart by which object it is, and never by what it is called.
   */
  const readers = new WeakSet<PageTool>();

  return {
    async list() {
      const tab = await activeTab();
      if (tab?.id === undefined) return [];

      // The reader is listed first and listed always. A page that publishes no
      // WebMCP — which is nearly every page — must still leave the model able
      // to see it, and a tab that refuses injection altogether, such as the web
      // store or a `chrome:` screen, says so when the tool is called.
      const reader = readPageTool(tabOrigin(tab));
      readers.add(reader);

      const published = await inTab(tab.id, readTools, []).catch(() => []);
      // Only worth relaying from a page that has any.
      if (published.length > 0) await relayToolChange(tab.id).catch(() => {});
      return [reader, ...published];
    },

    async call(tool, args, signal) {
      if (signal?.aborted) throw new Error("The run was stopped.");
      const tab = await activeTab();
      if (tab?.id === undefined) throw new Error("There is no page to run this on.");
      // An injected call cannot be recalled, so the signal only guards the start
      // of it. A tool that takes an `AbortSignal` gets none through here.
      if (readers.has(tool)) {
        // The isolated world: the reader needs the dom and nothing the page put
        // on its own window.
        return inTab(tab.id, readPageInTab, [PAGE_LIMIT], "ISOLATED");
      }
      return inTab(tab.id, runTool, [tool.name, tool.origin, args]);
    },

    subscribe(listener) {
      const changed = () => listener();
      const updated = (_id: number, change: chrome.tabs.OnUpdatedInfo) => {
        if (change.status === "complete" || change.url) listener();
      };
      const relayed = (message: unknown) => {
        if ((message as { type?: string })?.type === RELAY) listener();
      };

      // A new tab in front is a new set of tools, and so is a page that loaded.
      chrome.tabs.onActivated.addListener(changed);
      chrome.tabs.onUpdated.addListener(updated);
      chrome.runtime.onMessage.addListener(relayed);

      return () => {
        chrome.tabs.onActivated.removeListener(changed);
        chrome.tabs.onUpdated.removeListener(updated);
        chrome.runtime.onMessage.removeListener(relayed);
      };
    },
  };
}
