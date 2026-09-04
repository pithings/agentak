import type { AssistantMessageEvent, Context, Model } from "@earendil-works/pi-ai";
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

const assistant = (text: string): Context["messages"][number] => ({
  role: "assistant",
  content: [{ type: "text", text }],
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

  it("says the tools went unused rather than failing the turn", async () => {
    stub();
    const events = await collect({
      messages: [user("read this page")],
      tools: [{ name: "read_page", description: "read it", parameters: { type: "object" } as any }],
    });

    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.message.diagnostics?.[0].details?.tools).toEqual(["read_page"]);
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
