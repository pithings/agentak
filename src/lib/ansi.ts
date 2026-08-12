/**
 * A small ANSI SGR parser — the `terminal` element renders its output through
 * this instead of pulling in `ansi-to-react`, which is react-only.
 *
 * Text is split into spans of equal style. Colors come out as CSS values, so a
 * palette token and an `rgb()` from a truecolor sequence both fit the same
 * field. Every other CSI sequence (cursor moves, erases) is dropped rather
 * than printed, and a sequence cut short by a stream ends up dropped too.
 */

import type { JSX } from "preact";

export interface AnsiStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  inverse?: boolean;
}

export interface AnsiSpan {
  key: string;
  text: string;
  style: AnsiStyle;
}

const NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];

/** The 16 base colors are tokens, so a theme switch needs no second parse. */
const named = (index: number) => `var(--wa-ansi-${index > 7 ? "bright-" : ""}${NAMES[index % 8]})`;

const channel = (value: number) => Math.min(255, Math.max(0, Math.trunc(value)));

const rgb = (r: number, g: number, b: number) =>
  Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
    ? `rgb(${channel(r)} ${channel(g)} ${channel(b)})`
    : undefined;

/** Levels of the 6x6x6 cube in the xterm-256 palette. */
const CUBE = [0, 95, 135, 175, 215, 255];

const xterm = (n: number): string | undefined => {
  if (!Number.isInteger(n) || n < 0 || n > 255) return undefined;
  if (n < 16) return named(n);
  if (n < 232) {
    const i = n - 16;
    return rgb(CUBE[Math.floor(i / 36)], CUBE[Math.floor(i / 6) % 6], CUBE[i % 6]);
  }
  const gray = 8 + (n - 232) * 10;
  return rgb(gray, gray, gray);
};

/**
 * One SGR sequence applied to the running state. An empty body is `0` — a bare
 * `ESC[m` resets. Colons are the ITU form of the same parameters, so both
 * separators split alike and `38:5:n` reads as `38;5;n`.
 */
function applySgr(style: AnsiStyle, body: string): AnsiStyle {
  const params = body.split(/[;:]/).map((part) => (part === "" ? 0 : Number.parseInt(part, 10)));
  const next: AnsiStyle = { ...style };

  for (let i = 0; i < params.length; i++) {
    const code = params[i];

    if (code === 0) {
      for (const key of Object.keys(next) as (keyof AnsiStyle)[]) delete next[key];
    } else if (code === 1) next.bold = true;
    else if (code === 2) next.dim = true;
    else if (code === 3) next.italic = true;
    else if (code === 4) next.underline = true;
    else if (code === 7) next.inverse = true;
    else if (code === 9) next.strike = true;
    else if (code === 21 || code === 22) {
      delete next.bold;
      delete next.dim;
    } else if (code === 23) delete next.italic;
    else if (code === 24) delete next.underline;
    else if (code === 27) delete next.inverse;
    else if (code === 29) delete next.strike;
    else if (code >= 30 && code <= 37) next.fg = named(code - 30);
    else if (code === 39) delete next.fg;
    else if (code >= 40 && code <= 47) next.bg = named(code - 40);
    else if (code === 49) delete next.bg;
    else if (code >= 90 && code <= 97) next.fg = named(code - 90 + 8);
    else if (code >= 100 && code <= 107) next.bg = named(code - 100 + 8);
    else if (code === 38 || code === 48) {
      const key = code === 38 ? "fg" : "bg";
      const mode = params[i + 1];
      let color: string | undefined;

      if (mode === 5) {
        color = xterm(params[i + 2]);
        i += 2;
      } else if (mode === 2) {
        color = rgb(params[i + 2], params[i + 3], params[i + 4]);
        i += 4;
      } else {
        i += 1; // Unknown color space — drop the selector alone.
      }

      if (color) next[key] = color;
      else delete next[key];
    }
  }

  return next;
}

// ESC is the point of this module, so the control character is deliberate.
/* oxlint-disable no-control-regex */

/** Any CSI sequence: parameters, intermediates, then one final byte. */
const CSI = /\x1b\[[\d;:?]*[ -/]*[@-~]/g;

/** A sequence a stream cut short, at the tail of the text. */
const PARTIAL = /\x1b\[?[\d;:?]*[ -/]*$/;

/* oxlint-enable no-control-regex */

/** Split text into spans of equal style. Text with no escapes gives one span. */
export function parseAnsi(input: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let style: AnsiStyle = {};
  let end = 0;

  const push = (text: string) => {
    if (text) spans.push({ key: String(spans.length), style, text });
  };

  CSI.lastIndex = 0;
  for (let match = CSI.exec(input); match; match = CSI.exec(input)) {
    push(input.slice(end, match.index));
    end = match.index + match[0].length;

    // `?` marks a private sequence, never SGR.
    const sequence = match[0];
    if (sequence.endsWith("m") && !sequence.includes("?")) {
      style = applySgr(style, sequence.slice(2, -1));
    }
  }

  push(input.slice(end).replace(PARTIAL, ""));
  return spans;
}

/** A span's style as CSS. Inverse swaps the pair, defaulting to the surface. */
export function ansiCss(style: AnsiStyle): JSX.CSSProperties {
  const decoration = [style.underline && "underline", style.strike && "line-through"].filter(
    Boolean,
  );

  return {
    background: style.inverse ? (style.fg ?? "var(--wa-terminal-fg)") : style.bg,
    color: style.inverse ? (style.bg ?? "var(--wa-terminal-bg)") : style.fg,
    fontStyle: style.italic ? "italic" : undefined,
    fontWeight: style.bold ? 600 : undefined,
    opacity: style.dim ? 0.7 : undefined,
    textDecoration: decoration.length > 0 ? decoration.join(" ") : undefined,
  };
}
