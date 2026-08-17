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

const AGENT = {
  instructions: "Be useful.",
  name: "Assistant",
  tools: [
    { description: "Read the current page", name: "read_page" },
    { description: "Take a picture of it", name: "screenshot" },
  ],
};

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
  it("is a field and a send button, and nothing else", () => {
    render(composer());
    // What is running and every button the surface owns are one row down, in
    // the bar — see `bar.test.tsx`.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("aria-label")).toBe("Submit");
  });

  it("keeps send on the field's row until the message is more than one line", () => {
    render(composer());
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    const send = () => screen.getByRole("button", { name: "Submit" });
    const row = () => send().parentElement as HTMLElement;

    // One line: the field and the button are the same row, and the box around
    // them is a pill.
    expect(row().contains(field)).toBe(true);
    const box = field.closest('[data-slot="input-group"]') as HTMLElement;
    expect(box.style.borderRadius).toBe("999px");

    // More than one: the button moves under the field, and the pill is a box.
    fireEvent.input(field, { target: { value: "one\ntwo" } });
    expect(row().contains(field)).toBe(false);
    expect(row().dataset.slot).toBe("input-group-addon");
    expect(box.style.borderRadius).not.toBe("999px");

    // And back, once the second line goes.
    fireEvent.input(field, { target: { value: "one" } });
    expect(row().contains(field)).toBe(true);
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

  it("lists the agent's tools under the commands", () => {
    render(composer({ agent: AGENT, onReset: () => {} }));
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;

    fireEvent.input(field, { target: { value: "/" } });
    // The two verbs first, then what the model can do.
    expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual([
      "/modelProvider, model and thinking level",
      "/newStart a new conversation",
      "/read_pageRead the current page",
      "/screenshotTake a picture of it",
    ]);

    // A tool is found by the same half-typed name a command is.
    fireEvent.input(field, { target: { value: "/read" } });
    const shown = screen.getAllByRole("option");
    expect(shown).toHaveLength(1);
    expect(shown[0].textContent).toContain("/read_page");
  });

  it("runs the tool the cursor is on, and clears the field", () => {
    const called: string[] = [];
    const sent: string[] = [];
    render(
      composer({
        agent: AGENT,
        onCallTool: (name) => called.push(name),
        onSend: (text) => sent.push(text),
      }),
    );

    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    field.value = "/read";
    fireEvent.input(field, { target: { value: "/read" } });
    fireEvent.keyDown(field, { key: "Enter" });

    // The harness runs it and the model reads the result, so the row was the
    // whole of what was being asked — nothing is left to say.
    expect(called).toEqual(["read_page"]);
    expect(sent).toEqual([]);
    expect(field.value).toBe("");
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
  });

  it("writes a tool's name rather than running it while the model is working", () => {
    const called: string[] = [];
    render(composer({ agent: AGENT, isStreaming: true, onCallTool: (name) => called.push(name) }));

    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    field.value = "/read";
    fireEvent.input(field, { target: { value: "/read" } });
    fireEvent.keyDown(field, { key: "Enter" });

    // The transcript belongs to the turn that is running, so the row falls back
    // to the name and the message queues behind it.
    expect(called).toEqual([]);
    expect(field.value).toBe("read_page ");
  });

  it("writes a tool's name into the message where nothing can run it", () => {
    const sent: string[] = [];
    render(composer({ agent: AGENT, onSend: (text) => sent.push(text) }));

    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    field.value = "/read";
    fireEvent.input(field, { target: { value: "/read" } });
    fireEvent.keyDown(field, { key: "Enter" });

    // The slash was how the tool was found, not part of what is said, and the
    // caret is after the name because the message is not finished.
    expect(field.value).toBe("read_page ");
    expect(field.selectionStart).toBe("read_page ".length);
    expect(sent).toEqual([]);
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();

    // What is typed after it is one message, sent as it was written.
    field.value = "read_page and tell me what it says";
    fireEvent.submit(field.closest("form") as HTMLFormElement);
    expect(sent).toEqual(["read_page and tell me what it says"]);
  });

  it("keeps a name the commands already use", () => {
    // Two rows spelt the same would be one question with two answers, and only
    // the command is a thing this surface runs.
    render(
      composer({
        agent: { ...AGENT, tools: [{ description: "Not this one", name: "model" }] },
        onReset: () => {},
      }),
    );

    fireEvent.input(screen.getByRole("textbox"), { target: { value: "/model" } });
    const shown = screen.getAllByRole("option");
    expect(shown).toHaveLength(1);
    expect(shown[0].textContent).toContain("Provider, model and thinking level");
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
});
