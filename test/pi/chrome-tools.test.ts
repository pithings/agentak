import type { Tool } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";

import {
  parseCall,
  type Piece,
  readAnswer,
  renderCall,
  toolGuide,
} from "../../src/pi/providers/chrome-tools.ts";

const TOOLS = [
  {
    name: "search_docs",
    description: "Search the documentation.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "what to look for" },
        limit: { type: "integer" },
        scope: { type: "string", enum: ["page", "site"] },
      },
      required: ["query"],
    },
  },
  { name: "get_current_page", description: "The page the reader is on.", parameters: {} },
] as unknown as Tool[];

/** The reader takes a stream, so a written answer is cut the way one arrives. */
const read = async (chunks: string[], tools = TOOLS) => {
  const report = { dropped: false };
  const source = (async function* () {
    yield* chunks;
  })();
  const pieces: Piece[] = [];
  for await (const piece of readAnswer(source, tools, report)) pieces.push(piece);

  const text = pieces
    .filter((piece): piece is Extract<Piece, { type: "text" }> => piece.type === "text")
    .map((piece) => piece.text)
    .join("");
  const call = pieces.find((piece) => piece.type === "call");
  return { text, call: call?.type === "call" ? call.call : undefined, dropped: report.dropped };
};

describe("toolGuide", () => {
  it("declares each tool the way the model is trained to read one", () => {
    const guide = toolGuide(TOOLS);

    expect(guide).toContain("```tool_code");
    expect(guide).toContain('print(default_api.tool_name(argument="value"))');
    // Required arguments stand bare; the rest carry the default that says so.
    expect(guide).toContain("def search_docs(query: str, limit: int = None, scope: str = None):");
    expect(guide).toContain("query: what to look for");
    expect(guide).toContain("scope: one of page, site");
    expect(guide).toContain("def get_current_page():");
  });
});

describe("parseCall", () => {
  it("reads the arguments a model writes, in the shapes it writes them", () => {
    expect(parseCall('print(default_api.search_docs(query="WebMCP", limit=3))', TOOLS)).toEqual({
      name: "search_docs",
      arguments: { query: "WebMCP", limit: 3 },
    });

    // The wrappers are a habit, not a rule, and quotes come either way.
    expect(parseCall("search_docs(query='page tools')", TOOLS)).toEqual({
      name: "search_docs",
      arguments: { query: "page tools" },
    });

    // Arguments in order, without their names.
    expect(parseCall('print(search_docs("page tools", 2))', TOOLS)).toEqual({
      name: "search_docs",
      arguments: { query: "page tools", limit: 2 },
    });
  });

  it("takes the value the model wrote as the type the tool declares", () => {
    expect(parseCall('search_docs(query="a", limit="3")', TOOLS)?.arguments).toEqual({
      query: "a",
      limit: 3,
    });
    // A word it forgot to quote is still what it meant to say.
    expect(parseCall("search_docs(query=WebMCP)", TOOLS)?.arguments).toEqual({ query: "WebMCP" });
    // `None` for an argument it does not need is the model saying nothing.
    expect(parseCall('search_docs(query="a", limit=None)', TOOLS)?.arguments).toEqual({
      query: "a",
    });
  });

  it("reads a list and a dict, and a call written over several lines", () => {
    const written = 'print(default_api.search_docs(\n  query="a",\n  limit=[1, 2],\n))';

    expect(parseCall(written, TOOLS)?.arguments).toEqual({ query: "a", limit: [1, 2] });
    expect(parseCall('search_docs(query={"text": "a", "deep": True})', TOOLS)?.arguments).toEqual({
      query: { text: "a", deep: true },
    });
  });

  it("refuses what is not a call this turn carries", () => {
    expect(parseCall("print(default_api.open_the_pod_bay())", TOOLS)).toBeUndefined();
    expect(parseCall("The answer is in search_docs.", TOOLS)).toBeUndefined();
    // Never closed: the model stopped in the middle of writing it.
    expect(parseCall('search_docs(query="a"', TOOLS)).toBeUndefined();
  });

  it("writes a call back the way the model wrote it", () => {
    const written = renderCall({ name: "search_docs", arguments: { query: "a", limit: 2 } });

    expect(written).toBe('```tool_code\nprint(default_api.search_docs(query="a", limit=2))\n```');
    expect(parseCall(written.split("\n")[1], TOOLS)?.arguments).toEqual({ query: "a", limit: 2 });
  });
});

describe("readAnswer", () => {
  it("reads the text and the call, however the chunks fall", async () => {
    const written = "Looking.\n```tool_code\nprint(default_api.get_current_page())\n```";
    const whole = await read([written]);
    const split = await read([...written]);

    expect(whole).toEqual({
      text: "Looking.\n",
      call: { name: "get_current_page", arguments: {} },
      dropped: false,
    });
    expect(split).toEqual(whole);
  });

  it("ends the answer at the call", async () => {
    const { text, call } = await read([
      "One moment.\n```tool_code\nprint(default_api.get_current_page())\n```\n",
      "Result: the widget guide.\nSo the page is the widget guide.",
    ]);

    expect(text).toBe("One moment.\n");
    expect(call?.name).toBe("get_current_page");
  });

  it("takes a call the model wrote without a fence", async () => {
    expect(await read(['print(search_docs(query="tools"))'])).toEqual({
      text: "",
      call: { name: "search_docs", arguments: { query: "tools" } },
      dropped: false,
    });
  });

  it("drops a result the model invented, and a call to a tool that is not there", async () => {
    expect(await read(["```tool_outputs\ntwo pages\n```\nThere are two.\n"])).toEqual({
      text: "There are two.\n",
      call: undefined,
      dropped: true,
    });
    expect(await read(["```tool_code\nprint(default_api.fly())\n```\nDone.\n"])).toEqual({
      text: "Done.\n",
      call: undefined,
      dropped: true,
    });
  });

  it("drops a call the model never finished writing", async () => {
    expect(await read(["Looking.\n```tool_code\nprint(default_api.get_current_"])).toEqual({
      text: "Looking.\n",
      call: undefined,
      dropped: true,
    });
  });

  it("leaves an answer that only reads like a call alone", async () => {
    const code = "Call it yourself:\n```js\nsearch_docs({ query: 'x' })\n```\nThat is all.";

    expect(await read([code])).toEqual({ text: code, call: undefined, dropped: false });
    expect(await read(["search_docs is the one to call.\n"])).toEqual({
      text: "search_docs is the one to call.\n",
      call: undefined,
      dropped: false,
    });
  });

  it("passes a turn that carries no tools straight through", async () => {
    const text = "print(get_current_page())\nstill here";

    expect(await read([text], [])).toEqual({ text, call: undefined, dropped: false });
  });
});
