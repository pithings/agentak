import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Terminal } from "@/components/ai-elements/terminal";

afterEach(cleanup);

/**
 * A coloured `pnpm vitest run` transcript — green passes, a red failure, dim
 * timings, a 256-colour warning and a truecolor swatch. The chat mounts no
 * terminal of its own, so this fixture is what checks the element end to end.
 */
const output = [
  "\x1b[1m$\x1b[0m pnpm vitest run",
  "",
  "\x1b[7m RUN \x1b[27m \x1b[2mv4.1.10  /workspace/web-agent\x1b[0m",
  "",
  "\x1b[32m ✓ \x1b[0msrc/lib/ansi.test.ts \x1b[2m(18 tests)\x1b[0m \x1b[2m 9ms\x1b[0m",
  "\x1b[32m ✓ \x1b[0msrc/markdown.test.tsx \x1b[2m(6 tests)\x1b[0m \x1b[2m 31ms\x1b[0m",
  "\x1b[31m ✗ \x1b[0msrc/render.test.tsx \x1b[2m(24 tests | \x1b[31m1 failed\x1b[2m)\x1b[0m \x1b[2m412ms\x1b[0m",
  "",
  "\x1b[41;97;1m FAIL \x1b[0m src/render.test.tsx > styles > declares every class",
  "  \x1b[31mAssertionError\x1b[0m: expected \x1b[32m[ 'wa-terminal-pre' ]\x1b[0m to deeply equal \x1b[31m[]\x1b[0m",
  "    \x1b[2mat src/render.test.tsx:629:5\x1b[0m",
  "",
  "\x1b[38;5;208m⚠\x1b[0m one style block is missing from the manifest",
  "\x1b[38;2;99;102;241m▉\x1b[38;2;236;72;153m▉\x1b[0m truecolor swatch",
  "",
  "\x1b[1;32mTest Files\x1b[0m  \x1b[32m6 passed\x1b[0m \x1b[2m|\x1b[0m \x1b[31m1 failed\x1b[0m \x1b[2m(7)\x1b[0m",
  "\x1b[4mDuration\x1b[0m  \x1b[2m1.42s\x1b[0m \x1b[90m(transform 318ms, setup 0ms)\x1b[0m",
].join("\n");

/** The first span whose text matches — "1 failed" is printed twice. */
const styleOf = (text: string) => screen.getAllByText(text)[0].getAttribute("style") ?? "";

describe("Terminal", () => {
  it("renders the default header and no clear button", () => {
    render(<Terminal output={output} />);

    expect(screen.getByText("Terminal")).toBeTruthy();
    expect(screen.getByTitle("Copy")).toBeTruthy();
    expect(screen.queryByTitle("Clear")).toBeNull();
  });

  it("colors the output from its escapes, without raw HTML", () => {
    const { container } = render(<Terminal output={output} />);

    expect(styleOf("1 failed")).toContain("color: var(--wa-ansi-red)");
    expect(styleOf("6 passed")).toContain("color: var(--wa-ansi-green)");
    expect(styleOf("1.42s")).toContain("opacity: 0.7");
    expect(styleOf("Duration")).toContain("text-decoration: underline");
    // 256-colour 208, written by the parser as `rgb(255 135 0)` and
    // re-serialised by the CSS engine into the legacy form.
    expect(styleOf("⚠")).toContain("color: rgb(255, 135, 0)");
    expect(styleOf("FAIL")).toContain("background: var(--wa-ansi-red)");

    // Escapes reach the DOM as styles, never as text.
    expect(container.textContent).not.toContain("\x1b");
    expect(container.querySelector("pre")?.innerHTML).not.toContain("[0m");
  });

  it("shows the cursor and the clear button only when asked", () => {
    const { container } = render(<Terminal isStreaming onClear={() => {}} output={output} />);

    expect(container.querySelector('[data-slot="terminal-cursor"]')).toBeTruthy();
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByTitle("Clear")).toBeTruthy();
  });
});
