/**
 * The active tab's WebMCP tools, for the side panel.
 *
 * The panel document is `chrome-extension:` and its own `document.modelContext`
 * is empty, so it reads the tab instead. A `RegisteredTool` carries a live
 * `Window` and crosses no boundary, so both halves of the work run in the page:
 * `getTools()` there, `executeTool()` there, and only names, schemas and JSON
 * strings come back. That is the whole of what `PageTools` asks for.
 *
 * Injected in the `MAIN` world, where `document.modelContext` is certainly the
 * one the page registered on. That world has no `chrome.runtime`, so the
 * `toolchange` event is relayed out in two steps: the page posts a message to
 * itself, and a listener in the isolated world forwards it to the panel.
 *
 * `activeTab` is granted for the tab the toolbar button was clicked on. Another
 * tab answers nothing until the button is clicked there — a manifest with wider
 * `host_permissions` is what lifts that, and that is the reader's call, not
 * ours.
 */
import type { PageTool, PageTools } from "@/pi/page-tools.ts";

/** What the page posts to itself, and what the panel hears. */
const RELAY = "agentak:webmcp-toolchange";

/** Either half of an injected call: a page throws where the panel cannot catch. */
type Answered<T> = { ok: true; value: T } | { ok: false; message: string };

/** Runs in the page. Returns the data half of every tool it offers. */
function readTools(): Promise<Answered<PageTool[]>> {
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

const activeTabId = async (): Promise<number | undefined> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
};

/** One injected call, with the page's own failure turned back into a throw. */
async function inPage<T, A extends unknown[]>(
  tabId: number,
  func: (...args: A) => Promise<Answered<T>>,
  args: A,
): Promise<T> {
  const [injected] = await chrome.scripting.executeScript({
    args,
    func,
    target: { tabId },
    world: "MAIN",
  });
  const answered = injected?.result as Answered<T> | undefined;
  if (!answered) throw new Error("The page did not answer.");
  if (!answered.ok) throw new Error(answered.message);
  return answered.value;
}

/**
 * The tools of whichever tab is in front, as a `PageTools` source. Pass it as
 * the `page` option of `createPiSession()`.
 */
export function activeTabTools(): PageTools {
  /** Attach the relay once per page, on the way past. */
  const listen = async (tabId: number) => {
    const target = { tabId };
    await chrome.scripting.executeScript({
      args: [RELAY],
      func: relayInPage,
      target,
      world: "MAIN",
    });
    await chrome.scripting.executeScript({ args: [RELAY], func: relayOutOfPage, target });
  };

  return {
    async list() {
      const tabId = await activeTabId();
      if (tabId === undefined) return [];
      const tools = await inPage(tabId, readTools, []);
      // Only worth relaying from a page that has any.
      if (tools.length > 0) await listen(tabId).catch(() => {});
      return tools;
    },

    async call(tool, args, signal) {
      if (signal?.aborted) throw new Error("The run was stopped.");
      const tabId = await activeTabId();
      if (tabId === undefined) throw new Error("There is no page to run this on.");
      // An injected call cannot be recalled, so the signal only guards the start
      // of it. A tool that takes an `AbortSignal` gets none through here.
      return inPage(tabId, runTool, [tool.name, tool.origin, args]);
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
