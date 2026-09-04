// Docs: @docs/4.agents/2.pi/3.on-device-models.md
/**
 * The tool language `chrome-prompt` and Gemini Nano share.
 *
 * Chrome's Prompt API carries no tools of its own: a session takes text and
 * answers with text. Gemini brings a language for them anyway, and is trained
 * on it — the tools are Python declarations in the prompt, and a call is
 * `print(default_api.name(argument="value"))` inside a ```tool_code block.
 * A prompt that names tools brings it out of the model whatever else the prompt
 * says, so this module writes that half of the prompt and reads the calls back
 * out of the answer.
 *
 * Nothing here runs anything. A call read here becomes a `toolCall` in the
 * message, and pi's loop is what runs it and brings the result back.
 */

import type { Tool } from "@earendil-works/pi-ai";

/** A schema, as far as a declaration and an argument need to read one. */
interface Schema {
  type?: string;
  description?: string;
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
}

/** A JSON-schema type under the name Python gives it. */
const PY_TYPES: Record<string, string> = {
  string: "str",
  number: "float",
  integer: "int",
  boolean: "bool",
  array: "list",
  object: "dict",
};

/** The fence a call is written in, and the one the model invents a result in. */
const CALL_TAGS = ["tool_code", "tool_call"];
const RESULT_TAGS = ["tool_outputs", "tool_output"];

/** The line that opens either, with the tag it opened. */
const OPENER = new RegExp(`^[ \t]*\`\`\`[ \t]*(${[...CALL_TAGS, ...RESULT_TAGS].join("|")})\\b`);

/** The line that closes a fence, whatever the fence held. */
const CLOSER = /^[ \t]*```/;

/** The head of a call. Both wrappers are the model's habit, and both optional. */
const HEAD =
  /^[ \t]*(?:print[ \t]*\([ \t]*)?(?:default_api[ \t]*\.[ \t]*)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*\(/;

/** What a call has to start with, before it can be one. */
const CALL_STARTS = ["print(", "default_api."];

/**
 * How the call is made. It sits above the declarations, in the system turn,
 * because the model reads the rule and the tools as one thing.
 */
const HOW = [
  "You can call a tool. To call one, write the block and nothing else:",
  "",
  "```tool_code",
  'print(default_api.tool_name(argument="value"))',
  "```",
  "",
  "Then stop. The call runs here, and its result comes back to you as the next message, which starts with `Result of`. Answer from that result.",
  "Call one tool at a time, and only a tool declared below. Write every argument by name, strings in double quotes, and leave out the ones you do not need.",
  "Never write the result of a call yourself, and never write a block for anything else. Where no tool is needed, answer in plain words and write no block.",
  "",
  "These are the tools you can call:",
  "",
];

