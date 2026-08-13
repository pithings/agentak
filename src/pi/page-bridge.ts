/**
 * How a tool reaches the page.
 *
 * The playground and a host page read the document they render in. The
 * extension will implement the same two calls over `chrome.scripting`, against
 * the active tab — the tools never learn which one they got.
 */
export interface PageSnapshot {
  url: string;
  title: string;
  text: string;
  /** True when the page held more text than `maxChars`. */
  truncated: boolean;
}

export interface PageElement {
  selector: string;
  tag: string;
  text: string;
  href?: string;
  role?: string;
}

export interface PageBridge {
  read(maxChars: number): Promise<PageSnapshot>;
  find(selector: string, limit: number): Promise<PageElement[]>;
}

/** Runs of whitespace become one space, so the model pays for text only. */
const collapse = (text: string) =>
  text
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** `innerText` skips hidden nodes, but jsdom does not implement it. */
const visibleText = (element: HTMLElement) => element.innerText ?? element.textContent ?? "";

/**
 * A selector that finds this element again: an id when it has one, otherwise a
 * path of at most four `:nth-of-type()` steps.
 */
function cssPath(element: Element): string {
  const steps: string[] = [];
  let node: Element | null = element;

  while (node && steps.length < 4) {
    if (node.id) {
      steps.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    const tag = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (!parent) {
      steps.unshift(tag);
      break;
    }
    const twins = [...parent.children].filter((child) => child.tagName === node?.tagName);
    steps.unshift(twins.length > 1 ? `${tag}:nth-of-type(${twins.indexOf(node) + 1})` : tag);
    node = parent;
  }

  return steps.join(" > ");
}

/** A bridge over a document this script already shares. */
export function documentBridge(doc: Document = document): PageBridge {
  return {
    read(maxChars) {
      const text = collapse(visibleText(doc.body));
      return Promise.resolve({
        url: doc.location?.href ?? "",
        title: doc.title,
        text: text.slice(0, maxChars),
        truncated: text.length > maxChars,
      });
    },

    find(selector, limit) {
      // An invalid selector is the model's mistake, not a crash — the tool
      // turns the throw into an error result.
      const found = [...doc.querySelectorAll(selector)].slice(0, limit);
      return Promise.resolve(
        found.map((element) => ({
          selector: cssPath(element),
          tag: element.tagName.toLowerCase(),
          text: collapse(visibleText(element as HTMLElement)).slice(0, 200),
          href: element.getAttribute("href") ?? undefined,
          role: element.getAttribute("role") ?? undefined,
        })),
      );
    },
  };
}
