import type { AgentTool } from "@earendil-works/pi-agent-core";
import { describe, expect, it, vi } from "vitest";

import { createApprovalGate } from "../../src/pi/tools/approvals.ts";
import {
  createPageToolset,
  type PageTool,
  type PageTools,
  pageToolName,
  toSchemaObject,
  toToolContent,
} from "../../src/pi/tools.ts";
import { createPiSession } from "../../src/pi/session.ts";
import { memoryStorage } from "../../src/pi/storage.ts";
import { documentTools, type RegisteredTool, webmcpSupported } from "../../src/pi/tools/webmcp.ts";

/** One tool as `getTools()` hands it over. The window is never read here. */
const registered = (over: Partial<RegisteredTool> = {}): RegisteredTool => ({
  description: "Add an item to the list",
  inputSchema: { properties: { text: { type: "string" } }, type: "object" },
  name: "add-todo",
  origin: "https://todo.example",
  window: undefined as unknown as Window,
  ...over,
});

/** `document.modelContext`, as far as anything here reads it. */
class FakeContext extends EventTarget {
  calls: { name: string; args: string }[] = [];
  answer = '{"content":[{"type":"text","text":"done"}]}';

  constructor(public tools: RegisteredTool[] = [registered()]) {
    super();
  }

  getTools = () => Promise.resolve(this.tools);

  executeTool = (tool: RegisteredTool, args: string) => {
    this.calls.push({ name: tool.name, args });
    return Promise.resolve(this.answer);
  };

  /** What a site does as its screen changes. */
  offer(tools: RegisteredTool[]) {
    this.tools = tools;
    this.dispatchEvent(new Event("toolchange"));
  }
}

/** Past the source's own bounded wait for an api that never turns up. */
const WAIT_LIMIT = 10_000;

const withContext = (context?: FakeContext) => ({ modelContext: context }) as unknown as Document;

/** A source that answers from a list, so the toolset can be driven directly. */
const sourceOf = (tools: PageTool[], answer = "ok"): PageTools & { calls: string[] } => ({
  calls: [],
  list: () => Promise.resolve(tools),
  call(_tool, args) {
    this.calls.push(args);
    return Promise.resolve(answer);
  },
});

const page = (over: Partial<PageTool> = {}): PageTool => ({
  description: "Add an item to the list",
  name: "add-todo",
  origin: "https://todo.example",
  ...over,
});

describe("webmcpSupported", () => {
  it("is false where the browser carries no model context", () => {
    expect(webmcpSupported(withContext())).toBe(false);
    expect(webmcpSupported(withContext(new FakeContext()))).toBe(true);
  });

  it("reads no tools rather than failing", async () => {
    await expect(documentTools({ document: withContext() }).list()).resolves.toEqual([]);
  });
});

