import type { AssistantMessageEvent, Context, Model } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";

import { useWllamaModule, WLLAMA_MODEL_ID, WLLAMA_MODELS } from "../../src/pi/local.ts";
import type { AnyModel } from "../../src/pi/providers.ts";
import { streamSimple, toMessages, unloadWllama, type WllamaModule } from "../../src/pi/wllama.ts";

const MODEL = WLLAMA_MODELS[WLLAMA_MODEL_ID] as unknown as AnyModel;

/**
 * A model whose chat template has no place for tools. Every listed model can
 * call one, so the path is stood up here rather than pointing at a row.
 */
const PLAIN_ID = "no-tools-under-test";
const PLAIN = { ...WLLAMA_MODELS[WLLAMA_MODEL_ID], id: PLAIN_ID, name: "Plain", tools: false };

const user = (text: string): Context["messages"][number] => ({
  role: "user",
  content: [{ type: "text", text }],
  timestamp: 0,
});

/** One streamed chunk, written the way llama.cpp sends it. */
type Chunk = Record<string, any>;

const text = (content: string): Chunk => ({ choices: [{ delta: { content } }] });

/** What the tests stand a model up with, and what they read back off it. */
interface Fake {
  chunks: Chunk[];
  /** Thrown by `loadModelFromUrl`, so a failed load can be told. */
  failure?: unknown;
  loaded: { url: string; params: Record<string, any> }[];
  calls: Record<string, any>[];
  exited: number;
}

const stub = (over: Partial<Fake> = {}): Fake => {
  const fake: Fake = { chunks: [], loaded: [], calls: [], exited: 0, ...over };

  useWllamaModule(async () => {
    const module: WllamaModule = {
      Wllama: class {
        async loadModelFromUrl(url: string, params: Record<string, any>) {
          fake.loaded.push({ url, params });
          params.progressCallback?.({ loaded: 50, total: 100 });
          if (fake.failure) throw fake.failure;
        }
        async createChatCompletion(options: Record<string, any>) {
          fake.calls.push(options);
          return (async function* () {
            yield* fake.chunks;
          })();
        }
        async exit() {
          fake.exited += 1;
        }
      } as unknown as WllamaModule["Wllama"],
    };
    return module;
  });

  return fake;
};

const collect = async (
  context: Context,
  model: AnyModel = MODEL,
): Promise<AssistantMessageEvent[]> => {
  const events: AssistantMessageEvent[] = [];
  for await (const event of streamSimple(model as Model<"wllama">, context)) events.push(event);
  return events;
};

afterEach(async () => {
  await unloadWllama();
  useWllamaModule(undefined);
  delete WLLAMA_MODELS[PLAIN_ID];
});

describe("WLLAMA_MODELS", () => {
  it("names a file to download, and what it weighs", () => {
    for (const model of Object.values(WLLAMA_MODELS)) {
      expect(model.baseUrl, model.id).toMatch(/^https:\/\/huggingface\.co\/.+\.gguf$/);
      expect(model.size, model.id).toBeTruthy();
      expect(model.api).toBe("wllama");
    }
  });
});

describe("toMessages", () => {
  it("writes the transcript as the api takes it", () => {
    const messages = toMessages({
      systemPrompt: "be brief",
      messages: [
        user("what is this page?"),
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "the page is unread" },
            { type: "toolCall", id: "1", name: "read_page", arguments: { selector: "main" } },
          ],
          api: "wllama",
          provider: "wllama",
          model: WLLAMA_MODEL_ID,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "toolUse",
          timestamp: 0,
        },
        {
          role: "toolResult",
          toolCallId: "1",
          toolName: "read_page",
          content: [{ type: "text", text: "<h1>Title</h1>" }],
          isError: false,
          timestamp: 0,
        },
      ],
    });

    // The thinking of the last turn is left behind; the call it made is not.
    expect(messages).toEqual([
      { role: "system", content: "be brief" },
      { role: "user", content: "what is this page?" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "1",
            type: "function",
            function: { name: "read_page", arguments: '{"selector":"main"}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "1", content: "<h1>Title</h1>" },
    ]);
  });
});

