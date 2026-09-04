// Docs: @docs/4.agents/2.pi/3.on-device-models.md
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
 * Tools are the one thing the api does not carry and this module adds. Gemini
 * is trained on a Python language for them, so the tools go into the system
 * turn as declarations and a call comes back as text, which `chrome-tools.ts`
 * writes and reads. What the model calls, pi's loop runs.
 *
 * What Gemini Nano does not do, and this module therefore does not offer:
 * images, thinking, and a cap on the answer.
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

import {
  type PromptApi,
  type PromptCreateOptions,
  type PromptSession,
  promptApi,
  type PromptTurn,
} from "./on-device.ts";
import { readAnswer, renderCall, toolGuide } from "./chrome-tools.ts";
import { progressMarker } from "../../lib/progress.ts";

/** Chrome's own default. Sent only to complete the pair a temperature needs. */
const DEFAULT_TOP_K = 3;

/** What is said where the whole answer was a call that could not be read. */
const NO_ANSWER = "I could not make that call. Ask me again, in other words.";

/** How often the download is asked how far it has come. */
const PROGRESS_MS = 500;

/** The bar the download draws — one id, so every tick updates the same one. */
const DOWNLOADING = "model-download";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The text of a message, whatever else it carries. */
const textOf = (content: Message["content"]): string =>
  typeof content === "string"
    ? content
    : content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("")
        .trim();

/**
 * A message as the one turn of text this api takes.
 *
 * A tool result is what a person says next, in the words the system turn told
 * the model to expect. A call the model made is written back the way it wrote
 * it, so a history that used a tool still reads as one conversation.
 */
const asTurn = (message: Message): string => {
  if (message.role === "toolResult") {
    return `Result of ${message.toolName}:\n${textOf(message.content)}`;
  }
  if (message.role !== "assistant") return textOf(message.content);

  const calls = Array.isArray(message.content)
    ? message.content.filter((part) => part.type === "toolCall").map(renderCall)
    : [];
  return [textOf(message.content), ...calls].filter(Boolean).join("\n\n");
};

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
  const prompt = answering && answering.role !== "assistant" ? asTurn(answering) : "";
  if (!prompt) throw new Error("The last message must be the one to answer.");

  const initialPrompts: PromptTurn[] = [];

  const say = (role: PromptTurn["role"], content: string) => {
    if (!content) return;
    const last = initialPrompts.at(-1);
    if (last?.role === role) last.content += `\n\n${content}`;
    else initialPrompts.push({ role, content });
  };

  // `system` may only be the first turn, so the tools are the end of that one
  // turn — after the host's own prompt, which is what they serve.
  const system = [context.systemPrompt, context.tools?.length ? toolGuide(context.tools) : ""]
    .filter(Boolean)
    .join("\n\n");
  if (system) initialPrompts.push({ role: "system", content: system });
  for (const message of history) {
    say(message.role === "assistant" ? "assistant" : "user", asTurn(message));
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
    //
    // A stream only appends, so the download is a marker per tick and the chat
    // draws one bar — see `lib/progress.ts`. The label is written once; the
    // ticks after it carry the reading alone.
    if (availability !== "available") {
      const note: ThinkingContent = { type: "thinking", thinking: "" };
      const index = output.content.push(note) - 1;
      yield { type: "thinking_start", contentIndex: index, partial: output };

      let shown = -1;
      const tell = function* (percent: number) {
        const first = shown < 0;
        const marker = progressMarker(
          first
            ? {
                id: DOWNLOADING,
                value: percent,
                label: "Downloading Gemini Nano, about 4 GB. Once.",
              }
            : { id: DOWNLOADING, value: percent },
        );
        const delta = first ? marker : `\n${marker}`;
        note.thinking += delta;
        shown = percent;
        yield { type: "thinking_delta" as const, contentIndex: index, delta, partial: output };
      };

      while (!settled) {
        const percent = Math.round(loaded * 100);
        if (percent !== shown) yield* tell(percent);
        await Promise.race([quiet, wait(PROGRESS_MS)]);
      }
      // The last tick a timer saw was short of the end. The bar rests full —
      // unless nothing was ever told, and there is no bar to fill.
      if (shown >= 0 && shown < 100) yield* tell(100);

      yield { type: "thinking_end", contentIndex: index, content: note.thinking, partial: output };
    }

    session = await opening;
    const before = used(session);

    /** The text block being written, where the answer is in the middle of one. */
    let block: TextContent | undefined;
    let index = -1;
    const close = function* () {
      if (!block) return;
      yield {
        type: "text_end" as const,
        contentIndex: index,
        content: block.text,
        partial: output,
      };
      block = undefined;
    };

    let called: ToolCall | undefined;
    const report = { dropped: false };
    const stream = session.promptStreaming(prompt, { signal: options?.signal });

    for await (const piece of readAnswer(chunks(stream), context.tools ?? [], report)) {
      if (piece.type === "text") {
        if (!block) {
          block = { type: "text", text: "" };
          index = output.content.push(block) - 1;
          yield { type: "text_start", contentIndex: index, partial: output };
        }
        block.text += piece.text;
        yield { type: "text_delta", contentIndex: index, delta: piece.text, partial: output };
        continue;
      }

      yield* close();
      called = {
        type: "toolCall",
        id: `nano_${Date.now().toString(36)}_${output.content.length}`,
        name: piece.call.name,
        arguments: piece.call.arguments,
      };
      const at = output.content.push(called) - 1;
      const delta = JSON.stringify(called.arguments);
      yield { type: "toolcall_start", contentIndex: at, partial: output };
      yield { type: "toolcall_delta", contentIndex: at, delta, partial: output };
      yield { type: "toolcall_end", contentIndex: at, toolCall: called, partial: output };
    }

    // A block that held no call the turn carries was taken out. Where it was
    // the whole answer, the turn ends on a line rather than an empty bubble.
    if (report.dropped && !called && !block?.text.trim()) {
      if (!block) {
        block = { type: "text", text: "" };
        index = output.content.push(block) - 1;
        yield { type: "text_start", contentIndex: index, partial: output };
      }
      block.text += NO_ANSWER;
      yield { type: "text_delta", contentIndex: index, delta: NO_ANSWER, partial: output };
    }
    yield* close();

    if (report.dropped) {
      output.diagnostics = [
        {
          type: "unsupported",
          timestamp: Date.now(),
          details: {
            message: "A block the model wrote was not a call this turn carries, and was left out.",
            tools: context.tools?.map((tool) => tool.name) ?? [],
          },
        },
      ];
    }

    // An estimate: the count is the session's own, not Gemini Nano's tokenizer.
    const after = used(session);
    output.usage.input = before;
    output.usage.output = Math.max(0, after - before);
    output.usage.totalTokens = after;
    const reason = called ? "toolUse" : "stop";
    output.stopReason = reason;
    yield { type: "done", reason, message: output };
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
