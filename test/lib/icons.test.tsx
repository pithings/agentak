import { h } from "preact";
import { describe, expect, it } from "vitest";

import * as icons from "../../src/lib/icons.tsx";

describe("the icon registry", () => {
  it("holds every icon, so a button sizes each one", () => {
    // `ICONS` is a list written by hand, and an icon left off it is not a
    // failure anywhere: it renders at its own 24px inside a 16px slot, which
    // reads as a large, soft glyph beside its neighbours.
    const missing = Object.entries(icons as unknown as Record<string, unknown>)
      .filter(([name, value]) => name.endsWith("Icon") && typeof value === "function")
      .filter(([, value]) => !icons.isIconChild(h(value as () => null, {})))
      .map(([name]) => name);

    expect(missing).toEqual([]);
  });
});
