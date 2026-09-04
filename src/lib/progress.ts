// Docs: @docs/3.widget.md
/**
 * `::progress{…}` — a progress bar written into the words of a turn.
 *
 * A provider streams text; a bar is not text. The marker is the way across:
 * the provider writes one line, `toViewMessages()` reads it back out as an
 * `{ kind: "element", name: "progress" }` part, and the reader sees a bar
 * instead of a trail of percentages. Nothing else in the stream protocol
 * carries work that is not the answer.
 *
 * ```
 * ::progress{id="model-load" value="42" label="Loading Granite 4.1 3B"}
 * ```
 *
 * The line is the whole marker: attributes are `key=value`, quoted or bare,
 * and the closing brace ends it. A marker owns its line so ordinary prose
 * cannot open one by accident.
 *
 * The same `id` written again is the same bar, updated in place — a stream
 * only ever appends, so a growing download is many markers and one bar. Only
 * the fields it names change; the label of the first survives the ones after
 * it. An unnamed `id` is `""`, which is one bar per turn.
 */

export interface ProgressProps {
  /** Where the bar stands, out of `max`. Omitted, the bar is indeterminate. */
  value?: number;
  /** The full bar. 100, so `value` reads as a percentage. */
  max?: number;
  label?: string;
}

/** The words between the markers, and the markers, in the order they were written. */
export type ProgressSegment =
  | { kind: "text"; text: string }
  | { kind: "progress"; props: ProgressProps };

const OPEN = "::progress{";

/** A marker is a line of its own — `m` so every line in the block is one. */
const MARKER = /^[ \t]*::progress\{([^}\n]*)\}[ \t]*$/gm;

/** `key`, then `"value"`, `'value'` or a bare run. */
const ATTRIBUTE = /([A-Za-z_][\w-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"'{}]+)))?/g;

/** Half a marker at the end of a growing block. It is hidden, not shown. */
const PARTIAL = /\n?[ \t]*::progress\{[^}\n]*$/;

/** Nothing a marker cannot hold: its own delimiters, and the line break. */
const escape = (value: string) => value.replace(/["{}\r\n]/g, " ").trim();

const number = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined;
  const value = Number(raw.endsWith("%") ? raw.slice(0, -1) : raw);
  return Number.isFinite(value) ? value : undefined;
};

/** The marker for these props, without the line it sits on. */
export function progressMarker(props: ProgressProps & { id?: string }): string {
  const written = [
    props.id !== undefined && `id="${escape(props.id)}"`,
    props.value !== undefined && `value="${props.value}"`,
    props.max !== undefined && `max="${props.max}"`,
    props.label !== undefined && `label="${escape(props.label)}"`,
  ].filter(Boolean);

  return `${OPEN}${written.join(" ")}}`;
}

function toProps(attributes: string): ProgressProps & { id: string } {
  const props: ProgressProps & { id: string } = { id: "" };

  ATTRIBUTE.lastIndex = 0;
  for (let match; (match = ATTRIBUTE.exec(attributes));) {
    const raw = match[2] ?? match[3] ?? match[4];
    // Only the four fields the bar reads. An unknown key is dropped rather
    // than passed on: these props reach a component, and the words they came
    // from are a model's.
    switch (match[1]) {
      case "id":
        props.id = raw ?? "";
        break;
      case "value": {
        const value = number(raw);
        if (value !== undefined) props.value = value;
        break;
      }
      case "max": {
        const max = number(raw);
        if (max !== undefined) props.max = max;
        break;
      }
      case "label":
        if (raw !== undefined) props.label = raw;
        break;
    }
  }

  return props;
}

/**
 * The block, split on its markers, or `undefined` when it holds none — the
 * answer for almost every block, so the caller keeps the text it already has.
 *
 * Text segments are trimmed and empty ones dropped, so a block that is markers
 * alone becomes bars alone.
 */
export function splitProgress(text: string): ProgressSegment[] | undefined {
  if (!text.includes(OPEN)) return undefined;

  const body = text.replace(PARTIAL, "");
  const segments: ProgressSegment[] = [];
  /** Where each id drew its bar, so the next marker updates that one. */
  const bars = new Map<string, number>();
  let read = 0;

  const words = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed) segments.push({ kind: "text", text: trimmed });
  };

  MARKER.lastIndex = 0;
  for (let match; (match = MARKER.exec(body));) {
    words(body.slice(read, match.index));
    read = match.index + match[0].length;

    const { id, ...props } = toProps(match[1]);
    const at = bars.get(id);
    if (at === undefined) {
      bars.set(id, segments.length);
      segments.push({ kind: "progress", props });
      continue;
    }
    // The bar keeps what this marker does not name — a stream sends the label
    // once and the value on every tick.
    const before = segments[at] as { kind: "progress"; props: ProgressProps };
    segments[at] = { kind: "progress", props: { ...before.props, ...props } };
  }
  words(body.slice(read));

  return segments;
}
