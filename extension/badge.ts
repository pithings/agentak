// Docs: @docs/7.extension.md
/**
 * How many tools the page in front publishes, on the toolbar icon.
 *
 * The badge answers the question the panel cannot be opened often enough to
 * ask: does this site offer the agent anything? WebMCP ships behind an origin
 * trial and nearly no page publishes a tool, so the answer is usually nothing —
 * and a person who had to open the panel on every tab to learn that would stop
 * looking. So the count is drawn from the service worker rather than the panel,
 * and it shows whether the panel is open or not.
 *
 * **`read_page` is not counted.** The panel offers it on every page, and a badge
 * that reads `1` everywhere states nothing.
 *
 * The badge is set per tab, so the mark belongs to the page it was counted on
 * and the tab beside it keeps its own. Only the tab in front is ever counted: a
 * badge is read where it is looked at, and counting a background tab would put
 * an injected call in every page that loads anywhere. A tab that finished
 * loading behind the one in front is counted when it comes forward.
 *
 * The worker sleeps between events. Every listener here is registered while the
 * module is evaluated, which is what lets an event wake it.
 */
import { inTab, readTools, RELAY, relayToolChange } from "./tab-tools.ts";

/** The icon's own two colours, so the badge reads on either toolbar. */
const PLATE = "#14161a";
const INK = "#eef0f3";

/** More than this reads as `9+`. A badge holds about four characters. */
const MOST = 9;

/** The last count asked of a tab, so a slow answer cannot land on a newer one. */
const asked = new Map<number, number>();

const label = (count: number) =>
  count === 0
    ? "Open agentak"
    : `Open agentak — this page offers ${count} tool${count === 1 ? "" : "s"}`;

/** Mark one tab. A tab that closed mid-count takes the call down with it. */
async function draw(tabId: number, count: number): Promise<void> {
  const text = count === 0 ? "" : count > MOST ? `${MOST}+` : String(count);
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setTitle({ tabId, title: label(count) });
}

/** Count what a tab publishes, and mark it with the answer. */
async function count(tabId: number): Promise<void> {
  const token = (asked.get(tabId) ?? 0) + 1;
  asked.set(tabId, token);

  // A page with no `document.modelContext` throws, which is the same answer as
  // none — as is a tab that refuses injection, such as a `chrome:` screen.
  const tools = await inTab(tabId, readTools, []).catch(() => []);
  if (asked.get(tabId) !== token) return;

  await draw(tabId, tools.length).catch(() => {});
  // Worth relaying only from a page that has any. The relay is what keeps the
  // count true while the tab stays where it is: a page can register a tool long
  // after it loaded, and drop one just as late.
  if (tools.length > 0) await relayToolChange(tabId).catch(() => {});
}

/** Take the mark off, for a page that is no longer there to have published it. */
function clear(tabId: number): void {
  asked.delete(tabId);
  void draw(tabId, 0).catch(() => {});
}

/** Start counting. Call it once, while the worker is being evaluated. */
export function watchPageTools(): void {
  void chrome.action.setBadgeBackgroundColor({ color: PLATE }).catch(() => {});
  void chrome.action.setBadgeTextColor({ color: INK }).catch(() => {});

  chrome.tabs.onActivated.addListener(({ tabId }) => void count(tabId));

  chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (!tab.active) return;
    // A navigation takes the old page's tools with it. The new count follows
    // once there is a document to ask.
    if (change.status === "loading") clear(tabId);
    if (change.status === "complete") void count(tabId);
  });

  chrome.tabs.onRemoved.addListener((tabId) => asked.delete(tabId));

  // The page changed what it offers, through the relay `relayToolChange()` put
  // there. The session sends nothing else, so the type is checked all the same.
  chrome.runtime.onMessage.addListener((message: unknown, sender) => {
    const tabId = sender.tab?.id;
    if (tabId !== undefined && (message as { type?: string })?.type === RELAY) void count(tabId);
  });

  // The worker wakes with tabs already open, and one of them is in front.
  void chrome.tabs
    .query({ active: true })
    .then((tabs) => {
      for (const tab of tabs) if (tab.id !== undefined) void count(tab.id);
    })
    .catch(() => {});
}
