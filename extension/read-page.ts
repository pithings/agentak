/**
 * The tool that reads the tab in front.
 *
 * WebMCP is the page's own offer, and almost no page makes one — it ships in
 * Chrome 149 and Edge 150 behind an origin trial. So a panel that carried only
 * those tools would face nearly every site with nothing at all. This is the
 * other half: one read-only tool, the panel's rather than the site's, that hands
 * the model the text a visitor is looking at.
 *
 * `innerText` and not `textContent`, because the first is what is rendered — it
 * skips a `display: none` subtree, keeps the line breaks a layout makes, and
 * leaves out the script and style bodies that `textContent` would hand over.
 *
 * The result is marked untrusted, and that is not a formality: a page is written
 * by someone else, and text that reaches a model is text that can try to
 * instruct it. `createPageToolset()` puts the warning in front of every result.
 */
import type { PageTool } from "@/pi/page-tools.ts";

/** The name the model calls it by, and the name the bridge matches on. */
export const READ_PAGE = "read_page";

/**
 * How much text comes back, in characters. Roughly 8K tokens — enough for an
 * article, and short of filling a 32K window with one call.
 *
 * Exported because an injected function closes over nothing: `executeScript`
 * ships the source of it, so every constant it reads has to be an argument.
 */
export const PAGE_LIMIT = 30_000;

/**
 * Runs in the tab. Returns MCP-shaped content, which is what `toToolContent()`
 * reads, so the model is handed the text and not a JSON envelope around it.
 *
 * Injected, so it closes over nothing: every constant it needs is an argument.
 */
export function readPageInTab(limit: number): { ok: true; value: string } {
  const text = (document.body?.innerText ?? "").replace(/\n{3,}/g, "\n\n").trim();
  const cut = text.length > limit;

  const head = [`# ${document.title || "Untitled"}`, document.location.href, ""].join("\n");
  const body = cut
    ? `${text.slice(0, limit)}\n\n[Cut here. The page holds ${text.length} characters in all.]`
    : text || "This page renders no text.";

  return { ok: true, value: JSON.stringify({ content: [{ text: head + body, type: "text" }] }) };
}

/** The tool as the picker lists it. `origin` is the tab it will read. */
export const readPageTool = (origin: string): PageTool => ({
  description:
    "Read the text of the web page the person is looking at, with its title and url. " +
    "prefer any other tools when available!" +
    "Long pages are cut off.",
  name: READ_PAGE,
  origin,
  // It reads and changes nothing, so there is nothing to confirm.
  readOnly: true,
  title: "Read this page",
  // Somebody else wrote this page. Its text is data, never instructions.
  untrusted: true,
});
