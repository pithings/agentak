import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { CATALOG, Catalog } from "@/catalog";
import { declares } from "@/styles/declared";
import { styleText } from "@/styles/sheet";

afterEach(cleanup);

describe("the catalog", () => {
  it("renders every entry", () => {
    const { container } = render(<Catalog />);

    const names = CATALOG.flatMap((section) => section.entries.map((entry) => entry.name));
    expect(names.length).toBeGreaterThan(40);
    expect(new Set(names).size).toBe(names.length); // No entry listed twice.
    expect(container.querySelectorAll(".pg-item")).toHaveLength(names.length);
  });

  it("declares every class its demos render", () => {
    // The catalog mounts components the chat never does, so this sees classes
    // `render.test.tsx` cannot. `pg-` classes are the playground's own.
    const { container } = render(<Catalog />);

    const sheet = styleText();
    const used = new Set<string>();
    for (const element of container.querySelectorAll("*")) {
      for (const name of element.classList) {
        if (name.startsWith("wa-")) used.add(name);
      }
    }

    // Guards against a vacuous check. Counts `data-slot`, not `wa-` classes:
    // a class lives only while a rule selects it, so that count falls to zero as
    // styles move inline, but every component keeps its slot.
    expect(container.querySelectorAll("[data-slot]").length).toBeGreaterThan(50);
    expect([...used].filter((name) => !declares(sheet, name))).toEqual([]);
  });
});
