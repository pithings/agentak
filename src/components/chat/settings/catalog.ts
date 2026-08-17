// Docs: @docs/3.widget.md
// What a model id says about itself: which family it belongs to, which release
// it is, and which of them are worth showing before anything is typed. All of
// it is read off the id, because a catalog is sorted as words and as words
// `5.10` reads under `5.2`. See `settings/models.tsx`.
import type { ChatModel } from "../types.ts";

/** Under this many models the field would filter a list already in one view. */
export const SEARCH_FROM = 8;

/** A token that is only a version: `5`, `4`, `v3`, `4o`. */
const VERSION = /^(?:v?\d+|\d+[ac-jln-z])$/;

/** What a version is written on, where it is fused to the name: `qwen3`, `o4`. */
const FUSED = /^([a-z]+?)\d+$/;

/**
 * A date or a build stamp rather than a version: `2024`, `20241022`, and the
 * `2603` of `mistral-small-2603`. Nobody writes a version in four digits, so a
 * run of four, six or eight of them is when a model shipped.
 */
const DATE = /^(?:\d{4}|\d{6}|\d{8})$/;

/** Words a catalog puts on a model that carries no version of its own. */
const NOISE = new Set(["beta", "exp", "experimental", "latest", "preview", "stable"]);

/**
 * The words a vendor names another model with, rather than another release of
 * one. Everything a person would choose between: how big it answers, how hard
 * it thinks, what it was tuned for.
 */
const VARIANT = new Set([
  "air",
  "chat",
  "coder",
  "codex",
  "fast",
  "flash",
  "flex",
  "haiku",
  "instruct",
  "lite",
  "max",
  "medium",
  "mini",
  "nano",
  "opus",
  "plus",
  "pro",
  "reasoner",
  "small",
  "sonnet",
  "thinking",
  "turbo",
  "ultra",
  "vision",
]);

const words = (id: string): string[] =>
  id
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * The family a model belongs to: its id with the release taken out of it, so one
 * row can stand for every generation of the same model.
 *
 * `claude-sonnet-4-5` and `claude-sonnet-5` are one family. `gpt-5` and
 * `gpt-5-mini` are two, because `mini` is another model and not an older one —
 * so a word is kept where it names a variant, or where it carries a number of
 * its own: `70b`, `a3b` and `120b` are what a model is, and `4o` is which
 * release of it this is.
 *
 * A word after the version that names no variant is that release's codename:
 * "GPT 5.6 Luna" is a GPT, so it belongs with GPT 5.5 rather than beside it.
 * A word before the version is always kept, because that is where most vendors
 * write the variant — `mistral-small-3.1`. A name left with nothing is its own
 * family, since a family of everything would collapse the list to one row.
 */
export function family(id: string): string {
  const parts: string[] = [];
  let versioned = false;
  for (const word of words(id)) {
    if (NOISE.has(word)) continue;
    if (VERSION.test(word)) {
      versioned = true;
      continue;
    }
    const fused = FUSED.exec(word);
    if (fused) {
      versioned = true;
      parts.push(fused[1]);
      continue;
    }
    if (versioned && !VARIANT.has(word) && !/\d/.test(word)) continue;
    parts.push(word);
  }
  return parts.join("-") || id.toLowerCase();
}

/**
 * The version a model id carries, as the numbers it is written with: `gpt-5.10`
 * is `[5, 10]`, `claude-sonnet-4-5` is `[4, 5]`, `qwen3` is `[3]`.
 *
 * A date ends the reading, because an id writes the version before the date it
 * shipped on and a date read as a version outranks every version there is:
 * `qwen-plus-2025-07-28` is `[]` and stands under `qwen3.7-plus`.
 */
export function version(id: string): number[] {
  const parts: number[] = [];
  for (const word of words(id)) {
    // Two parts and no more, because nobody writes a third and the numbers after
    // them are the model's size: `qwen3.8-2.4t-a95b` is 3.8, and the 2.4T is how
    // many parameters answer.
    if (parts.length === 2 || DATE.test(word)) break;
    if (VERSION.test(word)) parts.push(Number.parseInt(word.replace(/^v/, ""), 10));
    else if (FUSED.test(word)) parts.push(Number.parseInt(word.replace(/^[a-z]+/, ""), 10));
  }
  return parts;
}

/**
 * How plain a name is: the words of it that are not numbers. The line is named
 * after its plainest model, and everything else is that model with a word added —
 * a size, a codename, a batch endpoint.
 */
