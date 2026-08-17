// Docs: @docs/4.agents/2.pi-agent/3.on-device-models.md
/**
 * The `wllama` api: llama.cpp compiled to WebAssembly, spoken the way pi speaks
 * to a provider. Loaded only when a local model is picked, like every other api
 * module in `providers.ts`.
 *
 * wllama is not a dependency of this package. The esm bundle is imported from a
 * CDN on the first turn and the wasm comes from the same place — `local.ts`
 * holds both urls, and `useWllamaSource()` is how a host ships its own copy
 * instead. The weights come from Hugging Face and the browser keeps them, so
 * the download is once per model rather than once per page.
 *
 * The api is OpenAI shaped, which is most of the work: messages in, chunks out,
 * with tool calls where the chat template of the model carries them. What it
 * does not have is a key, a rate limit, or a request that leaves the machine.
 */

import { lazyStream } from "@earendil-works/pi-ai/api/lazy";
import type {
  Api,
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context,
  Message,
  Model,
  SimpleStreamOptions,
  TextContent,
  ThinkingContent,
  ToolCall,
} from "@earendil-works/pi-ai";

import { findLocalModel, loadWllamaModule, type LocalModel, wllamaWasmUrl } from "./local.ts";

/** How often the download is asked how far it has come. */
const PROGRESS_MS = 500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/*
 * The module as this file uses it. It is imported at a url, so the types are
 * written here rather than taken from a package that is not installed.
 */

interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}

interface ChatTool {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}

interface ChunkToolCall {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface Chunk {
  choices?: {
    delta?: {
      content?: string | null;
      /** Where llama.cpp puts the thinking of a reasoning model. */
      reasoning_content?: string | null;
      tool_calls?: ChunkToolCall[];
    };
    finish_reason?: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  } | null;
  /** llama.cpp's own count, which the last chunk carries whatever was asked. */
  timings?: { cache_n?: number; prompt_n?: number; predicted_n?: number };
}

interface WllamaInstance {
  loadModelFromUrl(url: string, params: Record<string, unknown>): Promise<void>;
  createChatCompletion(options: Record<string, unknown>): Promise<AsyncIterable<Chunk>>;
  exit(): Promise<void>;
}

/** What the loader in `local.ts` must resolve to. */
export interface WllamaModule {
  Wllama: new (paths: { default: string }, config?: Record<string, unknown>) => WllamaInstance;
}

/*
 * One model is held at a time: the weights sit in memory, and a second set
 * beside them is what a browser tab has no room for.
 */

let held: { id: string; wllama: WllamaInstance } | undefined;

/** Drops the model and frees the memory it holds. */
export async function unloadWllama(): Promise<void> {
  const previous = held;
  held = undefined;
  await previous?.wllama.exit().catch(() => {});
}

/**
 * The model, ready to answer. Kept between turns: loading it is a download the
 * first time and a read from the browser's cache after that, and neither is
 * work to do twice.
 */
async function load(
  spec: LocalModel,
  report: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<WllamaInstance> {
  if (held?.id === spec.id) return held.wllama;
  await unloadWllama();

  const module = (await loadWllamaModule()) as WllamaModule;
  const wllama = new module.Wllama({ default: wllamaWasmUrl() });
  try {
    await wllama.loadModelFromUrl(spec.baseUrl, {
      n_ctx: spec.contextWindow,
      // The chat template of the model, parsed as llama-server parses it. Tool
      // calls and the thinking of a reasoning model both come out of it.
      jinja: true,
      reasoning_format: "deepseek",
      progressCallback: ({ loaded, total }: { loaded: number; total: number }) =>
        report(total ? loaded / total : 0),
      signal,
    });
  } catch (error) {
    // A half-built runtime holds a worker and its memory. Neither is wanted.
    await wllama.exit().catch(() => {});
    throw error;
  }

  held = { id: spec.id, wllama };
  return wllama;
}

/** The text of a message, whatever else it carries. */
const textOf = (content: Message["content"]): string =>
  typeof content === "string"
    ? content
    : content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
        .trim();

/** pi's context as the api takes it: the system prompt, then the transcript. */
export function toMessages(context: Context): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (context.systemPrompt) messages.push({ role: "system", content: context.systemPrompt });

  for (const message of context.messages) {
    if (message.role === "toolResult") {
      messages.push({
        role: "tool",
        tool_call_id: message.toolCallId,
        content: textOf(message.content),
      });
      continue;
    }

    if (message.role === "user") {
      messages.push({ role: "user", content: textOf(message.content) });
      continue;
    }

    // Thinking is left out: it belongs to the turn that wrote it.
    const calls = message.content.filter((part) => part.type === "toolCall");
    const content = textOf(message.content);
    if (!content && !calls.length) continue;

    messages.push({
      role: "assistant",
      content,
      ...(calls.length
        ? {
            tool_calls: calls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
            })),
          }
        : {}),
    });
  }

  return messages;
}

