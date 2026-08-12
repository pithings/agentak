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
  it("has no react package to resolve", async () => {
    // The eject is only real if nothing can pull a second renderer in.
    // Indirected through a variable so tsc does not try to resolve it.
    const react = "react";
    await expect(import(/* @vite-ignore */ react)).rejects.toThrow();
  });
});
