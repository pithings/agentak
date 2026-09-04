import type { AssistantMessageEvent, Context, Model, ToolCall } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";

import { streamSimple, toTurns } from "../../src/pi/providers/chrome-prompt.ts";
import type {
  DownloadProgressEvent,
  PromptAvailability,
  PromptCreateOptions,
} from "../../src/pi/providers/on-device.ts";
import { ON_DEVICE_MODEL_ID, ON_DEVICE_MODELS } from "../../src/pi/providers/on-device.ts";
import type { AnyModel } from "../../src/pi/providers.ts";

const MODEL = ON_DEVICE_MODELS[ON_DEVICE_MODEL_ID] as unknown as AnyModel;

const user = (text: string): Context["messages"][number] => ({
  role: "user",
  content: [{ type: "text", text }],
  timestamp: 0,
});

/** An answer, with the calls it made where it made any. */
const assistant = (text: string, calls: ToolCall[] = []): Context["messages"][number] => ({
  role: "assistant",
  content: [{ type: "text", text }, ...calls],
  api: "chrome-prompt",
  provider: "chrome-ai",
  model: ON_DEVICE_MODEL_ID,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 0,
});

/** What the tests stand a session up with, and what they read back off it. */
interface Fake {
  availability: PromptAvailability;
  chunks: string[];
  /** What the monitor reports before `create()` settles. */
  progress: number[];
  created: PromptCreateOptions[];
  prompts: string[];
  destroyed: number;
}

const stub = (over: Partial<Fake> = {}): Fake => {
  const fake: Fake = {
    availability: "available",
    chunks: ["Hel", "lo"],
    progress: [],
    created: [],
    prompts: [],
    destroyed: 0,
    ...over,
  };

  let usage = 0;
  (globalThis as { LanguageModel?: unknown }).LanguageModel = {
    availability: async () => fake.availability,
    create: async (options: PromptCreateOptions) => {
      fake.created.push(options);
      const listeners: ((event: DownloadProgressEvent) => void)[] = [];
      options.monitor?.({ addEventListener: (_type, listener) => listeners.push(listener) });
      for (const loaded of fake.progress) {
        for (const listener of listeners) listener({ loaded } as DownloadProgressEvent);
      }
      usage = 40;
      return {
        get inputUsage() {
          return usage;
        },
        destroy: () => {
          fake.destroyed += 1;
        },
        promptStreaming: (input: string) => {
          fake.prompts.push(input);
          usage = 55;
          return (async function* () {
            yield* fake.chunks;
          })();
        },
      };
    },
  };

  return fake;
};

const TOOLS: Context["tools"] = [
  { name: "get_current_page", description: "the page", parameters: { type: "object" } as any },
  {
    name: "search_docs",
    description: "search",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "integer" } },
      required: ["query"],
    } as any,
  },
];

const collect = async (context: Context): Promise<AssistantMessageEvent[]> => {
  const events: AssistantMessageEvent[] = [];
  const stream = streamSimple(MODEL as Model<"chrome-prompt">, context);
  for await (const event of stream) events.push(event);
  return events;
};

afterEach(() => {
  delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
});