const toTools = (context: Context): ChatTool[] =>
  (context.tools ?? []).map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));

/** The arguments as json. A small model writes json that does not parse. */
const toArguments = (args: string): Record<string, any> => {
  try {
    const value = JSON.parse(args);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
};

/**
 * What the turn cost, in either shape llama.cpp says it: the usage of the
 * OpenAI protocol, and the timings the runtime keeps of its own. Both arrive on
 * the last chunk, and a build may send one, the other or neither.
 */
function toCount(chunk: Chunk): { input: number; cacheRead: number; output: number } | undefined {
  if (chunk.usage) {
    // `prompt_tokens` counts the whole prompt, the cached part included.
    const cacheRead = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      input: Math.max(0, (chunk.usage.prompt_tokens ?? 0) - cacheRead),
      cacheRead,
      output: chunk.usage.completion_tokens ?? 0,
    };
  }

  // `prompt_n` is what this turn read, `cache_n` what it kept from the turn
  // before. Together they are the prompt.
  const timings = chunk.timings;
  if (timings?.prompt_n === undefined) return undefined;
  return {
    input: timings.prompt_n,
    cacheRead: timings.cache_n ?? 0,
    output: timings.predicted_n ?? 0,
  };
}

const failure = (error: unknown): string => {
  switch ((error as { type?: string })?.type) {
    case "kv_cache_full":
      return "The conversation is longer than the window this model was loaded with. Start a new chat.";
    case "download_error":
      return "The weights could not be downloaded. Check the connection, then try again.";
    case "load_error":
      return "This device could not load the model. Try a smaller one.";
    default:
      return error instanceof Error ? error.message : String(error);
  }
};