describe("streamSimple", () => {
  it("loads the model once, streams the answer and counts the turn", async () => {
    const fake = stub({
      chunks: [
        text("Hel"),
        text("lo"),
        {
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 3,
            prompt_tokens_details: { cached_tokens: 4 },
          },
        },
      ],
    });

    const first = await collect({ systemPrompt: "be brief", messages: [user("hello")] });
    expect(first.map((event) => event.type)).toEqual([
      "start",
      "text_start",
      "text_delta",
      "text_delta",
      "text_end",
      "done",
    ]);

    const done = first.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.message.content).toEqual([{ type: "text", text: "Hello" }]);
    // The cached part of the prompt is told apart from the rest of it, so the
    // two are the prompt rather than twice the prompt.
    expect(done.message.usage.input).toBe(8);
    expect(done.message.usage.cacheRead).toBe(4);
    expect(done.message.usage.output).toBe(3);
    expect(done.message.usage.totalTokens).toBe(15);
    expect(done.message.usage.cost.total).toBe(0);

    expect(fake.loaded[0].url).toBe(MODEL.baseUrl);
    expect(fake.loaded[0].params.n_ctx).toBe(MODEL.contextWindow);
    expect(fake.calls[0].messages[0]).toEqual({ role: "system", content: "be brief" });
    // The turn is counted only where the count is asked for.
    expect(fake.calls[0].stream_options).toEqual({ include_usage: true });

    // The weights stay in memory: a second turn on the same model loads nothing.
    await collect({ messages: [user("again")] });
    expect(fake.loaded.length).toBe(1);
  });

  it("counts the turn from the timings, where there is no usage", async () => {
    stub({
      chunks: [
        text("Hel"),
        text("lo"),
        {
          choices: [{ delta: {}, finish_reason: "stop" }],
          timings: { cache_n: 4, prompt_n: 8, predicted_n: 3 },
        },
      ],
    });

    const events = await collect({ messages: [user("hello")] });
    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.message.usage.input).toBe(8);
    expect(done.message.usage.cacheRead).toBe(4);
    expect(done.message.usage.output).toBe(3);
    expect(done.message.usage.totalTokens).toBe(15);
  });

  it("estimates the turn, where the runtime counted neither way", async () => {
    stub({
      chunks: [text("Hel"), text("lo"), { choices: [{ delta: {}, finish_reason: "stop" }] }],
    });

    const events = await collect({ messages: [user("hello")] });
    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    // Two chunks carried an answer; the prompt is measured by its characters.
    expect(done.message.usage.output).toBe(2);
    expect(done.message.usage.input).toBeGreaterThan(0);
    expect(done.message.usage.totalTokens).toBe(
      done.message.usage.input + done.message.usage.output,
    );
  });

  it("tells the thinking of a reasoning model apart from its answer", async () => {
    stub({
      chunks: [
        { choices: [{ delta: { reasoning_content: "a greeting" } }] },
        text("Hello"),
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ],
    });

    const events = await collect({ messages: [user("hello")] });
    expect(events.map((event) => event.type)).toEqual([
      "start",
      "thinking_start",
      "thinking_delta",
      "thinking_end",
      "text_start",
      "text_delta",
      "text_end",
      "done",
    ]);
  });

  it("gathers a streamed tool call into one block", async () => {
    stub({
      chunks: [
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "read_page" } }] } },
          ],
        },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"sel' } }] } }] },
        {
          choices: [
            {
              delta: { tool_calls: [{ index: 0, function: { arguments: 'ector":"main"}' } }] },
              finish_reason: "tool_calls",
            },
          ],
        },
      ],
    });

    const events = await collect({
      messages: [user("read this page")],
      tools: [{ name: "read_page", description: "read it", parameters: { type: "object" } as any }],
    });

    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.reason).toBe("toolUse");
    expect(done.message.content).toEqual([
      { type: "toolCall", id: "c1", name: "read_page", arguments: { selector: "main" } },
    ]);
  });

  it("says the tools went unused where the chat template has no place for them", async () => {
    const fake = stub({
      chunks: [text("Hello"), { choices: [{ delta: {}, finish_reason: "stop" }] }],
    });

    WLLAMA_MODELS[PLAIN_ID] = PLAIN;
    const events = await collect(
      {
        messages: [user("read this page")],
        tools: [
          { name: "read_page", description: "read it", parameters: { type: "object" } as any },
        ],
      },
      PLAIN as unknown as AnyModel,
    );

    const done = events.at(-1) as Extract<AssistantMessageEvent, { type: "done" }>;
    expect(done.message.diagnostics?.[0].details?.tools).toEqual(["read_page"]);
    expect(fake.calls[0].tools).toBeUndefined();
  });

  it("ends the turn with a message a person can act on, and keeps nothing", async () => {
    const fake = stub({ failure: Object.assign(new Error("404"), { type: "download_error" }) });

    const events = await collect({ messages: [user("hello")] });
    const failed = events.at(-1) as Extract<AssistantMessageEvent, { type: "error" }>;
    expect(failed.type).toBe("error");
    expect(failed.error.errorMessage).toContain("could not be downloaded");
    expect(fake.exited).toBe(1);
  });
});
