import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorSeparator,
  ModelSelectorShortcut,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { declares } from "@/styles/declared";
import { styleText } from "@/styles/sheet";

afterEach(cleanup);

/** Real ids and context windows — see the Claude model catalog. */
const MODELS = [
  { context: "1M", id: "claude-opus-5", name: "Claude Opus 5" },
  { context: "1M", id: "claude-sonnet-5", name: "Claude Sonnet 5" },
  { context: "200K", id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
];

function Selector({ onValueChange }: { onValueChange?: (value: string) => void } = {}) {
  return (
    <ModelSelector defaultOpen defaultValue="claude-opus-5" onValueChange={onValueChange}>
      <ModelSelectorTrigger>Claude Opus 5</ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput />
        <ModelSelectorList>
          <ModelSelectorEmpty />
          <ModelSelectorGroup heading="Anthropic">
            {MODELS.map((model) => (
              <ModelSelectorItem key={model.id} textValue={model.name} value={model.id}>
                <ModelSelectorName>{model.name}</ModelSelectorName>
                <ModelSelectorShortcut>{model.context}</ModelSelectorShortcut>
              </ModelSelectorItem>
            ))}
          </ModelSelectorGroup>
          <ModelSelectorSeparator />
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

/** Options the filter leaves visible, in DOM order. */
const shown = () =>
  screen
    .getAllByRole("option", { hidden: true })
    .filter((option) => !(option as HTMLElement).hidden)
    .map((option) => option.getAttribute("data-value"));

const highlighted = () =>
  screen
    .getAllByRole("option", { hidden: true })
    .find((option) => option.getAttribute("data-selected") === "true")
    ?.getAttribute("data-value");

describe("ModelSelector", () => {
  it("lists every model, and marks the chosen one", () => {
    render(<Selector />);

    expect(shown()).toEqual(MODELS.map((model) => model.id));
    expect(screen.getByText("Anthropic")).toBeTruthy();

    const checked = screen
      .getAllByRole("option")
      .filter((option) => option.getAttribute("data-checked") === "true");
    expect(checked.map((option) => option.getAttribute("data-value"))).toEqual(["claude-opus-5"]);
  });

  it("narrows the list as the filter is typed", () => {
    const { container } = render(<Selector />);
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.input(input, { target: { value: "haiku" } });
    expect(shown()).toEqual(["claude-haiku-4-5-20251001"]);
    expect(screen.queryByText("No models found.")).toBeNull();

    // The label matches too, not only the id.
    fireEvent.input(input, { target: { value: "Sonnet" } });
    expect(shown()).toEqual(["claude-sonnet-5"]);

    fireEvent.input(input, { target: { value: "gpt" } });
    expect(shown()).toEqual([]);
    expect(screen.getByText("No models found.")).toBeTruthy();
  });

  it("moves the highlight with the arrow keys, and wraps", () => {
    const { container } = render(<Selector />);
    const input = container.querySelector("input") as HTMLInputElement;

    // The chosen model starts highlighted.
    expect(highlighted()).toBe("claude-opus-5");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(highlighted()).toBe("claude-sonnet-5");

    fireEvent.keyDown(input, { key: "End" });
    expect(highlighted()).toBe("claude-haiku-4-5-20251001");

    fireEvent.keyDown(input, { key: "ArrowDown" }); // Wraps to the top.
    expect(highlighted()).toBe("claude-opus-5");

    fireEvent.keyDown(input, { key: "ArrowUp" }); // Wraps back to the end.
    expect(highlighted()).toBe("claude-haiku-4-5-20251001");

    fireEvent.keyDown(input, { key: "Home" });
    expect(highlighted()).toBe("claude-opus-5");
  });

  it("skips filtered-out items when moving the highlight", () => {
    const { container } = render(<Selector />);
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.input(input, { target: { value: "5" } }); // Every id contains a 5.
    fireEvent.input(input, { target: { value: "claude-s" } });

    expect(highlighted()).toBe("claude-sonnet-5");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(highlighted()).toBe("claude-sonnet-5"); // The only match.
  });

  it("fires onValueChange on Enter and closes the panel", () => {
    const onValueChange = vi.fn();
    const { container } = render(<Selector onValueChange={onValueChange} />);
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("claude-sonnet-5");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fires onValueChange on click", () => {
    const onValueChange = vi.fn();
    render(<Selector onValueChange={onValueChange} />);

    fireEvent.click(screen.getByText("Claude Haiku 4.5"));

    expect(onValueChange).toHaveBeenCalledWith("claude-haiku-4-5-20251001");
  });

  it("declares every class it renders", () => {
    const { container } = render(<Selector />);

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
    expect(container.querySelectorAll("[data-slot]").length).toBeGreaterThan(8);
    expect([...used].filter((name) => !declares(sheet, name))).toEqual([]);
  });
});