describe("toTurns", () => {
  it("splits the history from the turn to answer", () => {
    const { initialPrompts, prompt } = toTurns({
      systemPrompt: "be brief",
      messages: [user("hello"), assistant("hi"), user("what is this page?")],
    });

    expect(initialPrompts).toEqual([
      { role: "system", content: "be brief" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]);
    expect(prompt).toBe("what is this page?");
  });

  it("merges a run of one role, and tells a tool result as the user", () => {
    const { initialPrompts, prompt } = toTurns({
      messages: [
        user("read it"),
        assistant(""),
        {
          role: "toolResult",
          toolCallId: "1",
          toolName: "read_page",
          content: [{ type: "text", text: "<h1>Title</h1>" }],
          isError: false,
          timestamp: 0,
        },
        user("now summarise"),
      ],
    });

    // The empty answer is dropped, so the two user turns meet and become one.
    expect(initialPrompts).toEqual([
      { role: "user", content: "read it\n\nResult of read_page:\n<h1>Title</h1>" },
    ]);
    expect(prompt).toBe("now summarise");
  });

  it("declares the tools, and how to call one, after the host's own prompt", () => {
    const { initialPrompts } = toTurns({
      systemPrompt: "call get_current_page first",
      messages: [user("what is this page?")],
      tools: TOOLS,
    });

    expect(initialPrompts).toHaveLength(1);
    const system = initialPrompts[0];
    expect(system.role).toBe("system");
    expect(system.content.startsWith("call get_current_page first")).toBe(true);
    expect(system.content).toContain("```tool_code");
    expect(system.content).toContain("def search_docs(query: str, limit: int = None):");
  });

  it("writes a call the model made back the way it wrote it", () => {
    const { initialPrompts, prompt } = toTurns({
      messages: [
        user("what is this page?"),
        assistant("Looking.", [
          { type: "toolCall", id: "1", name: "search_docs", arguments: { query: "WebMCP" } },
        ]),
        {
          role: "toolResult",
          toolCallId: "1",
          toolName: "search_docs",
          content: [{ type: "text", text: "one page" }],
          isError: false,
          timestamp: 0,
        },
      ],
      tools: TOOLS,
    });

    expect(initialPrompts.at(-1)).toEqual({
      role: "assistant",
      content: 'Looking.\n\n```tool_code\nprint(default_api.search_docs(query="WebMCP"))\n```',
    });
    // The words the system turn told the model to expect back.
    expect(prompt).toBe("Result of search_docs:\none page");
  });

  it("leaves the system turn alone where the turn carries no tools", () => {
    const { initialPrompts } = toTurns({ systemPrompt: "be brief", messages: [user("hi")] });

    expect(initialPrompts).toEqual([{ role: "system", content: "be brief" }]);
  });

  it("refuses a context with nothing to answer", () => {
    expect(() => toTurns({ messages: [] })).toThrow("last message");
    expect(() => toTurns({ messages: [user("hi"), assistant("hello")] })).toThrow("last message");
  });
});

describe("streamSimple", () => {
  it("streams the answer, counts the turn and closes the session", async () => {
    const fake = stub();
    const events = await collect({ systemPrompt: "be brief", messages: [user("hello")] });

    expect(events.map((event) => event.type)).toEqual([
      "start",
      "text_start",
      "text_delta",
      "text_delta",
      "text_end",
      "done",
    ]);

    expect(fake.created[0].initialPrompts).toEqual([{ role: "system", content: "be brief" }]);
    expect(fake.prompts).toEqual(["hello"]);
    expect(fake.destroyed).toBe(1);

    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.reason).toBe("stop");
    expect(done.message.content).toEqual([{ type: "text", text: "Hello" }]);
    // The session's own count, before the turn and after it.
    expect(done.message.usage.input).toBe(40);
    expect(done.message.usage.output).toBe(15);
    expect(done.message.usage.cost.total).toBe(0);
  });

  it("tells the one-time download while it runs, and only then", async () => {
    const fake = stub({ availability: "downloadable", progress: [0.5] });
    const events = await collect({ messages: [user("hello")] });

    const kinds = events.map((event) => event.type);
    expect(kinds.slice(0, 2)).toEqual(["start", "thinking_start"]);
    expect(kinds).toContain("thinking_end");
    expect(kinds.at(-1)).toBe("done");

    // A bar, not a trail of percentages — see `lib/progress.ts`.
    const first = events.find((event) => event.type === "thinking_delta");
    expect(first && "delta" in first && first.delta).toBe(
      '::progress{id="model-download" value="50" label="Downloading Gemini Nano, about 4 GB. Once."}',
    );
    expect(fake.prompts).toEqual(["hello"]);
  });

  it("turns a fenced call into a call the loop can run", async () => {
    stub({
      chunks: [
        "Let me look.\n",
        "```tool_",
        'code\nprint(default_api.search_docs(query="WebMCP", limit=3))\n``',
        // Whatever the model writes after a call is the result it wishes it
        // had. The turn ends at the call, so none of this is read.
        "`\nResult: three pages.",
      ],
    });
    const events = await collect({ messages: [user("what is WebMCP?")], tools: TOOLS });

    expect(events.map((event) => event.type)).toEqual([
      "start",
      "text_start",
      "text_delta",
      "text_end",
      "toolcall_start",
      "toolcall_delta",
      "toolcall_end",
      "done",
    ]);

    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.reason).toBe("toolUse");
    expect(done.message.stopReason).toBe("toolUse");
    expect(done.message.content).toEqual([
      { type: "text", text: "Let me look.\n" },
      {
        type: "toolCall",
        id: expect.stringContaining("nano_"),
        name: "search_docs",
        arguments: { query: "WebMCP", limit: 3 },
      },
    ]);
  });

  it("takes a call the model wrote without a fence", async () => {
    stub({ chunks: ['print(search_docs(query="WebMCP page tools"))'] });
    const events = await collect({ messages: [user("what is WebMCP?")], tools: TOOLS });

    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.reason).toBe("toolUse");
    expect(done.message.content).toEqual([
      {
        type: "toolCall",
        id: expect.stringContaining("nano_"),
        name: "search_docs",
        arguments: { query: "WebMCP page tools" },
      },
    ]);
  });

  it("leaves out a result the model invented, and says so", async () => {
    stub({
      chunks: ["```tool_outputs\nthree pages\n```\nThere are three pages about it."],
    });
    const events = await collect({ messages: [user("what is WebMCP?")], tools: TOOLS });

    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.reason).toBe("stop");
    expect(done.message.content).toEqual([
      { type: "text", text: "There are three pages about it." },
    ]);
    expect(done.message.diagnostics?.[0].details?.tools).toEqual([
      "get_current_page",
      "search_docs",
    ]);
  });

  it("answers where the whole turn was a call it could not read", async () => {
    stub({ chunks: ["```tool_code\nprint(default_api.open_the_pod_bay())\n```"] });
    const events = await collect({ messages: [user("what is WebMCP?")], tools: TOOLS });

    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.reason).toBe("stop");
    expect(done.message.content).toEqual([
      { type: "text", text: "I could not make that call. Ask me again, in other words." },
    ]);
  });

  it("ends the turn with a message a person can act on", async () => {
    stub({ availability: "unavailable" });
    const events = await collect({ messages: [user("hello")] });

    const failed = events.at(-1) as Extract<AssistantMessageEvent, { type: "error" }>;
    expect(failed.type).toBe("error");
    expect(failed.reason).toBe("error");
    expect(failed.error.errorMessage).toContain("cannot run Gemini Nano");
  });

  it("ends the turn where the browser carries no api at all", async () => {
    const events = await collect({ messages: [user("hello")] });

    const failed = events.at(-1) as Extract<AssistantMessageEvent, { type: "error" }>;
    expect(failed.type).toBe("error");
    expect(failed.error.errorMessage).toContain("no built-in AI");
  });
});
