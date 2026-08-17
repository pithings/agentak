import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Markdown } from "../../src/components/markdown.tsx";
import { LinkBase } from "../../src/lib/links.ts";
import { loadMarkdown } from "../../src/lib/markdown.ts";

// The wasm is instantiated once for the whole file, so every render below
// takes the parsed path rather than the plain-text fallback.
beforeAll(async () => {
  expect(await loadMarkdown()).toBe(true);
});

// jsdom reports the host machine's core count and no `matchMedia` at all, so
// every test below states the device it means — see `isLowPowerDevice()`.
const setCores = (cores: number) =>
  Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: cores });

/** `matches` for the queries named here, and for nothing else. */
const setMedia = (...queries: string[]) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: queries.some((part) => query.includes(part)),
  }));

/** The display, which is the device — not the surface the chat was given. */
const setScreen = (width: number) => vi.stubGlobal("screen", { width });

afterEach(() => {
  Reflect.deleteProperty(navigator, "hardwareConcurrency");
  vi.unstubAllGlobals();
  cleanup();
});

describe("Markdown", () => {
  it("renders block and inline markup", () => {
    const { container } = render(
      <Markdown>{"# Title\n\nsome **bold** text\n\n- one\n- two"}</Markdown>,
    );

    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
  });

  it("renders a fenced block through CodeBlock", () => {
    const { container } = render(<Markdown>{'```json [a.json]\n{"a": 1}\n```'}</Markdown>);

    expect(container.querySelector("[data-language=json]")).toBeTruthy();
    expect(screen.getByText("a.json")).toBeTruthy();
    // rangi tokenised the fence content.
    expect(screen.getByText('"a"').getAttribute("style")).toContain("--shj-var");
  });

  it("renders a table and a task list", () => {
    const { container } = render(
      <Markdown>{"| a | b |\n|---|--:|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo"}</Markdown>,
    );

    expect(container.querySelectorAll("tbody td")).toHaveLength(2);
    expect(container.querySelectorAll("th")[1]?.getAttribute("style")).toContain("right");
    const boxes = container.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect([...boxes].map((box) => box.checked)).toEqual([true, false]);
  });

  it("keeps raw html out of the DOM", () => {
    const { container } = render(
      <Markdown>{'text <img src=x onerror=alert(1)>\n\n<div id="injected">block</div>'}</Markdown>,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("#injected")).toBeNull();
    expect(container.textContent).toContain('<div id="injected">block</div>');
  });

  it("drops unsafe link and image urls", () => {
    const { container } = render(
      <Markdown>
        {
          "[click](javascript:alert(1)) [ok](https://example.com)\n\n![x](data:text/html;base64,PA==)"
        }
      </Markdown>,
    );

    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://example.com");
    expect(screen.getByText("click")).toBeTruthy(); // text survives, the link does not
    expect(container.querySelector("img")).toBeNull();
  });

  it("resolves relative urls against the link base", () => {
    const { container } = render(
      <LinkBase.Provider value="https://example.com/docs/page">
        <Markdown>{"[a](/config) [b](./next) [c](https://other.test/) ![d](img.png)"}</Markdown>
      </LinkBase.Provider>,
    );

    const links = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    expect(links).toEqual([
      "https://example.com/config",
      "https://example.com/docs/next",
      "https://other.test/",
    ]);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/docs/img.png",
    );
  });

  it("drops a relative link the base cannot open", () => {
    const { container } = render(
      <LinkBase.Provider value="chrome://settings">
        <Markdown>{"[click](/config)"}</Markdown>
      </LinkBase.Provider>,
    );

    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("click")).toBeTruthy();
  });

  it("leaves relative urls alone without a base", () => {
    const { container } = render(<Markdown>{"[a](/config)"}</Markdown>);

    expect(container.querySelector("a")?.getAttribute("href")).toBe("/config");
  });

  it("heals markup left open by a stream", () => {
    const { container } = render(<Markdown>{"a **bold"}</Markdown>);

    expect(container.querySelector("strong")?.textContent).toBe("bold");
  });

  it("wraps a word at a time while animating, and nothing when it is done", () => {
    setCores(8);
    const { container, rerender } = render(<Markdown animate>{"one two\n\n- item"}</Markdown>);

    // A word per span, with the spaces kept; the list keeps its own shape.
    const words = [...container.querySelectorAll("p span")].map((span) => span.textContent);
    expect(words).toEqual(["one ", "two"]);
    expect(container.querySelector("li")?.textContent).toBe("item");

    rerender(<Markdown>{"one two\n\n- item"}</Markdown>);
    expect(container.querySelectorAll("span")).toHaveLength(0);
    expect(container.textContent).toBe("one twoitem");
  });

  it("keeps a word that is already on screen, so its fade plays once", () => {
    setCores(8);
    const { container, rerender } = render(<Markdown animate>{"one two"}</Markdown>);
    const first = container.querySelector("p span");

    rerender(<Markdown animate>{"one two three"}</Markdown>);

    expect(container.querySelector("p span")).toBe(first); // same element, not remounted
    expect(container.querySelectorAll("p span")).toHaveLength(3);
  });

  it("builds no spans on a device that would not animate them", () => {
    setCores(2); // a low-end phone, by its own report
    const { container, rerender } = render(<Markdown animate>{"one two"}</Markdown>);
    expect(container.querySelectorAll("span")).toHaveLength(0);

    setCores(8); // a capable machine, but a phone screen — and then reduced motion
    setMedia("pointer: coarse");
    setScreen(390);
    rerender(<Markdown animate>{"one two three"}</Markdown>);
    expect(container.querySelectorAll("span")).toHaveLength(0);

    setMedia("prefers-reduced-motion");
    rerender(<Markdown animate>{"one two three four"}</Markdown>);
    expect(container.querySelectorAll("span")).toHaveLength(0);
    expect(container.textContent).toBe("one two three four");
  });

  // The side panel, and any chat docked in a page's sidebar: a narrow surface
  // is not a small device, and the fade is what that hardware was built for.
  it("animates on a narrow surface of a full-sized screen", () => {
    setCores(8);
    setMedia("pointer: coarse"); // a desktop with a touch display
    setScreen(1920);

    const { container } = render(<Markdown animate>{"one two"}</Markdown>);
    expect(container.querySelectorAll("p span")).toHaveLength(2);
  });
});