/** One tool, as the declaration the model is trained to read. */
function declare(tool: Tool): string {
  const schema = (tool.parameters ?? {}) as Schema;
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  const args = Object.entries(properties).map(([name, spec]) => {
    const type = PY_TYPES[String(spec?.type)] ?? "str";
    return required.has(name) ? `${name}: ${type}` : `${name}: ${type} = None`;
  });

  // What each argument is for, inside the one docstring: a line the model reads
  // in the same breath as the name it belongs to.
  const notes = Object.entries(properties)
    .map(([name, spec]) => {
      const about = [
        spec?.description,
        spec?.enum?.length ? `one of ${spec.enum.map((value) => String(value)).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(". ");
      return about ? `    ${name}: ${about}` : "";
    })
    .filter(Boolean);

  const doc = notes.length
    ? [`    """${tool.description}`, ...notes, `    """`]
    : [`    """${tool.description}"""`];

  return [`def ${tool.name}(${args.join(", ")}):`, ...doc].join("\n");
}

/** The tools, and how to call them, as the end of the system turn. */
export const toolGuide = (tools: Tool[]): string =>
  [...HOW, tools.map(declare).join("\n\n")].join("\n");

/** A value as Python writes it, for a call written back into the history. */
const pyValue = (value: unknown): string => {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (Array.isArray(value)) return `[${value.map(pyValue).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return `{${entries.map(([key, item]) => `"${key}": ${pyValue(item)}`).join(", ")}}`;
  }
  return JSON.stringify(value);
};

/**
 * A call the model already made, written the way it wrote it. The history goes
 * back as text, so a turn that called a tool has to read as one.
 */
export const renderCall = (call: { name: string; arguments?: Record<string, unknown> }): string => {
  const args = Object.entries(call.arguments ?? {}).map(
    ([name, value]) => `${name}=${pyValue(value)}`,
  );
  return ["```tool_code", `print(default_api.${call.name}(${args.join(", ")}))`, "```"].join("\n");
};

export interface ParsedCall {
  name: string;
  arguments: Record<string, unknown>;
}

const skip = (text: string, at: number): number => {
  let index = at;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  return index;
};

interface Read {
  value: unknown;
  next: number;
}

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r" };

function readString(text: string, at: number): Read | undefined {
  const quote = text[at];
  let value = "";
  for (let index = at + 1; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\") {
      const escaped = text[index + 1] ?? "";
      value += ESCAPES[escaped] ?? escaped;
      index += 1;
      continue;
    }
    if (char === quote) return { value, next: index + 1 };
    value += char;
  }
  return undefined;
}

/** A word the model left unquoted: a number, a keyword, or a string after all. */
const literal = (word: string): unknown => {
  if (word === "True" || word === "true") return true;
  if (word === "False" || word === "false") return false;
  if (word === "None" || word === "null") return null;
  const number = Number(word);
  return word.trim() !== "" && Number.isFinite(number) ? number : word;
};

function readList(text: string, at: number, close: string): Read | undefined {
  const values: unknown[] = [];
  let index = at + 1;
  for (;;) {
    index = skip(text, index);
    if (index >= text.length) return undefined;
    if (text[index] === close) return { value: values, next: index + 1 };
    const item = readValue(text, index);
    if (!item) return undefined;
    values.push(item.value);
    index = skip(text, item.next);
    if (text[index] === ",") index += 1;
  }
}

function readDict(text: string, at: number): Read | undefined {
  const value: Record<string, unknown> = {};
  let index = at + 1;
  for (;;) {
    index = skip(text, index);
    if (index >= text.length) return undefined;
    if (text[index] === "}") return { value, next: index + 1 };

    // A key is a string or a bare word: it never runs to the comma the way a
    // value does, because the colon after it ends it.
    const quoted = text[index] === '"' || text[index] === "'";
    const key = quoted ? readString(text, index) : readWord(text, index, /^[A-Za-z_][A-Za-z0-9_]*/);
    if (!key) return undefined;
    index = skip(text, key.next);
    if (text[index] !== ":") return undefined;

    const item = readValue(text, index + 1);
    if (!item) return undefined;
    value[String(key.value)] = item.value;
    index = skip(text, item.next);
    if (text[index] === ",") index += 1;
  }
}

function readWord(text: string, at: number, shape: RegExp): Read | undefined {
  const word = shape.exec(text.slice(at))?.[0];
  if (!word) return undefined;
  return { value: word, next: at + word.length };
}

function readValue(text: string, at: number): Read | undefined {
  const start = skip(text, at);
  const char = text[start];
  if (char === undefined) return undefined;
  if (char === '"' || char === "'") return readString(text, start);
  if (char === "[") return readList(text, start, "]");
  if (char === "(") return readList(text, start, ")");
  if (char === "{") return readDict(text, start);

  const word = readWord(text, start, /^[^,)\]}]*/);
  if (!word || !String(word.value).trim()) return undefined;
  return { value: literal(String(word.value).trim()), next: word.next };
}

const KEY = /^([A-Za-z_][A-Za-z0-9_]*)[ \t]*=(?!=)/;

/** The arguments between the brackets: by name where the model named them. */
function readArguments(
  text: string,
  at: number,
): { named: Record<string, unknown>; loose: unknown[] } | undefined {
  const named: Record<string, unknown> = {};
  const loose: unknown[] = [];
  let index = at;

  for (;;) {
    index = skip(text, index);
    if (index >= text.length) return undefined;
    if (text[index] === ")") return { named, loose };

    const key = KEY.exec(text.slice(index));
    if (key) index += key[0].length;

    const value = readValue(text, index);
    if (!value) return undefined;
    if (key) named[key[1]] = value.value;
    else loose.push(value.value);

    index = skip(text, value.next);
    if (text[index] === ",") index += 1;
  }
}

/** A number the model wrote as a string, and the like. */
const coerce = (type: string | undefined, value: unknown): unknown => {
  if (typeof value !== "string") return value;
  if (type === "number" || type === "integer") {
    const number = Number(value);
    return value.trim() !== "" && Number.isFinite(number) ? number : value;
  }
  if (type === "boolean") {
    if (value === "true" || value === "True") return true;
    if (value === "false" || value === "False") return false;
  }
  return value;
};

/** The arguments as the tool declares them: named, in its own types. */
function shape(
  tool: Tool,
  named: Record<string, unknown>,
  loose: unknown[],
): Record<string, unknown> {
  const schema = (tool.parameters ?? {}) as Schema;
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];
  const order = [
    ...required,
    ...Object.keys(properties).filter((name) => !required.includes(name)),
  ];

  const args: Record<string, unknown> = { ...named };
  // A model that wrote its arguments in order and left the names out.
  for (const value of loose) {
    const next = order.find((name) => !(name in args));
    if (!next) break;
    args[next] = value;
  }

  for (const [name, value] of Object.entries(args)) {
    // `None` for an argument it does not need is the model saying nothing.
    if (value === null && !required.includes(name)) delete args[name];
    else args[name] = coerce(properties[name]?.type, value);
  }
  return args;
}

