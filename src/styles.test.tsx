import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Catalog } from "@/catalog";
import { AgentChat } from "@/components/agent-chat";
import { replies } from "@/demo-chat";
import { styleText } from "@/styles/sheet";

afterEach(cleanup);

/**
 * Styles live in two places now: an inline object on the element, and the rules
 * left in the sheet. Inline wins over every rule, so the split is only correct
 * while no rule needs to override something that went inline.
 *
 * This renders the real tree and checks that directly. It is the only thing that
 * can — the split is decided per property, and which classes share an element is
 * a fact about the JSX, not about the CSS.
 */

interface Rule {
  selector: string;
  /** the selector with its state qualifiers removed, for `matches()` */
  base: string;
  props: Map<string, string>;
  /**
   * True when the rule is anything more than one bare class — a state, an
   * attribute, `:has()`, a combinator, a compound.
   *
   * Only those have to win. A bare single class losing to an inline style is the
   * idiom, not a bug: `.wa-control` sets the input frame, and InputGroup passes
   * `background: transparent` as `style` to take it away. What must never lose is
   * a rule that is conditional or more specific, because nothing can outrank
   * inline and the condition would simply never apply.
   */
  mustWin: boolean;
}

/** Split a stylesheet into flat rules. At-rule bodies are skipped. */
function parse(text: string): Rule[] {
  const rules: Rule[] = [];
  let i = 0;
  let buf = "";
  let depth = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i);
      i = end < 0 ? text.length : end + 2;
      continue;
    }

    if (char === "{") {
      const prelude = buf.trim();
      buf = "";
      if (prelude.startsWith("@")) {
        depth++;
        i++;
        continue;
      }

      let body = "";
      let inner = 1;
      let j = i + 1;
      while (j < text.length && inner > 0) {
        if (text[j] === "{") inner++;
        else if (text[j] === "}") {
          inner--;
          if (inner === 0) break;
        }
        body += text[j];
        j++;
      }

      // Keyframe steps and anything else inside an at-rule are not selectors.
      if (depth === 0) {
        const props = new Map<string, string>();
        for (const part of body.replace(/\/\*[\s\S]*?\*\//g, "").split(";")) {
          const colon = part.indexOf(":");
          if (colon < 0) continue;
          const prop = part.slice(0, colon).trim();
          const value = part
            .slice(colon + 1)
            .trim()
            .replace(/\s+/g, " ");
          if (prop && value) props.set(prop, value);
        }
        for (const selector of splitSelectors(prelude)) {
          // The reset is written with `:where()`, which carries no specificity —
          // it is meant to lose to anything, inline included.
          if (selector.includes(":where(")) continue;
          // A pseudo-element is a box of its own. Nothing put on the element can
          // outrank it, so it never constrains what goes inline.
          if (selector.includes("::")) continue;
          const base = strip(selector);
          if (base) rules.push({ base, mustWin: !BARE.test(selector), props, selector });
        }
      }

      i = j + 1;
      continue;
    }

    if (char === "}") {
      if (depth > 0) depth--;
      buf = "";
      i++;
      continue;
    }

    buf += char;
    i++;
  }

  return rules;
}

/** Split a selector list on its top-level commas — `:where(a, b)` holds its own. */
function splitSelectors(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const char of prelude) {
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    if (char === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += char;
  }
  out.push(buf.trim());
  return out.filter(Boolean);
}

/** a selector that is exactly one class, and so may lose to inline */
const BARE = /^\.[\w-]+$/;

const STATE =
  /::?(?:hover|focus|focus-visible|focus-within|active|disabled|checked|placeholder|selection|first-child|last-child|nth-child|before|after|-webkit-[\w-]+)\b(?:\([^)]*\))?/g;

/**
 * Remove the parts that make a rule conditional, leaving what the element must
 * be for the rule to ever apply. `:has(...)` and attribute selectors go too —
 * an element that matches the rest can enter that state later.
 */
function strip(selector: string): string {
  let out = selector.replace(STATE, "");
  out = out.replace(/:has\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "");
  out = out.replace(/\[[^\]]*\]/g, "");
  out = out.trim();
  // A selector that was only a state (`::-webkit-scrollbar` alone) has no subject.
  return /[.\w]/.test(out) ? out : "";
}

