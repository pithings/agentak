import type { ComponentProps } from "preact";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { ChatComposer } from "../../src/components/chat/composer.tsx";

afterEach(cleanup);

const MODELS = [
  { contextWindow: 400_000, id: "gpt-5", name: "GPT-5" },
  { contextWindow: 200_000, id: "gpt-5-mini", name: "GPT-5 mini" },
];

const PROVIDERS = [{ id: "openai", label: "OpenAI" }];

const composer = (props: Partial<ComponentProps<typeof ChatComposer>> = {}) => (
  <ChatComposer
    isStreaming={false}
    modelId="gpt-5"
    models={MODELS}
    onSend={() => {}}
    onStop={() => {}}
    providerId="openai"
    providers={PROVIDERS}
    {...props}
  />
);

describe("ChatComposer", () => {
  it("names the model and asks the surface for the settings page", () => {
    const opened: boolean[] = [];
    render(composer({ onPickerOpenChange: (open) => opened.push(open) }));

    // A model id says nothing about where it runs, so the provider comes with it.
    const trigger = screen.getByRole("button", { name: /GPT-5/ });
    expect(trigger.textContent).toBe("GPT-5 (OpenAI)");

    // The trigger opens nothing itself — the page stands where the transcript
    // is, which only `Chat` can answer for.
    fireEvent.click(trigger);
    expect(opened).toEqual([true]);
  });

  it("goes away under the settings page and keeps what was typed", () => {
    const { container, rerender } = render(composer());
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    field.value = "half a message";

    rerender(composer({ hidden: true }));
    // Hidden, not unmounted: the textarea is uncontrolled, so the draft only
    // survives the page while the element does.
    expect((container.firstElementChild as HTMLElement).style.display).toBe("none");
    expect(screen.getByRole("textbox", { hidden: true })).toBe(field);
    expect(field.value).toBe("half a message");
  });

  it("gives the focus to the textarea when the settings page closes", async () => {
    const { rerender } = render(composer({ pickerOpen: true }));
    expect((document.activeElement as HTMLElement)?.tagName).not.toBe("TEXTAREA");

    rerender(composer({ pickerOpen: false }));
    await Promise.resolve();
    expect((document.activeElement as HTMLElement)?.tagName).toBe("TEXTAREA");
  });

  it("gives the focus to the textarea when the surface asks for it", async () => {
    // The mount is not a request: the chat would take the focus off the page.
    const { rerender } = render(composer({ focusKey: 0 }));
    await Promise.resolve();
    expect((document.activeElement as HTMLElement)?.tagName).not.toBe("TEXTAREA");

    rerender(composer({ focusKey: 1 }));
    await Promise.resolve();
    expect((document.activeElement as HTMLElement)?.tagName).toBe("TEXTAREA");
  });

  it("takes the focus on mount where the host asks for it", async () => {
    // A surface that is the whole document — the side panel — was opened to be
    // typed in, so there it is a request after all.
    render(composer({ autoFocus: true }));
    await Promise.resolve();
    expect((document.activeElement as HTMLElement)?.tagName).toBe("TEXTAREA");
  });

  it("lists the slash commands the surface can answer", () => {
    render(composer({ onReset: () => {} }));
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;

    // Nothing until a slash, and a message is never a command.
    fireEvent.input(field, { target: { value: "hello" } });
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();

    fireEvent.input(field, { target: { value: "/" } });
    const shown = screen.getByRole("listbox", { name: "Commands" });
    expect(shown.textContent).toContain("/model");
    expect(shown.textContent).toContain("/new");

    // Half a name leaves the one command it can be.
    fireEvent.input(field, { target: { value: "/mo" } });
    expect(screen.getByRole("listbox", { name: "Commands" }).textContent).toContain("/model");
    expect(screen.getByRole("listbox", { name: "Commands" }).textContent).not.toContain("/new");

    // A word that names none is a message, so the list goes.
    fireEvent.input(field, { target: { value: "/nope" } });
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
  });

  it("offers only the commands it was given the means to run", () => {
    // No providers and no models is nothing to choose between, so no `/model`.
    render(
      <ChatComposer isStreaming={false} onSend={() => {}} onStop={() => {}} onReset={() => {}} />,
    );

    fireEvent.input(screen.getByRole("textbox"), { target: { value: "/" } });
    const shown = screen.getByRole("listbox", { name: "Commands" });
    expect(shown.textContent).toContain("/new");
    expect(shown.textContent).not.toContain("/model");
  });

  it("runs a slash command instead of sending it", () => {
    const sent: string[] = [];
    const opened: boolean[] = [];
    let reset = 0;
    render(
      composer({
        onPickerOpenChange: (open) => opened.push(open),
        onReset: () => {
          reset += 1;
        },
        onSend: (text) => sent.push(text),
      }),
    );

    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    const submit = () => fireEvent.submit(field.closest("form") as HTMLFormElement);

    field.value = "/model";
    fireEvent.input(field, { target: { value: "/model" } });
    submit();
    expect(opened).toEqual([true]);
    expect(field.value).toBe("");

    // The name half-typed runs the one command it can be.
    field.value = "/ne";
    fireEvent.input(field, { target: { value: "/ne" } });
    submit();
    expect(reset).toBe(1);

    // Nothing was said to the agent, and a message that only starts with a
    // slash still is one.
    field.value = "/etc is a folder";
    fireEvent.input(field, { target: { value: "/etc is a folder" } });
    submit();
    expect(sent).toEqual(["/etc is a folder"]);
  });

  it("walks the command list with the arrows and runs the row Enter is on", () => {
    const sent: string[] = [];
    const opened: boolean[] = [];
    let reset = 0;
    render(
      composer({
        onPickerOpenChange: (open) => opened.push(open),
        onReset: () => {
          reset += 1;
        },
        onSend: (text) => sent.push(text),
      }),
    );

    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    field.value = "/";
    fireEvent.input(field, { target: { value: "/" } });

    const rows = () => screen.getAllByRole("option");
    const lit = () => rows().find((row) => row.getAttribute("aria-selected") === "true");
    // The head of the list to start with, and the field says which row it is on.
    expect(lit()?.textContent).toContain("/model");
    expect(field.getAttribute("aria-activedescendant")).toBe(lit()?.id);

    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(lit()?.textContent).toContain("/new");

    // Past the end is the head again, and the same the other way.
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(lit()?.textContent).toContain("/model");
    fireEvent.keyDown(field, { key: "ArrowUp" });
    expect(lit()?.textContent).toContain("/new");

    // Enter runs the row, not what the field spells — and nothing is sent.
    fireEvent.keyDown(field, { key: "Enter" });
    expect(reset).toBe(1);
    expect(sent).toEqual([]);
    expect(opened).toEqual([]);
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
  });

  it("writes the rest of the name on Tab and leaves the running to Enter", () => {
    const opened: boolean[] = [];
    render(composer({ onPickerOpenChange: (open) => opened.push(open), onReset: () => {} }));

    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    field.value = "/m";
    fireEvent.input(field, { target: { value: "/m" } });

    fireEvent.keyDown(field, { key: "Tab" });
    expect(field.value).toBe("/model");
    expect(opened).toEqual([]);
    // The one row it can be now, still under the cursor.
    expect(screen.getAllByRole("option")).toHaveLength(1);

    fireEvent.keyDown(field, { key: "Enter" });
    expect(opened).toEqual([true]);
  });

  it("leaves the keys to the field once the list is shut", () => {
    const sent: string[] = [];
    render(composer({ onReset: () => {}, onSend: (text) => sent.push(text) }));

    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    field.value = "hello";
    fireEvent.input(field, { target: { value: "hello" } });

    // No list, so no row for Enter to run: the message is sent as it always was.
    const enter = fireEvent.keyDown(field, { key: "Enter" });
    expect(enter).toBe(false); // The composer's own Enter took it and submitted.
    expect(sent).toEqual(["hello"]);
  });

  it("puts the command list away on Escape and keeps what was typed", () => {
    render(composer({ onReset: () => {} }));
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;

    fireEvent.input(field, { target: { value: "/m" } });
    expect(screen.getByRole("listbox", { name: "Commands" })).toBeTruthy();

    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
    expect(field.value).toBe("/m");
  });

  it("says so in the meter when the window is nearly spent", () => {
    const meter = (nearLimit: boolean) => (
      <ChatComposer
        isStreaming={false}
        onSend={() => {}}
        onStop={() => {}}
        usage={{ maxTokens: 200_000, nearLimit, usedTokens: 190_000 }}
      />
    );

    const { rerender } = render(meter(false));
    // The ring reads the same either way; only the warning is new.
    const ring = screen.getByRole("img", { name: /95%$/ });
    fireEvent.click(ring.closest("button") as HTMLButtonElement);
    expect(screen.queryByText(/Near the context limit/)).toBeNull();

    rerender(meter(true));
    expect(screen.getByRole("img", { name: /near the limit/ })).toBeTruthy();
    expect(screen.getByText(/Near the context limit/)).toBeTruthy();
  });
});
