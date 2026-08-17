import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { Chat } from "../../src/components/chat.tsx";
import type { ChatProps } from "../../src/components/chat.tsx";
import type { ChatAgent } from "../../src/components/chat/types.ts";

afterEach(cleanup);

const AGENT: ChatAgent = {
  instructions: "You are an assistant embedded in a web page.",
  model: "Gemini 2.5 Flash",
  name: "Assistant",
  tools: [
    {
      description: "Read the text of the tab in front.",
      inputSchema: { properties: {}, type: "object" },
      name: "read_active_tab",
    },
    { description: "Say what the weather is.", name: "get_weather" },
  ],
};

/**
 * A closed row keeps its body in the DOM, hidden — so `hidden` is the test, and
 * any closed row over this one hides it as surely as its own does.
 */
const shown = (text: string) =>
  !screen.getByText(text).closest("[data-slot='accordion-content'][hidden]");

const surface = (props: Partial<ChatProps> = {}) =>
  render(
    <Chat
      isStreaming={false}
      messages={[]}
      onReset={() => {}}
      onSend={() => {}}
      onStop={() => {}}
      {...props}
    />,
  );

describe("the agent card", () => {
  it("names no agent over it — the greeting and the status bar say that already", () => {
    surface({ agent: AGENT });
    expect(screen.queryByText("Assistant")).toBeNull();
    expect(screen.queryByText("Gemini 2.5 Flash")).toBeNull();
  });

  it("keeps the instructions a click away, as a tool is", () => {
    surface({ agent: AGENT });
    expect(shown(AGENT.instructions)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Agent Instructions" }));
    expect(shown(AGENT.instructions)).toBe(true);
  });

  it("counts the tools on a row of their own, and lists them when it is opened", () => {
    surface({ agent: AGENT });

    const tools = screen.getByRole("button", { name: "Tools 2" });
    expect(shown("Read active tab")).toBe(false);

    fireEvent.click(tools);
    expect(shown("Read active tab")).toBe(true);
    expect(shown("Get weather")).toBe(true);
  });

  it("heads each tool with its name read out, and what it does a click away", () => {
    surface({ agent: AGENT });
    fireEvent.click(screen.getByRole("button", { name: "Tools 2" }));

    // `read_active_tab` is headed the way the call itself is headed, and the
    // name as written stays on the row for a pointer.
    const row = screen.getByRole("button", { name: "Read active tab" });
    expect(row.getAttribute("title")).toBe("read_active_tab");
    expect(shown("Read the text of the tab in front.")).toBe(false);

    fireEvent.click(row);
    expect(shown("Read the text of the tab in front.")).toBe(true);
    // The schema is reference for a catalog, not for an idle chat.
    expect(screen.queryByText(/"type": "object"/)).toBeNull();
  });

  it("leaves the tools row out where the loop carries none", () => {
    surface({ agent: { ...AGENT, tools: [] } });
    expect(screen.queryByRole("button", { name: /Tools/ })).toBeNull();
  });
});
