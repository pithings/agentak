// Docs: @docs/4.agents/2.pi-agent/3.on-device-models.md
/**
 * The `chrome-prompt` api: Chrome's Prompt API, spoken the way pi speaks to a
 * provider. Loaded only when Gemini Nano is the model, like every other api
 * module in `providers.ts`.
 *
 * The api takes the history up front through `initialPrompts` and the turn it
 * must answer through one `prompt()` call, so pi's messages are split at the
 * last one. A session is built per turn and destroyed after it: pi's transcript
 * is what the conversation is, and it can be edited or restored between turns.
 *
 * What Gemini Nano does not do, and this module therefore does not offer:
 * tool calls, images, thinking, and a cap on the answer. A turn that carries
 * tools is answered from the chat alone and says so in `diagnostics`.
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
} from "@earendil-works/pi-ai";

import {
  type PromptApi,
  type PromptCreateOptions,
  type PromptSession,
  promptApi,
  type PromptTurn,
} from "./on-device.ts";

/** Chrome's own default. Sent only to complete the pair a temperature needs. */
const DEFAULT_TOP_K = 3;

/** How often the download is asked how far it has come. */
const PROGRESS_MS = 500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The text of a message, whatever else it carries. */
const textOf = (content: Message["content"]): string =>
  typeof content === "string"
    ? content
    : content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
        .trim();

/** A message the model must read as something a person said. */
const asUser = (message: Message): string =>
  message.role === "toolResult"
    ? `Result of ${message.toolName}:\n${textOf(message.content)}`
    : textOf(message.content);

/**
 * pi's context as the api takes it: the system prompt and the history up front,
 * then the one turn to answer.
 *
 * Runs of the same role are merged and empty turns are dropped — a transcript
 * restored from a session that had tools carries turns this api has no place
 * for, and it takes an alternating history.
 */
export function toTurns(context: Context): { initialPrompts: PromptTurn[]; prompt: string } {
  const history = [...context.messages];
  const answering = history.pop();
  const prompt = answering && answering.role !== "assistant" ? asUser(answering) : "";
  if (!prompt) throw new Error("The last message must be the one to answer.");

  const initialPrompts: PromptTurn[] = [];

  const say = (role: PromptTurn["role"], content: string) => {
    if (!content) return;
    const last = initialPrompts.at(-1);
    if (last?.role === role) last.content += `\n\n${content}`;
    else initialPrompts.push({ role, content });
  };

  if (context.systemPrompt) {
    initialPrompts.push({ role: "system", content: context.systemPrompt });
  }
  for (const message of history) {
    say(message.role === "assistant" ? "assistant" : "user", asUser(message));
  }

  return { initialPrompts, prompt };
}

/**
 * A session for this turn. The sampling pair is tried first because either both
 * go or neither does, and Chrome rejects them outright outside an origin trial
 * or an extension — a default session answers where a failed turn would not.
 */
async function open(
  api: PromptApi,
  base: PromptCreateOptions,
  temperature?: number,
): Promise<PromptSession> {
  if (temperature === undefined) return api.create(base);
  try {
    return await api.create({ ...base, temperature, topK: DEFAULT_TOP_K });
  } catch {
    return api.create(base);
  }
}

/** Whichever name this build gives the tokens the session holds. */
const used = (session: PromptSession): number => session.inputUsage ?? session.contextUsage ?? 0;

