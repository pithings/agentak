import { describe, expect, it } from "vitest";

import { progressMarker, splitProgress } from "../../src/lib/progress.ts";

describe("splitProgress", () => {
  it("returns nothing for words without a marker", () => {
    expect(splitProgress("the answer, in the words it was written in")).toBeUndefined();
    expect(splitProgress("")).toBeUndefined();
  });

  it("reads the fields of a marker", () => {
    expect(splitProgress('::progress{id="load" value="42" max="100" label="Loading"}')).toEqual([
      { kind: "progress", props: { value: 42, max: 100, label: "Loading" } },
    ]);
  });

  it("takes bare and single-quoted values, and a percentage", () => {
    expect(splitProgress("::progress{value=7%  label='half way'}")).toEqual([
      { kind: "progress", props: { value: 7, label: "half way" } },
    ]);
  });

  it("drops a key the bar does not read", () => {
    expect(splitProgress('::progress{value="1" href="https://example.com"}')).toEqual([
      { kind: "progress", props: { value: 1 } },
    ]);
  });

  it("keeps the words around a marker, trimmed", () => {
    expect(splitProgress("before\n\n::progress{value=1}\n\nafter")).toEqual([
      { kind: "text", text: "before" },
      { kind: "progress", props: { value: 1 } },
      { kind: "text", text: "after" },
    ]);
  });

  it("leaves a marker that shares its line as words", () => {
    expect(splitProgress("reads ::progress{value=1} inline")).toEqual([
      { kind: "text", text: "reads ::progress{value=1} inline" },
    ]);
  });

  it("updates one bar from every marker that carries its id", () => {
    const stream = [
      '::progress{id="load" value="0" label="Loading Granite"}',
      '::progress{id="load" value="40"}',
      '::progress{id="load" value="100"}',
    ].join("\n");

    // One bar, where the first marker drew it, holding the label it was given
    // once and the reading of the last tick.
    expect(splitProgress(stream)).toEqual([
      { kind: "progress", props: { value: 100, label: "Loading Granite" } },
    ]);
  });

  it("keeps bars with different ids apart", () => {
    expect(splitProgress('::progress{id="a" value=1}\n::progress{id="b" value=2}')).toEqual([
      { kind: "progress", props: { value: 1 } },
      { kind: "progress", props: { value: 2 } },
    ]);
  });

  it("hides a marker still being written", () => {
    expect(splitProgress('words\n::progress{id="load" value="4')).toEqual([
      { kind: "text", text: "words" },
    ]);
    expect(splitProgress("::progress{value=")).toEqual([]);
  });
});

describe("progressMarker", () => {
  it("writes what splitProgress reads back", () => {
    const marker = progressMarker({ id: "load", value: 42, label: "Loading Granite 4.1 3B" });

    expect(marker).toBe('::progress{id="load" value="42" label="Loading Granite 4.1 3B"}');
    expect(splitProgress(marker)).toEqual([
      { kind: "progress", props: { value: 42, label: "Loading Granite 4.1 3B" } },
    ]);
  });

  it("writes only the fields it is given", () => {
    expect(progressMarker({ value: 5 })).toBe('::progress{value="5"}');
  });

  it("cannot be closed early by a label", () => {
    const marker = progressMarker({ id: "load", label: 'a "quoted" }\nlabel' });

    expect(splitProgress(marker)).toEqual([
      { kind: "progress", props: { label: "a  quoted    label" } },
    ]);
  });
});
