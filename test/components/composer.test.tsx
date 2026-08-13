import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { ChatComposer } from "@/components/chat/composer";

afterEach(cleanup);

const MODELS = [
  { contextWindow: 400_000, id: "gpt-5", name: "GPT-5" },
  { contextWindow: 200_000, id: "gpt-5-mini", name: "GPT-5 mini" },
];

const PROVIDERS = [{ id: "openai", label: "OpenAI" }];

const composer = () => (
  <ChatComposer
    isStreaming={false}
    modelId="gpt-5"
    models={MODELS}
    onSend={() => {}}
    onStop={() => {}}
    providerId="openai"
    providers={PROVIDERS}
  />
);

describe("ChatComposer", () => {
  it("gives the focus to the textarea when a model is chosen by click", async () => {
    render(composer());
    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    fireEvent.click(screen.getByText("GPT-5 mini"));

    await Promise.resolve();
    expect((document.activeElement as HTMLElement)?.tagName).toBe("TEXTAREA");
  });

  it("gives the focus to the textarea when a model is chosen by Enter", async () => {
    render(composer());
    fireEvent.click(screen.getByRole("button", { name: /GPT-5/ }));
    const search = screen.getByPlaceholderText("Search models…");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    await Promise.resolve();
    expect((document.activeElement as HTMLElement)?.tagName).toBe("TEXTAREA");
  });
});
