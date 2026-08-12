import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { CATALOG, Catalog } from "../src/catalog";

afterEach(cleanup);

describe("the catalog", () => {
  it("renders every entry", () => {
    const { container } = render(<Catalog />);

    const names = CATALOG.flatMap((section) => section.entries.map((entry) => entry.name));
    expect(names.length).toBeGreaterThan(40);
    expect(new Set(names).size).toBe(names.length); // No entry listed twice.
    expect(container.querySelectorAll(".pg-item")).toHaveLength(names.length);
  });
});
