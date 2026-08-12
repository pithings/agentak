import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { Markdown } from "@/components/markdown";
import { loadMarkdown } from "@/lib/markdown";

// The wasm is instantiated once for the whole file, so every render below
// takes the parsed path rather than the plain-text fallback.
beforeAll(async () => {
  expect(await loadMarkdown()).toBe(true);
});

afterEach(cleanup);

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

  it("heals markup left open by a stream", () => {
    const { container } = render(<Markdown>{"a **bold"}</Markdown>);

    expect(container.querySelector("strong")?.textContent).toBe("bold");
  });
});