/**
 * One call, read out of the text the model wrote. A call to a tool this turn
 * does not carry is not a call: the model invented it, and the answer is better
 * without it.
 */
export function parseCall(source: string, tools: Tool[]): ParsedCall | undefined {
  const text = source.trim();
  const head = HEAD.exec(text);
  if (!head) return undefined;

  const tool = tools.find((entry) => entry.name === head[1]);
  if (!tool) return undefined;

  const read = readArguments(text, head[0].length);
  if (!read) return undefined;

  return { name: tool.name, arguments: shape(tool, read.named, read.loose) };
}

export type Piece = { type: "text"; text: string } | { type: "call"; call: ParsedCall };

/**
 * Whether a line which is not finished yet may still turn out to be a call. It
 * is held back until the line ends and the answer is known; anything else goes
 * out as it arrives, so an answer still streams a word at a time.
 */
const undecided = (text: string, names: string[]): boolean => {
  const line = text.replace(/^[ \t]+/, "");
  if (/^`{1,3}[ \t]*[a-z_]*$/.test(line)) return true;
  return [...CALL_STARTS, ...names].some(
    (start) => start.startsWith(line) || line.startsWith(start),
  );
};

/**
 * The answer, as the text and the one call it is made of.
 *
 * The turn ends at the call: what a small model writes after one is the result
 * it wishes it had, and the loop is about to bring the real one. A block that
 * holds no call the turn carries — an invented result, a tool that is not
 * there — is dropped, and `report.dropped` says so.
 */
export async function* readAnswer(
  source: AsyncIterable<string>,
  tools: Tool[] = [],
  report: { dropped: boolean } = { dropped: false },
): AsyncGenerator<Piece> {
  const names = tools.map((tool) => tool.name);
  let buffer = "";
  /** The fenced block being read, if it is one of the model's tool blocks. */
  let block: { tag: string; body: string } | undefined;
  /** Inside a fence of the model's own: code for the reader, left alone. */
  let fenced = false;
  /** The current line is already part way out, so the rest of it follows. */
  let sent = false;
  /** Nothing follows the call, so the scan stops where one is read. */
  let done = false;

  /** A call, if the text holds one. The block or the line goes either way. */
  function* take(text: string): Generator<Piece> {
    const call = parseCall(text, tools);
    if (!call) {
      report.dropped = true;
      return;
    }
    done = true;
    yield { type: "call", call };
  }

  function* scan(end: boolean): Generator<Piece> {
    while (!done) {
      const brk = buffer.indexOf("\n");
      const line = brk < 0 ? buffer : buffer.slice(0, brk + 1);

      if (block) {
        // The last line of a stream carries no newline of its own, so the end
        // is where a fence closed on it counts.
        if (brk < 0 && !end) return;
        buffer = buffer.slice(line.length);

        if (!CLOSER.test(line)) {
          if (!end) {
            block.body += line;
            continue;
          }
          // A block the model never closed: a call it stopped in the middle of.
          report.dropped = true;
          block = undefined;
          return;
        }

        if (CALL_TAGS.includes(block.tag)) yield* take(block.body);
        else report.dropped = true;
        block = undefined;
        continue;
      }

      if (brk < 0 && !end) {
        if (!sent && undecided(buffer, names)) return;
        if (buffer) {
          sent = true;
          yield { type: "text", text: buffer };
          buffer = "";
        }
        return;
      }

      if (!sent) {
        const opened = OPENER.exec(line);
        if (opened) {
          buffer = buffer.slice(line.length);
          block = { tag: opened[1], body: "" };
          continue;
        }
        // A call the model wrote in the open, without a fence around it.
        if (!fenced && HEAD.test(line) && names.some((name) => line.includes(name))) {
          buffer = buffer.slice(line.length);
          yield* take(line);
          continue;
        }
        if (brk >= 0 && CLOSER.test(line)) fenced = !fenced;
      }

      yield { type: "text", text: line };
      buffer = buffer.slice(line.length);
      sent = brk < 0;
      if (brk < 0) return;
      sent = false;
    }
  }

  for await (const chunk of source) {
    buffer += chunk;
    for (const piece of scan(false)) if (piece.type === "call" || piece.text) yield piece;
    if (done) return;
  }
  for (const piece of scan(true)) if (piece.type === "call" || piece.text) yield piece;
}
