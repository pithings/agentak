import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { AllEntries } from "./entries";
import { AgentChat } from "@/components/agent-chat";
import { replies } from "../src/demo-chat";

afterEach(cleanup);

/**
 * This file used to compare every element's inline style against every rule in
 * the sheet, because a property that went inline while a rule still needed to
 * win would never paint. There is no sheet now, so the only rule left to police
 * is the one that used to cover every element at once.
 *
 * `box-sizing: border-box` was `.wa-root *`. Inlining it everywhere is a
 * property on ~355 elements, so it went only where it changes a pixel: an
 * element that sizes itself AND carries a padding or a border. That is a rule
 * about the JSX, not about any one file, and nothing but a render can check it —
 * the size and the inset often arrive from different objects merged by `sx()`.
 *
 * What this cannot see: a size a caller passes as `style` onto a padded
 * primitive. The catalog renders defaults, so only the defaults are covered.
 */

const SIZES = ["width", "height", "min-width", "max-width", "min-height", "max-height"];
const INSETS = ["padding", "border"];

/** Sizes that the box model does not touch — nothing to get wrong. */
const CONTENT_SIZED = new Set(["auto", "fit-content", "max-content", "min-content", ""]);

/** `min-width: 0` is the flex-shrink idiom — a used value of 0 cannot change. */
const ZERO = /^0(\D|$)/;

function inlineProps(element: Element): Map<string, string> {
  const style = (element as HTMLElement).style;
  const props = new Map<string, string>();
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i);
    if (name) props.set(name, style.getPropertyValue(name));
  }
  return props;
}

function sized(props: Map<string, string>): string | undefined {
  for (const [name, value] of props) {
    if (!SIZES.some((size) => name === size)) continue;
    if (CONTENT_SIZED.has(value.trim()) || ZERO.test(value.trim())) continue;
    return `${name}: ${value}`;
  }
  return undefined;
}

function inset(props: Map<string, string>): string | undefined {
  for (const [name, value] of props) {
    if (!INSETS.some((prefix) => name === prefix || name.startsWith(`${prefix}-`))) continue;
    // A zero inset takes no space, so the box model cannot change the result.
    if (/^0(\D|$)/.test(value.trim()) || value.trim() === "none") continue;
    // Radius and colour are not insets; only a width takes space.
    if (name.includes("radius") || name.includes("color") || name.includes("style")) continue;
    return `${name}: ${value}`;
  }
  return undefined;
}

interface Miss {
  element: string;
  size: string;
  inset: string;
}

function missing(container: Element): Miss[] {
  const found: Miss[] = [];

  for (const element of [container, ...container.querySelectorAll("*")]) {
    const props = inlineProps(element);
    if (props.get("box-sizing") === "border-box") continue;

    const size = sized(props);
    const edge = inset(props);
    if (!size || !edge) continue;

    found.push({
      element: `${element.tagName.toLowerCase()}[data-slot=${element.getAttribute("data-slot")}]`,
      inset: edge,
      size,
    });
  }

  return found;
}

describe("box-sizing", () => {
  it("is set wherever a size meets an inset, in the catalog", () => {
    const { container } = render(<AllEntries />);

    expect(missing(container)).toEqual([]);
  });

  it("is set wherever a size meets an inset, in the chat", () => {
    const parts = replies.flatMap((reply) => reply(0));
    const { container } = render(
      <AgentChat
        error="boom"
        isStreaming={false}
        messages={[{ id: "demo", parts, role: "assistant" }]}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
      />,
    );

    expect(missing(container)).toEqual([]);
  });

  it("catches an element that pairs the two without it", () => {
    // The check is worthless if it cannot fail — this is the shape it looks for.
    const { container } = render(<div style={{ padding: "1rem", width: "10rem" }} />);

    expect(missing(container)).toHaveLength(1);
  });
});
