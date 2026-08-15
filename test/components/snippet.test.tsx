import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Snippet,
  SnippetAddon,
  SnippetCopyButton,
  SnippetInput,
  SnippetText,
} from "../../src/components/ai-elements/snippet.tsx";

afterEach(cleanup);

const code = "pnpm add agentak";

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

const view = (onCopy?: () => void) =>
  render(
    <Snippet code={code} onCopy={onCopy}>
      <SnippetAddon>
        <SnippetText>$</SnippetText>
      </SnippetAddon>
      <SnippetInput />
      <SnippetAddon align="inline-end">
        <SnippetCopyButton />
      </SnippetAddon>
    </Snippet>,
  );

describe("snippet", () => {
  it("copies on a click anywhere on the surface", async () => {
    const onCopy = vi.fn();
    const { container } = view(onCopy);

    fireEvent.click(container.querySelector("[data-slot='input-group']")!);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(code));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("copies once when the button is clicked, not twice through the surface", async () => {
    const onCopy = vi.fn();
    view(onCopy);

    fireEvent.click(screen.getByLabelText("Copy"));

    await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("keeps the text selectable — a drag does not copy", () => {
    const { container } = view();
    const selection = { isCollapsed: false } as Selection;
    const getSelection = vi.spyOn(window, "getSelection").mockReturnValue(selection);

    fireEvent.click(container.querySelector("[data-slot='input-group']")!);

    expect(writeText).not.toHaveBeenCalled();
    getSelection.mockRestore();
  });
});
