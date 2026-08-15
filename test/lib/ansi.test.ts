import { describe, expect, it } from "vitest";

import { ansiCss, parseAnsi } from "../../src/lib/ansi.ts";

/** Spans as `[text, style]` pairs — shorter to assert than the full objects. */
const parse = (input: string) => parseAnsi(input).map((span) => [span.text, span.style] as const);

describe("parseAnsi", () => {
  it("returns one span for text with no escapes", () => {
    expect(parse("plain output")).toEqual([["plain output", {}]]);
  });

  it("returns nothing for empty text", () => {
    expect(parseAnsi("")).toEqual([]);
  });

  it("colors the 8 basic foregrounds", () => {
    expect(parse("\x1b[31mred\x1b[32mgreen\x1b[36mcyan")).toEqual([
      ["red", { fg: "var(--ansi-red)" }],
      ["green", { fg: "var(--ansi-green)" }],
      ["cyan", { fg: "var(--ansi-cyan)" }],
    ]);
    expect(parse("\x1b[30ma\x1b[37mb")[0][1]).toEqual({ fg: "var(--ansi-black)" });
  });

  it("colors the bright forms", () => {
    expect(parse("\x1b[90mdim gray\x1b[93myellow")).toEqual([
      ["dim gray", { fg: "var(--ansi-bright-black)" }],
      ["yellow", { fg: "var(--ansi-bright-yellow)" }],
    ]);
  });

  it("colors backgrounds, basic and bright", () => {
    expect(parse("\x1b[41mfail\x1b[102mok")).toEqual([
      ["fail", { bg: "var(--ansi-red)" }],
      ["ok", { bg: "var(--ansi-bright-green)" }],
    ]);
  });

  it("tracks bold, dim, italic and underline", () => {
    expect(parse("\x1b[1;2;3;4mall")).toEqual([
      ["all", { bold: true, dim: true, italic: true, underline: true }],
    ]);
  });

  it("turns single attributes off again", () => {
    expect(parse("\x1b[1;4mboth\x1b[24mbold\x1b[22mnone")).toEqual([
      ["both", { bold: true, underline: true }],
      ["bold", { bold: true }],
      ["none", {}],
    ]);
  });

  it("keeps the foreground when only an attribute is cleared", () => {
    expect(parse("\x1b[31;1mloud\x1b[22mquiet")).toEqual([
      ["loud", { bold: true, fg: "var(--ansi-red)" }],
      ["quiet", { fg: "var(--ansi-red)" }],
    ]);
  });

  it("resets on 39 and 49 without touching attributes", () => {
    expect(parse("\x1b[1;31;44ma\x1b[39;49mb")).toEqual([
      ["a", { bold: true, bg: "var(--ansi-blue)", fg: "var(--ansi-red)" }],
      ["b", { bold: true }],
    ]);
  });

  it("reads 256-color foregrounds and backgrounds", () => {
    expect(parse("\x1b[38;5;9mbright\x1b[38;5;208morange\x1b[48;5;236mbar")).toEqual([
      ["bright", { fg: "var(--ansi-bright-red)" }],
      ["orange", { fg: "rgb(255 135 0)" }],
      ["bar", { bg: "rgb(48 48 48)", fg: "rgb(255 135 0)" }],
    ]);
  });

  it("reads the colon form of an extended color", () => {
    expect(parse("\x1b[38:5:196mred")).toEqual([["red", { fg: "rgb(255 0 0)" }]]);
  });

  it("reads truecolor", () => {
    expect(parse("\x1b[38;2;236;72;153mpink\x1b[48;2;0;0;0mon black")).toEqual([
      ["pink", { fg: "rgb(236 72 153)" }],
      ["on black", { bg: "rgb(0 0 0)", fg: "rgb(236 72 153)" }],
    ]);
  });

  it("resets on 0 and on a bare ESC[m", () => {
    expect(parse("\x1b[1;31mloud\x1b[0mplain")).toEqual([
      ["loud", { bold: true, fg: "var(--ansi-red)" }],
      ["plain", {}],
    ]);
    expect(parse("\x1b[4munder\x1b[mplain")).toEqual([
      ["under", { underline: true }],
      ["plain", {}],
    ]);
  });

  it("drops a sequence the stream cut short", () => {
    expect(parse("\x1b[32mdone\x1b[3")).toEqual([["done", { fg: "var(--ansi-green)" }]]);
    expect(parse("half a token\x1b[")).toEqual([["half a token", {}]]);
    expect(parse("\x1b")).toEqual([]);
  });

  it("strips cursor moves and erases instead of printing them", () => {
    expect(parse("\x1b[2K\x1b[1A\x1b[?25lstill here\x1b[0K")).toEqual([["still here", {}]]);
  });

  it("emits no span for the gap between two sequences", () => {
    expect(parse("\x1b[1m\x1b[31mred")).toEqual([["red", { bold: true, fg: "var(--ansi-red)" }]]);
  });
});

describe("ansiCss", () => {
  it("maps the attributes to CSS", () => {
    expect(ansiCss({ bold: true, dim: true, italic: true, strike: true, underline: true })).toEqual(
      {
        background: undefined,
        color: undefined,
        fontStyle: "italic",
        fontWeight: 600,
        opacity: 0.7,
        textDecoration: "underline line-through",
      },
    );
  });

  it("swaps the pair when inverse is set", () => {
    expect(ansiCss({ fg: "var(--ansi-red)", inverse: true })).toMatchObject({
      background: "var(--ansi-red)",
      color: "var(--terminal-bg)",
    });
  });
});