function plainness(id: string): number {
  return words(id).filter((word) => !/^\d/.test(word)).length;
}

/**
 * Newest first, part by part, where a part nobody wrote is a zero: 5.6 over 5.5
 * and 5.10 over 5.9, which is the one thing a catalog's own order gets wrong —
 * it is sorted as words, and as words `5.10` reads under `5.2`.
 */
function compare(one: number[], two: number[]): number {
  for (let index = 0; index < Math.max(one.length, two.length); index++) {
    const diff = (two[index] ?? 0) - (one[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * The generations of one model gathered into one run of rows, newest at the head
 * of it.
 *
 * The families keep the order they arrived in, so a catalog that was curated is
 * still read the way it was written; only the rows inside a family move, and
 * they move by version rather than by name. Equal versions keep their order,
 * because `sort` is stable.
 */
export function byFamily(models: ChatModel[]): ChatModel[] {
  const families = new Map<string, ChatModel[]>();
  for (const entry of models) {
    const key = family(entry.id);
    const found = families.get(key);
    if (found) found.push(entry);
    else families.set(key, [entry]);
  }
  return [...families.values()].flatMap((entries) =>
    entries.length > 1 ? entries.sort((a, b) => compare(version(a.id), version(b.id))) : entries,
  );
}

/**
 * The model lines a person asks for by name, one row each before anything is
 * typed. A gateway lists hundreds, and nearly all of them are a name nobody came
 * here for.
 *
 * Each entry is the words that name the line, matched against a family's own
 * words — so it holds however a provider writes the rest of the id, and Claude's
 * four sizes are four entries because they are four things to choose between,
 * where GPT's minis and codexes are one line to pick the newest of. Nothing is
 * lost by a name missing from here: the search reads the whole catalog, and so
 * does the button under the list.
 */
const LINES = [
  ["claude", "opus"],
  ["claude", "sonnet"],
  ["claude", "haiku"],
  ["claude", "fable"],
  ["gpt"],
  ["gemini"],
  ["grok"],
  ["qwen"],
  ["deepseek"],
  ["kimi"],
  ["glm"],
  ["llama"],
  ["mistral"],
  ["minimax"],
  ["gemma"],
];

/**
 * The newest model of each well-known line, or nothing where holding the rest
 * back would not help.
 *
 * A catalog short enough to read is read as it is — a provider offering eight
 * models is not a catalog to be recommended from. And a list where these names
 * are the exception, as the free providers' are, keeps every row: a short list of
 * models nobody has heard of is still the whole of what that provider has.
 *
 * Of one line's models the newest wins, and of two the same age the plainer one —
 * fewest words in its family — because that is the model the line is named after
 * rather than a variant of it. The rows come back in the list's own order, so
 * opening the rest adds rows and moves none.
 */
export function wellKnown(models: ChatModel[], running?: string): ChatModel[] | undefined {
  if (models.length <= SEARCH_FROM) return undefined;

  const read = models.map((entry) => ({
    entry,
    parts: family(entry.id).split("-"),
    plain: plainness(entry.id),
    version: version(entry.id),
  }));
  const picks = new Set<ChatModel>();
  for (const line of LINES) {
    let best: (typeof read)[number] | undefined;
    for (const model of read) {
      if (!line.every((word) => model.parts.includes(word))) continue;
      if (!best) {
        best = model;
        continue;
      }
      const order = compare(best.version, model.version);
      if (order > 0 || (order === 0 && model.plain < best.plain)) best = model;
    }
    if (best) picks.add(best.entry);
  }

  // Two rows is not a list to choose from — the whole of what is loaded is a
  // better answer than a page holding one name back.
  if (picks.size < 3) return undefined;
  return models.filter((entry) => picks.has(entry) || entry.id === running);
}

/**
 * The newest of each family, of a list already grouped — so the newest is
 * whichever came first.
 *
 * Every model of that same version comes with it, because a release under three
 * names is three models and not two older ones: GPT 5.6 Luna, Sol and Terra are
 * all rows, and GPT 5.5 is what goes behind the button. The model running is
 * kept whatever its version, because a list that hides it hides the tick with
 * it, and the page would then name a model in the bar that it says nothing
 * about here.
 */
export function latest(models: ChatModel[], running?: string): ChatModel[] {
  const heads = new Map<string, number[]>();
  return models.filter((entry) => {
    const key = family(entry.id);
    const head = heads.get(key);
    if (!head) {
      heads.set(key, version(entry.id));
      return true;
    }
    return compare(head, version(entry.id)) === 0 || entry.id === running;
  });
}
