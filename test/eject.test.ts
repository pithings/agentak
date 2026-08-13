import { describe, expect, it } from "vitest";

/** The two checks that police the eject itself, rather than any one component. */

describe("styles", () => {
  it("ships no stylesheet", () => {
    // There is no sheet to adopt any more, and nothing injects one. A component
    // that grows a `*Styles` block has nowhere to put it, so it would render
    // dead text — this is what catches that, since the old manifest that used
    // to is gone. Tokens are the exception and live in `styles/base.ts`, which
    // this glob does not reach.
    const modules = import.meta.glob<Record<string, unknown>>("../src/components/**/*.tsx", {
      eager: true,
    });

    const blocks = Object.values(modules)
      .flatMap((module) => Object.entries(module))
      .filter(([name, value]) => name.endsWith("Styles") && typeof value === "string")
      .map(([name]) => name);

    expect(blocks).toEqual([]);
  });
});

describe("runtime", () => {
  it("imports react nowhere but the react wrapper", () => {
    // The eject is only real if nothing can pull a second renderer in. React is
    // installed now — `agentak/react` is an optional peer of it — so resolving
    // the package no longer proves anything. The source does: one file names it,
    // and that file renders one div.
    const sources = import.meta.glob<string>("../src/**/*.{ts,tsx}", {
      eager: true,
      import: "default",
      query: "?raw",
    });

    const importers = Object.entries(sources)
      .filter(([, source]) => /from\s*["']react(-dom)?["']/.test(source))
      .map(([path]) => path);

    expect(importers).toEqual(["../src/react/index.ts"]);
  });
});
