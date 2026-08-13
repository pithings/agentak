import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { CATALOG, ENTRIES, findEntry, matches, neighbours, sourcePath } from "../src/catalog";
import { AllEntries } from "./entries";

afterEach(cleanup);

describe("the catalog", () => {
  it("renders every entry", () => {
    const { container } = render(<AllEntries />);

    const names = CATALOG.flatMap((section) => section.entries.map((entry) => entry.name));
    expect(names.length).toBeGreaterThan(40);
    expect(new Set(names).size).toBe(names.length); // No entry listed twice.
    expect(container.querySelectorAll("[data-entry]")).toHaveLength(names.length);
  });

  it("flattens into one lookup, in catalog order", () => {
    expect(ENTRIES.map((entry) => entry.name)).toEqual(
      CATALOG.flatMap((section) => section.entries.map((entry) => entry.name)),
    );
    expect(findEntry("button")?.section.id).toBe("primitives");
    expect(findEntry("nope")).toBeUndefined();
  });

  it("pages between neighbours, and stops at the ends", () => {
    const first = ENTRIES[0].name;
    const last = ENTRIES.at(-1)!.name;

    expect(neighbours(first).prev).toBeUndefined();
    expect(neighbours(first).next?.name).toBe(ENTRIES[1].name);
    expect(neighbours(last).next).toBeUndefined();
    expect(neighbours("nope")).toEqual({});
  });

  it("names a source file, following the section unless the entry says otherwise", () => {
    expect(sourcePath(findEntry("button")!)).toBe("src/components/ui/button.tsx");
    expect(sourcePath(findEntry("markdown")!)).toBe("src/components/markdown.tsx");
  });

  it("filters by name, ignoring case and padding", () => {
    const entry = findEntry("code-block")!;

    expect(matches(entry, " CODE ")).toBe(true);
    expect(matches(entry, "block")).toBe(true);
    expect(matches(entry, "avatar")).toBe(false);
  });
});
