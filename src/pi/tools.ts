import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";

import type { PageBridge } from "@/pi/page-bridge";

/** Enough of a page for a summary, and short enough to stay affordable. */
const READ_MAX = 8000;
const FIND_LIMIT = 20;

/** Every result is json, so the model reads tool output the way it wrote the call. */
const json = <T>(value: unknown, details: T): AgentToolResult<T> => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  details,
});

const readPageSchema = Type.Object(
  {
    maxChars: Type.Optional(
      Type.Number({ description: `Read at most this many characters. Default ${READ_MAX}.` }),
    ),
  },
  { additionalProperties: false },
);

const findElementsSchema = Type.Object(
  {
    selector: Type.String({ description: "A CSS selector, as `document.querySelectorAll` takes." }),
    limit: Type.Optional(
      Type.Number({ description: `Return at most this many elements. Default ${FIND_LIMIT}.` }),
    ),
  },
  { additionalProperties: false },
);

/**
 * The page tools.
 *
 * `AgentTool<any>` is what `AgentState.tools` holds — the schema is checked
 * against `execute` here, and erased at the boundary.
 */
export function createPageTools(page: PageBridge): AgentTool<any>[] {
  const readPage: AgentTool<typeof readPageSchema> = {
    name: "read_page",
    label: "Read the page",
    description:
      "Read the visible text of the current page. Returns the title, the URL and the text, " +
      "truncated to `maxChars`.",
    parameters: readPageSchema,
    async execute(_toolCallId, { maxChars }) {
      const snapshot = await page.read(maxChars ?? READ_MAX);
      return json(snapshot, snapshot);
    },
  };

  const findElements: AgentTool<typeof findElementsSchema> = {
    name: "find_elements",
    label: "Find elements",
    description:
      "Find elements on the current page by CSS selector. Returns a selector that finds each " +
      "one again, its tag, and its text.",
    parameters: findElementsSchema,
    async execute(_toolCallId, { selector, limit }) {
      const elements = await page.find(selector, limit ?? FIND_LIMIT);
      return json({ count: elements.length, elements }, elements);
    },
  };

  return [readPage, findElements];
}