/**
 * What each shorthand writes. Only a shorthand collides with its longhands —
 * `row-gap` and `column-gap` never touch each other, though `gap` touches both.
 */
const SHORTHANDS: Record<string, string[]> = {
  background: ["background-color", "background-image", "background-clip", "background-repeat"],
  border: [
    "border-width",
    "border-style",
    "border-color",
    "border-top",
    "border-bottom",
    "border-left",
    "border-right",
    "border-block",
    "border-inline",
  ],
  "border-color": [
    "border-top-color",
    "border-bottom-color",
    "border-left-color",
    "border-right-color",
  ],
  "border-radius": [
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-left-radius",
    "border-bottom-right-radius",
  ],
  "border-width": [
    "border-top-width",
    "border-bottom-width",
    "border-left-width",
    "border-right-width",
  ],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  font: ["font-family", "font-size", "font-weight", "font-style", "line-height"],
  gap: ["row-gap", "column-gap"],
  inset: ["top", "right", "bottom", "left"],
  margin: [
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "margin-inline",
    "margin-block",
  ],
  "margin-block": ["margin-top", "margin-bottom"],
  "margin-inline": ["margin-left", "margin-right"],
  outline: ["outline-width", "outline-style", "outline-color"],
  overflow: ["overflow-x", "overflow-y"],
  padding: [
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "padding-inline",
    "padding-block",
  ],
  "padding-block": ["padding-top", "padding-bottom"],
  "padding-inline": ["padding-left", "padding-right"],
  "text-decoration": ["text-decoration-line", "text-decoration-color", "text-decoration-style"],
};

function overlaps(a: string, b: string): boolean {
  if (a === b) return true;
  return (SHORTHANDS[a]?.includes(b) ?? false) || (SHORTHANDS[b]?.includes(a) ?? false);
}

/** The property names actually written on the element's style attribute. */
function inlineProps(element: Element): string[] {
  const style = (element as HTMLElement).style;
  const names: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const name = style.item(i);
    if (name) names.push(name);
  }
  return names;
}

function collect(container: Element): Element[] {
  return [container, ...container.querySelectorAll("*")];
}

interface Clash {
  element: string;
  prop: string;
  selector: string;
  inline: string;
  css: string;
}

function clashes(container: Element, rules: Rule[]): Clash[] {
  const found: Clash[] = [];

  for (const element of collect(container)) {
    const inline = inlineProps(element);
    if (inline.length === 0) continue;

    for (const rule of rules) {
      let matched = false;
      try {
        matched = element.matches(rule.base);
      } catch {
        continue; // a selector this engine cannot parse — nothing to assert
      }
      if (!matched) continue;

      if (!rule.mustWin) continue;

      for (const [prop, value] of rule.props) {
        const hit = inline.find((name) => overlaps(name, prop));
        if (!hit) continue;

        const own = (element as HTMLElement).style.getPropertyValue(hit);
        // Same value written twice is a duplicate, not a conflict.
        if (own.replace(/\s+/g, " ") === value) continue;

        found.push({
          css: value,
          element: `${element.tagName.toLowerCase()}.${[...element.classList].join(".")}`,
          inline: `${hit}: ${own}`,
          prop,
          selector: rule.selector,
        });
      }
    }
  }

  return found;
}

describe("the inline/sheet split", () => {
  const rules = parse(styleText());

  it("parses the sheet", () => {
    // No rule-count floor: the sheet shrinks toward the tokens as styles move
    // inline, so any number here becomes a treadmill. The second assertion is
    // the one that carries weight — it proves the parser found rules that have
    // to win, which are the only ones this file can check.
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((rule) => rule.mustWin)).toBe(true);
  });

  it("leaves no sheet rule outranked by an inline style, in the catalog", () => {
    const { container } = render(<Catalog />);

    expect(clashes(container, rules)).toEqual([]);
  });

  it("leaves no sheet rule outranked by an inline style, in the chat", () => {
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

    expect(clashes(container, rules)).toEqual([]);
  });
});