describe("documentTools", () => {
  it("hands over the data half, with the hints read out", async () => {
    const context = new FakeContext([
      registered({ annotations: { readOnlyHint: true, untrustedContentHint: true } }),
    ]);
    const [tool] = await documentTools({ document: withContext(context) }).list();

    expect(tool).toMatchObject({
      name: "add-todo",
      origin: "https://todo.example",
      readOnly: true,
      untrusted: true,
    });
    // The live `Window` stays behind: only what can be serialised comes out.
    expect(tool).not.toHaveProperty("window");
  });

  it("calls the live tool the page tool came from, with a JSON string", async () => {
    const context = new FakeContext();
    const source = documentTools({ document: withContext(context) });
    const [tool] = await source.list();

    await source.call(tool, '{"text":"milk"}');
    expect(context.calls).toEqual([{ name: "add-todo", args: '{"text":"milk"}' }]);
  });

  it("says so when the page dropped the tool between the list and the call", async () => {
    const context = new FakeContext();
    const source = documentTools({ document: withContext(context) });
    const [tool] = await source.list();
    context.tools = [];
    // The list is what the call is matched against, so it is read again.
    await source.list();

    await expect(source.call(tool, "{}")).rejects.toThrow(/no longer offers/);
  });

  it("binds to an api that arrives after the chat did", async () => {
    vi.useFakeTimers();
    // A host that mounts the chat early: at module scope, or before a shim has
    // run. Read once, this source would stay deaf for the whole session.
    const late: { modelContext?: FakeContext } = {};
    const source = documentTools({ document: late as unknown as Document });
    const listener = vi.fn();
    source.subscribe!(listener);

    await vi.advanceTimersByTimeAsync(1500);
    expect(listener).not.toHaveBeenCalled();

    const context = new FakeContext();
    late.modelContext = context;
    await vi.advanceTimersByTimeAsync(600);

    // Arriving is news of its own: nothing has read this api's list yet.
    expect(listener).toHaveBeenCalledTimes(1);
    await expect(source.list()).resolves.toHaveLength(1);

    context.offer([]);
    expect(listener).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("gives up on a browser that will never carry it", async () => {
    vi.useFakeTimers();
    const never: { modelContext?: FakeContext } = {};
    const source = documentTools({ document: never as unknown as Document });
    source.subscribe!(vi.fn());

    // Past the wait, nothing is left running — a browser without the api must
    // not keep a timer alive for the life of the page.
    await vi.advanceTimersByTimeAsync(WAIT_LIMIT);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("stops looking once it is disposed of", async () => {
    vi.useFakeTimers();
    const late: { modelContext?: FakeContext } = {};
    const source = documentTools({ document: late as unknown as Document });
    const listener = vi.fn();
    source.subscribe!(listener);
    source.dispose!();

    late.modelContext = new FakeContext();
    await vi.advanceTimersByTimeAsync(WAIT_LIMIT);
    expect(listener).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("follows toolchange", async () => {
    const context = new FakeContext();
    const listener = vi.fn();
    const off = documentTools({ document: withContext(context) }).subscribe!(listener);

    context.offer([]);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    context.offer([registered()]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("toSchemaObject", () => {
  // The field was a `DOMString` until 2026-08-14, and the spec still keeps the
  // schema stringified inside, so a browser shipping the api today sends text.
  // A string reaching a provider as a schema is what `"type" in schema` throws
  // on, so the whole turn fails rather than the one tool.
  it("parses the JSON text an older browser sends", () => {
    expect(toSchemaObject('{"type":"object","properties":{}}')).toEqual({
      properties: {},
      type: "object",
    });
  });

  it("keeps an object as it stands", () => {
    const schema = { properties: { text: { type: "string" } }, type: "object" };
    expect(toSchemaObject(schema)).toBe(schema);
  });

  it("falls back to no arguments on anything else", () => {
    for (const value of [undefined, null, "not json", 7, "[]"]) {
      expect(toSchemaObject(value)).toEqual({ properties: {}, type: "object" });
    }
  });
});

describe("pageToolName", () => {
  it("keeps what a provider takes and replaces what it does not", () => {
    expect(pageToolName("cart.add", new Set())).toBe("cart_add");
    expect(pageToolName("add-todo", new Set())).toBe("add-todo");
    expect(pageToolName("a".repeat(90), new Set())).toHaveLength(64);
  });

  it("gives a taken name a suffix, so two frames can both be heard", () => {
    const taken = new Set(["search"]);
    expect(pageToolName("search", taken)).toBe("search_2");
    taken.add("search_2");
    expect(pageToolName("search", taken)).toBe("search_3");
  });
});

describe("toToolContent", () => {
  it("hands over what is not JSON as it stands", () => {
    expect(toToolContent("plain")).toEqual([{ text: "plain", type: "text" }]);
  });

  it("reads MCP content, text and images alike", () => {
    const raw = JSON.stringify({
      content: [
        { text: "two left", type: "text" },
        { data: "AAA", mimeType: "image/png", type: "image" },
      ],
    });
    expect(toToolContent(raw)).toEqual([
      { text: "two left", type: "text" },
      { data: "AAA", mimeType: "image/png", type: "image" },
    ]);
  });

  it("keeps JSON that is not MCP shaped", () => {
    expect(toToolContent('{"count":2}')).toEqual([{ text: '{"count":2}', type: "text" }]);
  });

  // What a real site answers: undocs' docs tools all return a plain object.
  it("hands a plain result over whole, so nothing is lost on the way", () => {
    const raw = JSON.stringify({ count: 1, results: [{ path: "/guide", title: "Guide" }] });
    expect(toToolContent(raw)).toEqual([{ text: raw, type: "text" }]);
  });

  it("leaves a site's own `content` array alone", () => {
    // `content` is an ordinary field name. Read as MCP, these rows would be
    // mangled into text blocks one at a time and the shape would be gone.
    const raw = JSON.stringify({ content: [{ path: "/a" }, { path: "/b" }] });
    expect(toToolContent(raw)).toEqual([{ text: raw, type: "text" }]);
  });
});

describe("createPageToolset", () => {
  const only = (tools: AgentTool<any>[]) => tools.map((tool) => tool.name);

  it("has nothing until it has read the source", async () => {
    const toolset = createPageToolset(sourceOf([page()]));
    expect(toolset.tools()).toEqual([]);

    await toolset.refresh();
    expect(only(toolset.tools())).toEqual(["add-todo"]);
  });

  it("stands the page's tools beside the host's rather than over them", async () => {
    const toolset = createPageToolset(sourceOf([page({ name: "search" })]), {
      reserved: ["search"],
    });
    await toolset.refresh();
    expect(only(toolset.tools())).toEqual(["search_2"]);
  });

  it("gates each tool on what the site said about it", async () => {
    const toolset = createPageToolset(
      sourceOf([page(), page({ name: "list-todos", readOnly: true })]),
    );
    await toolset.refresh();

    // Read-only changes nothing, so it runs unasked; anything else is asked
    // every time. A name that is not the page's is nobody's business here.
    expect(toolset.approvalFor("add-todo")).toBe("always");
    expect(toolset.approvalFor("list-todos")).toBe("never");
    expect(toolset.approvalFor("a-host-tool")).toBeUndefined();
  });

  it("passes the arguments as a JSON string and reads the answer back", async () => {
    const source = sourceOf([page()], '{"content":[{"type":"text","text":"added"}]}');
    const toolset = createPageToolset(source);
    await toolset.refresh();

    const result = await toolset.tools()[0].execute("call-1", { text: "milk" });
    expect(source.calls).toEqual(['{"text":"milk"}']);
    expect(result.content).toEqual([{ text: "added", type: "text" }]);
    expect(result.details).toMatchObject({ origin: "https://todo.example", untrusted: false });
  });

  it("tells the model where untrusted output came from", async () => {
    const toolset = createPageToolset(sourceOf([page({ untrusted: true })], "read the reviews"));
    await toolset.refresh();

    const { content } = await toolset.tools()[0].execute("call-1", {});
    expect(content).toHaveLength(2);
    expect(content[0]).toMatchObject({ type: "text" });
    expect((content[0] as { text: string }).text).toContain("https://todo.example");
    expect(content[1]).toEqual({ text: "read the reviews", type: "text" });
  });

  it("throws on an MCP failure rather than answering with it", async () => {
    const raw = JSON.stringify({
      content: [{ text: "no such item", type: "text" }],
      isError: true,
    });
    const toolset = createPageToolset(sourceOf([page()], raw));
    await toolset.refresh();

    await expect(toolset.tools()[0].execute("call-1", {})).rejects.toThrow("no such item");
  });

  it("tells its listeners only about a list that changed", async () => {
    const listener = vi.fn();
    let listed = [page()];
    const toolset = createPageToolset({
      call: () => Promise.resolve("ok"),
      list: () => Promise.resolve(listed),
    });
    toolset.subscribe(listener);

    await toolset.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
    await toolset.refresh();
    expect(listener).toHaveBeenCalledTimes(1);

    listed = [];
    await toolset.refresh();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(toolset.tools()).toEqual([]);
  });

  it("reads the source again when it says its list changed", async () => {
    let fire = () => {};
    let listed = [page()];
    const toolset = createPageToolset({
      call: () => Promise.resolve("ok"),
      list: () => Promise.resolve(listed),
      subscribe(listener) {
        fire = listener;
        return () => {};
      },
    });
    await toolset.refresh();

    listed = [page({ name: "clear-todos" })];
    fire();
    await vi.waitFor(() => expect(only(toolset.tools())).toEqual(["clear-todos"]));
  });

  it("leaves the agent with no page tools when the source will not answer", async () => {
    const toolset = createPageToolset({
      call: () => Promise.reject(new Error("no")),
      list: () => Promise.reject(new Error("the tab is gone")),
    });
    await expect(toolset.refresh()).resolves.toBeUndefined();
    expect(toolset.tools()).toEqual([]);
  });
});

describe("the gate a page tool is behind", () => {
  const call = (gate: ReturnType<typeof createApprovalGate>, name: string) =>
    gate.beforeToolCall({ toolCall: { id: `${name}-1`, name } } as never);

  /** What a page toolset answers: read-only never asks, the rest always do. */
  const pageRules = (name: string) =>
    name === "read_page" ? "never" : name === "navigate" ? "always" : undefined;

  it("runs a read-only page tool without asking", async () => {
    const gate = createApprovalGate("once", pageRules);
    await expect(call(gate, "read_page")).resolves.toBeUndefined();
    expect(gate.pending()).toEqual([]);
  });

  it("asks again about one the page did not mark read-only", async () => {
    const gate = createApprovalGate("once", pageRules);

    void call(gate, "navigate");
    expect(gate.pending()).toHaveLength(1);
    gate.respond("navigate-1", true);

    // An allow covers a tool asked about once. It must not cover this one.
    void call(gate, "navigate");
    expect(gate.pending()).toHaveLength(1);
  });

  it("leaves a host's own tool to the session policy", async () => {
    const gate = createApprovalGate("once", pageRules);

    void call(gate, "host_tool");
    expect(gate.pending()).toHaveLength(1);
    gate.respond("host_tool-1", true);

    await expect(call(gate, "host_tool")).resolves.toBeUndefined();
  });

  it("lets a session that turned the gate off keep it off", async () => {
    const gate = createApprovalGate("never", pageRules);
    await expect(call(gate, "navigate")).resolves.toBeUndefined();
    expect(gate.pending()).toEqual([]);
  });

  it("takes the gate away mid-conversation, and answers what was at it", async () => {
    const gate = createApprovalGate("once", pageRules);
    expect(gate.policy()).toBe("once");

    const waiting = call(gate, "navigate");
    expect(gate.pending()).toHaveLength(1);

    // The click that took the gate away is an answer to the call at it: the
    // question is gone, so the call runs rather than waiting for nothing.
    gate.setPolicy("never");
    await expect(waiting).resolves.toBeUndefined();
    expect(gate.pending()).toEqual([]);
    expect(gate.answers()["navigate-1"]?.approved).toBe(true);

    // And the page's own word goes with it — the session-wide off outranks it.
    await expect(call(gate, "host_tool")).resolves.toBeUndefined();
  });

  it("asks about everything again once the gate is back", async () => {
    const gate = createApprovalGate("once", pageRules);

    void call(gate, "host_tool");
    gate.respond("host_tool-1", true);
    await expect(call(gate, "host_tool")).resolves.toBeUndefined();

    gate.setPolicy("never");
    gate.setPolicy("once");
    expect(gate.policy()).toBe("once");

    // The allow covered a gate that has been down since. It covers nothing now.
    void call(gate, "host_tool");
    expect(gate.pending()).toHaveLength(1);
  });
});

describe("the page option", () => {
  const names = (session: ReturnType<typeof createPiSession>) =>
    session.snapshot().agent?.tools?.map((tool) => tool.name);

  it("offers nothing unless a host asked for it", () => {
    const session = createPiSession({ storage: memoryStorage() });
    expect(names(session)).toEqual([]);
    session.dispose();
  });

  it("puts the page's tools on the agent, and follows the page", async () => {
    let listed = [page()];
    let fire = () => {};
    const session = createPiSession({
      page: {
        call: () => Promise.resolve("ok"),
        list: () => Promise.resolve(listed),
        subscribe(listener) {
          fire = listener;
          return () => {};
        },
      },
      storage: memoryStorage(),
    });

    await vi.waitFor(() => expect(names(session)).toEqual(["add-todo"]));

    listed = [page(), page({ name: "list-todos" })];
    fire();
    await vi.waitFor(() => expect(names(session)).toEqual(["add-todo", "list-todos"]));
    session.dispose();
  });

  it("opens with the gate down, and reports the switch that puts it back", async () => {
    const session = createPiSession({
      page: { call: () => Promise.resolve("ok"), list: () => Promise.resolve([page()]) },
      storage: memoryStorage(),
    });

    // Nothing to gate yet, so the bar is told about no switch at all.
    expect(session.snapshot().toolPolicy).toBeUndefined();

    await vi.waitFor(() => expect(session.snapshot().toolPolicy).toBe("bypass"));
    session.setToolPolicy?.("ask");
    expect(session.snapshot().toolPolicy).toBe("ask");
    session.setToolPolicy?.("bypass");
    expect(session.snapshot().toolPolicy).toBe("bypass");
    session.dispose();
  });

  it("opens on the gate a host asked for", async () => {
    const session = createPiSession({
      approvals: "always",
      page: { call: () => Promise.resolve("ok"), list: () => Promise.resolve([page()]) },
      storage: memoryStorage(),
    });

    await vi.waitFor(() => expect(session.snapshot().toolPolicy).toBe("ask"));
    session.dispose();
  });

  it("reads this document where it is told to read the page", async () => {
    const context = new FakeContext();
    const document = withContext(context);
    // `page: true` reads the real document, which carries none of this — the
    // source is what the option stands for, so it is passed directly here.
    const session = createPiSession({
      page: documentTools({ document }),
      storage: memoryStorage(),
    });

    await vi.waitFor(() => expect(names(session)).toEqual(["add-todo"]));
    session.dispose();
  });
});