/** A `ReadableStream` in some builds, an async iterable in others. */
async function* chunks(
  stream: ReadableStream<string> | AsyncIterable<string>,
): AsyncGenerator<string> {
  const iterable = stream as Partial<AsyncIterable<string>>;
  if (typeof iterable[Symbol.asyncIterator] === "function") {
    yield* iterable as AsyncIterable<string>;
    return;
  }
  const reader = (stream as ReadableStream<string>).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

const failure = (error: unknown): string => {
  const name = (error as { name?: string })?.name;
  if (name === "QuotaExceededError") {
    return "The conversation is too long for Gemini Nano. Start a new chat.";
  }
  return error instanceof Error ? error.message : String(error);
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

  // The loop offers its tools to every model. This one has no way to call them,
  // and the turn is answered without them rather than failed.
  if (context.tools?.length) {
    output.diagnostics = [
      {
        type: "unsupported",
        timestamp: Date.now(),
        details: {
          message: "Gemini Nano has no tool calls. The turn was answered from the chat alone.",
          tools: context.tools.map((tool) => tool.name),
        },
      },
    ];
  }

  let session: PromptSession | undefined;
  try {
    yield { type: "start", partial: output };

    const api = promptApi();
    if (!api) throw new Error("This browser has no built-in AI. Select another provider.");

    const availability = await api.availability();
    if (availability === "unavailable") {
      throw new Error(
        "Chrome cannot run Gemini Nano on this device. Select another provider, or see chrome://on-device-internals.",
      );
    }

    const { initialPrompts, prompt } = toTurns(context);

    /** Written by the monitor, read on a timer: a callback cannot yield. */
    let loaded = 0;
    const base: PromptCreateOptions = {
      monitor: (monitor) => {
        monitor.addEventListener("downloadprogress", (event) => {
          loaded = event.loaded;
        });
      },
      ...(initialPrompts.length ? { initialPrompts } : {}),
      ...(options?.signal ? { signal: options.signal } : {}),
    };

    const opening = open(api, base, options?.temperature);
    let settled = false;
    const quiet = opening.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    // The weights are ~4 GB and arrive once, on the first `create()`. Nothing
    // else in the protocol carries work that is not the answer, so it is told
    // as thinking — which the chat shows and this module never sends back.
    if (availability !== "available") {
      const note: ThinkingContent = { type: "thinking", thinking: "" };
      const index = output.content.push(note) - 1;
      yield { type: "thinking_start", contentIndex: index, partial: output };

      let shown = -1;
      while (!settled) {
        const percent = Math.round(loaded * 100);
        if (percent !== shown) {
          const delta =
            shown < 0 ? `Downloading Gemini Nano, about 4 GB. Once.\n${percent}%` : ` ${percent}%`;
          note.thinking += delta;
          shown = percent;
          yield { type: "thinking_delta", contentIndex: index, delta, partial: output };
        }
        await Promise.race([quiet, wait(PROGRESS_MS)]);
      }

      yield { type: "thinking_end", contentIndex: index, content: note.thinking, partial: output };
    }

    session = await opening;
    const before = used(session);

    const block: TextContent = { type: "text", text: "" };
    const index = output.content.push(block) - 1;
    yield { type: "text_start", contentIndex: index, partial: output };

    const stream = session.promptStreaming(prompt, { signal: options?.signal });
    for await (const delta of chunks(stream)) {
      block.text += delta;
      yield { type: "text_delta", contentIndex: index, delta, partial: output };
    }

    yield { type: "text_end", contentIndex: index, content: block.text, partial: output };

    // An estimate: the count is the session's own, not Gemini Nano's tokenizer.
    const after = used(session);
    output.usage.input = before;
    output.usage.output = Math.max(0, after - before);
    output.usage.totalTokens = after;
    output.stopReason = "stop";
    yield { type: "done", reason: "stop", message: output };
  } catch (error) {
    const aborted = options?.signal?.aborted || (error as { name?: string })?.name === "AbortError";
    output.stopReason = aborted ? "aborted" : "error";
    output.errorMessage = aborted ? "Request was aborted" : failure(error);
    yield { type: "error", reason: output.stopReason, error: output };
  } finally {
    session?.destroy();
  }
}

/**
 * The api's one entry. `streamSimple` is all `streamFor()` asks for, and the
 * options this api reads are the temperature and the signal — there is no key,
 * no thinking level and no token ceiling to send.
 */
export const streamSimple = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
): AssistantMessageEventStream => lazyStream(model, async () => run(model, context, options));

export const stream = streamSimple;