/** One turn, as the events pi's stream is made of. */
async function* run(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AsyncGenerator<AssistantMessageEvent> {
  const output: AssistantMessage = {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "pending",
    timestamp: Date.now(),
  };

  const indexOf = (block: AssistantMessage["content"][number]) => output.content.indexOf(block);

  /** The block being written, so a run of one kind is one block. */
  let open:
    | { kind: "text"; block: TextContent }
    | { kind: "thinking"; block: ThinkingContent }
    | undefined;

  function* close(): Generator<AssistantMessageEvent> {
    if (!open) return;
    const contentIndex = indexOf(open.block);
    if (open.kind === "text") {
      yield { type: "text_end", contentIndex, content: open.block.text, partial: output };
    } else {
      yield { type: "thinking_end", contentIndex, content: open.block.thinking, partial: output };
    }
    open = undefined;
  }

  /** A fragment of the answer, on the channel it arrived on. */
  function* say(kind: "text" | "thinking", delta: string): Generator<AssistantMessageEvent> {
    if (open?.kind !== kind) yield* close();

    if (kind === "text") {
      let block = open?.kind === "text" ? open.block : undefined;
      if (!block) {
        block = { type: "text", text: "" };
        open = { kind, block };
        output.content.push(block);
        yield { type: "text_start", contentIndex: indexOf(block), partial: output };
      }
      block.text += delta;
      yield { type: "text_delta", contentIndex: indexOf(block), delta, partial: output };
      return;
    }

    let block = open?.kind === "thinking" ? open.block : undefined;
    if (!block) {
      block = { type: "thinking", thinking: "" };
      open = { kind, block };
      output.content.push(block);
      yield { type: "thinking_start", contentIndex: indexOf(block), partial: output };
    }
    block.thinking += delta;
    yield { type: "thinking_delta", contentIndex: indexOf(block), delta, partial: output };
  }

  /** One block per streamed tool call, and its arguments as they arrive. */
  const calls = new Map<number, { block: ToolCall; args: string }>();

  try {
    yield { type: "start", partial: output };

    const spec = findLocalModel(model.id);
    if (!spec) throw new Error(`${model.id} is not a model this build carries.`);

    // The loop offers its tools to every model. A chat template with no place
    // for them answers the turn from the chat alone rather than failing it.
    const tools = spec.tools ? toTools(context) : [];
    if (context.tools?.length && !spec.tools) {
      output.diagnostics = [
        {
          type: "unsupported",
          timestamp: Date.now(),
          details: {
            message: `${spec.name} has no tool calls. The turn was answered from the chat alone.`,
            tools: context.tools.map((tool) => tool.name),
          },
        },
      ];
    }

    /** Written by the callback, read on a timer: a callback cannot yield. */
    let fraction = 0;
    const loading = load(spec, (value) => (fraction = value), options?.signal);

    let settled = false;
    const quiet = loading.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    // The weights arrive once and the browser keeps them, but the first turn on
    // a model waits for hundreds of MB. Nothing else in the protocol carries
    // work that is not the answer, so it is told as thinking — which the chat
    // shows and this module never sends back. A model already in memory is
    // ready inside the first tick, and says nothing at all.
    const note: ThinkingContent = { type: "thinking", thinking: "" };
    let told = false;
    let shown = -1;
    while (!settled) {
      await Promise.race([quiet, wait(PROGRESS_MS)]);
      if (settled) break;

      const percent = Math.round(fraction * 100);
      if (told && percent === shown) continue;

      if (!told) {
        told = true;
        output.content.push(note);
        yield { type: "thinking_start", contentIndex: indexOf(note), partial: output };
      }
      const delta =
        shown < 0 ? `Loading ${spec.name}, ${spec.size}. Once.\n${percent}%` : ` ${percent}%`;
      note.thinking += delta;
      shown = percent;
      yield { type: "thinking_delta", contentIndex: indexOf(note), delta, partial: output };
    }
    if (told) {
      const contentIndex = indexOf(note);
      yield { type: "thinking_end", contentIndex, content: note.thinking, partial: output };
    }

    const wllama = await loading;

    const messages = toMessages(context);
    const stream = await wllama.createChatCompletion({
      messages,
      ...(tools.length ? { tools } : {}),
      stream: true,
      // A streamed turn is counted only where it is asked for, which is the
      // protocol. Without this the last chunk carries no usage at all.
      stream_options: { include_usage: true },
      max_tokens: options?.maxTokens ?? model.maxTokens,
      ...(options?.temperature === undefined ? {} : { temperature: options.temperature }),
      // Qwen and the templates that follow it read this; the rest ignore it.
      ...(model.reasoning
        ? { chat_template_kwargs: { enable_thinking: Boolean(options?.reasoning) } }
        : {}),
      abortSignal: options?.signal,
    });

    let finish: string | null | undefined;
    /** Whether the runtime counted the turn, and what was streamed if not. */
    let counted = false;
    let produced = 0;
    for await (const chunk of stream) {
      const count = toCount(chunk);
      if (count) {
        counted = true;
        output.usage.input = count.input;
        output.usage.cacheRead = count.cacheRead;
        output.usage.output = count.output;
        output.usage.totalTokens = count.input + count.cacheRead + count.output;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;
      finish = choice.finish_reason ?? finish;

      if (
        choice.delta?.content ||
        choice.delta?.reasoning_content ||
        choice.delta?.tool_calls?.length
      )
        produced += 1;

      const reasoning = choice.delta?.reasoning_content;
      if (reasoning) yield* say("thinking", reasoning);

      const content = choice.delta?.content;
      if (content) yield* say("text", content);

      for (const part of choice.delta?.tool_calls ?? []) {
        let call = calls.get(part.index);
        if (!call) {
          yield* close();
          const block: ToolCall = {
            type: "toolCall",
            id: part.id || `call_${part.index}`,
            name: part.function?.name ?? "",
            arguments: {},
          };
          call = { block, args: "" };
          calls.set(part.index, call);
          output.content.push(block);
          yield { type: "toolcall_start", contentIndex: indexOf(block), partial: output };
        }
        if (part.id) call.block.id = part.id;
        if (part.function?.name) call.block.name = part.function.name;

        const delta = part.function?.arguments;
        if (!delta) continue;
        call.args += delta;
        yield { type: "toolcall_delta", contentIndex: indexOf(call.block), delta, partial: output };
      }
    }

    yield* close();
    for (const { block, args } of calls.values()) {
      block.arguments = toArguments(args);
      yield {
        type: "toolcall_end",
        contentIndex: indexOf(block),
        toolCall: block,
        partial: output,
      };
    }

    // An estimate, where the runtime counted nothing: one streamed chunk is one
    // token, and four characters is about one. The context meter of a window
    // this small is worth more than an exact zero.
    if (!counted) {
      output.usage.input = Math.ceil(JSON.stringify(messages).length / 4);
      output.usage.output = produced;
      output.usage.totalTokens = output.usage.input + produced;
    }

    const reason = calls.size ? "toolUse" : finish === "length" ? "length" : "stop";
    output.stopReason = reason;
    if (finish) output.rawStopReason = finish;
    yield { type: "done", reason, message: output };
  } catch (error) {
    const aborted = options?.signal?.aborted || (error as { name?: string })?.name === "AbortError";
    output.stopReason = aborted ? "aborted" : "error";
    output.errorMessage = aborted ? "Request was aborted" : failure(error);
    yield { type: "error", reason: output.stopReason, error: output };
  }
}

/**
 * The api's one entry. `streamSimple` is all `streamFor()` asks for, and the
 * options this api reads are the ceiling, the temperature, the thinking level
 * and the signal — there is no key, and no endpoint to send one to.
 */
export const streamSimple = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream => lazyStream(model, async () => run(model, context, options));

export const stream = streamSimple;
