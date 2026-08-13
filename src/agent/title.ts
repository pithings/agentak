import type { StreamFn } from "@earendil-works/pi-agent-core";
import { useEffect, useRef, useState } from "preact/hooks";

import type { AnyModel } from "@/agent/providers";
import { streamFor } from "@/agent/providers";
import type { ViewMessage } from "@/types";

/** How long a title runs before it is cut. */
const MAX_CHARS = 48;

/** How much of a turn the model is given to name the conversation. */
const SEED_CHARS = 400;

const NAMING_PROMPT = [
  "You name conversations.",
  "Answer with a title of at most six words for the exchange below.",
  "Use no quotation marks and no final period.",
  "Answer with the title alone.",
].join(" ");

/** Cut on a word, so a long line ends on an ellipsis and not half a word. */
const cut = (text: string, max: number): string => {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const space = head.lastIndexOf(" ");
  return `${(space > max * 0.6 ? head.slice(0, space) : head).trimEnd()}…`;
};

const clean = (text: string): string =>
  text
    .trim()
    .split("\n")[0]
    .replace(/\s+/g, " ")
    .replace(/^["'“”«]+|["'“”»]+$/g, "")
    .replace(/[.。]$/, "")
    .trim();

const textOf = (message: ViewMessage | undefined): string =>
  message?.parts
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join(" ")
    .trim() ?? "";

/**
 * The conversation's title, from the first thing asked.
 *
 * It costs nothing — the text is already in hand — so this is what the header
 * shows from the first message on, and what a generated title replaces.
 */
export function toTitle(messages: ViewMessage[]): string | undefined {
  const text = clean(textOf(messages.find((message) => message.role === "user")));
  return text ? cut(text, MAX_CHARS) : undefined;
}

export interface GenerateTitleOptions {
  model: AnyModel;
  /** The exchange to name. */
  seed: string;
  apiKey?: string;
  signal?: AbortSignal;
  /** A scripted provider under test. Default: the api the model names. */
  streamFn?: StreamFn;
}

/**
 * One extra request that asks the model to name the conversation.
 *
 * It runs outside the agent loop, so the transcript never carries the question
 * or the answer. A failure is not the caller's to show — a title nobody asked
 * for must not put an error on the chat — so this answers `undefined` and the
 * first-message title stands.
 */
export async function generateTitle({
  model,
  seed,
  apiKey,
  signal,
  streamFn = streamFor,
}: GenerateTitleOptions): Promise<string | undefined> {
  try {
    const stream = await streamFn(
      model,
      {
        systemPrompt: NAMING_PROMPT,
        messages: [
          { role: "user", content: [{ type: "text", text: seed }], timestamp: Date.now() },
        ],
      },
      // A title is not worth a thinking budget; `minimal` is the least a
      // reasoning model takes.
      { apiKey, maxTokens: 64, reasoning: "minimal", signal, temperature: 0 },
    );
    const message = await stream.result();
    if (message.errorMessage) return undefined;
    const title = clean(
      message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(" "),
    );
    return title ? cut(title, MAX_CHARS) : undefined;
  } catch {
    return undefined; // the derived title stands
  }
}

export interface TitleOptions {
  messages: ViewMessage[];
  /** Off by default: a title costs a request, so a host opts in. */
  generate?: boolean;
  /** The model to ask. Without one, only the derived title shows. */
  model?: AnyModel;
  apiKey?: string;
  /** Nothing is asked while the loop is busy — one request at a time. */
  isStreaming?: boolean;
  streamFn?: StreamFn;
}

/**
 * The title the header shows: the first message, or what the model named the
 * conversation when a host opted in.
 *
 * The model is asked once, after the first answer lands and the loop is idle:
 * the free providers meter requests by the minute, so a title never competes
 * with the turn it names. The derived title is the key — a reset, or a first
 * message that changes, asks again; anything later in the conversation does not.
 */
export function useTitle({
  messages,
  generate,
  model,
  apiKey,
  isStreaming,
  streamFn,
}: TitleOptions): string | undefined {
  const derived = toTitle(messages);
  const [generated, setGenerated] = useState<{ for: string; title: string } | undefined>(undefined);
  // What was asked already, so a re-render does not ask twice.
  const asked = useRef<string | undefined>(undefined);

  const question = textOf(messages.find((message) => message.role === "user"));
  // The first answer that says anything: a first turn can be tool calls alone.
  const answer =
    messages
      .filter((message) => message.role === "assistant")
      .map(textOf)
      .find(Boolean) ?? "";

  useEffect(() => {
    if (!generate || !model || !derived || !answer || isStreaming) return;
    if (asked.current === derived) return;
    asked.current = derived;

    const controller = new AbortController();
    void generateTitle({
      apiKey,
      model,
      seed: `${cut(question, SEED_CHARS)}\n\n${cut(answer, SEED_CHARS)}`,
      signal: controller.signal,
      streamFn,
    }).then((title) => {
      if (title && !controller.signal.aborted) setGenerated({ for: derived, title });
    });

    return () => controller.abort();
  }, [answer, apiKey, derived, generate, isStreaming, model, question, streamFn]);

  return generated && generated.for === derived ? generated.title : derived;
}
