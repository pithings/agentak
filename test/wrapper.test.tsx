import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import { mountChat } from "@/index";
import { ChatPanel, ChatView } from "@/preact";
import type { ChatSession, ChatSnapshot } from "@/session";
import { type ChatPanelProps, ChatPanel as VueChatPanel, ChatView as VueChatView } from "@/vue";

afterEach(() => {
  cleanup();
  document.head.querySelector("style[data-agentak-tokens]")?.remove();
});

/**
 * A harness that answers the five required members, and counts its own end.
 * The snapshot is one object, not a fresh one per call — the rule every harness
 * keeps, and `useSession` says so in dev when one does not.
 */
function fakeSession(): ChatSession & { disposed: number; dispose(): void } {
  const snapshot: ChatSnapshot = { isStreaming: false, messages: [] };

  return {
    disposed: 0,
    subscribe: () => () => {},
    snapshot: () => snapshot,
    send() {},
    stop() {},
    reset() {},
    dispose() {
      this.disposed += 1;
    },
  };
}

describe("the framework wrapper", () => {
  it("mounts the surface and declares the tokens once", () => {
    const session = fakeSession();
    const { rerender } = render(<ChatPanel session={session} style={{ height: "600px" }} />);

    expect(screen.getByRole("textbox")).toBeTruthy();

    rerender(<ChatPanel session={session} style={{ height: "600px" }} />);
    const sheets = document.head.querySelectorAll("style[data-agentak-tokens]");
    expect(sheets.length).toBe(1);
    // First in the head: a page that declares the same names keeps them.
    expect(document.head.firstElementChild).toBe(sheets[0]);
    expect(sheets[0].textContent).toContain("--background");
  });

  it("leaves the tokens alone when the host says so", () => {
    render(<ChatPanel session={fakeSession()} tokens={false} />);
    expect(document.head.querySelector("style[data-agentak-tokens]")).toBeNull();
  });

  it("never ends the session — the host made it, the host ends it", () => {
    const session = fakeSession();
    const { unmount } = render(<ChatPanel session={session} />);
    unmount();
    expect(session.disposed).toBe(0);
  });
});

/** The other half of every wrapper: the surface a host drives itself. */
describe("the controlled wrapper", () => {
  it("mounts `Chat` with no session, and declares the tokens", () => {
    render(
      <ChatView
        isStreaming={false}
        messages={[]}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
      />,
    );

    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(document.head.querySelector("style[data-agentak-tokens]")).toBeTruthy();
  });

  it("passes the host's props through to the surface", () => {
    render(
      <ChatView
        isStreaming={false}
        messages={[{ id: "1", parts: [{ kind: "text", text: "hello" }], role: "user" }]}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        title="A title"
        tokens={false}
      />,
    );

    expect(screen.getByText("A title")).toBeTruthy();
    expect(screen.getByText("hello")).toBeTruthy();
    expect(document.head.querySelector("style[data-agentak-tokens]")).toBeNull();
  });
});

/** The framework-less mount: what a `<script type="module">` calls. */
describe("mountChat()", () => {
  const host = () => {
    const element = document.createElement("div");
    element.id = "chat";
    document.body.append(element);
    return element;
  };

  it("takes a selector, declares the tokens, and fills the element", () => {
    const element = host();
    const chat = mountChat("#chat", { session: fakeSession() });

    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(document.head.querySelector("style[data-agentak-tokens]")).toBeTruthy();
    // The host box, so the surface fills whatever height the page gave it.
    expect(element.style.display).toBe("flex");

    chat.unmount();
    expect(element.firstElementChild).toBeNull();
    element.remove();
  });

  it("redraws in place, and ends no session", () => {
    const element = host();
    const session = fakeSession();
    const chat = mountChat(element, { session, tokens: false });

    chat.update({ session });
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(document.head.querySelector("style[data-agentak-tokens]")).toBeNull();

    chat.unmount();
    expect(session.disposed).toBe(0);
    element.remove();
  });

  it("says so when the selector finds nothing", () => {
    expect(() => mountChat("#nowhere", { session: fakeSession() })).toThrow(/nowhere/);
  });
});

/**
 * The other renderer, mounted for real: a preact island inside vue is the half
 * of this package that no preact test reaches.
 */
describe("the vue wrapper", () => {
  const mount = (props: ChatPanelProps & { class?: string }) => {
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp(h(VueChatPanel, props));
    app.mount(host);
    return () => {
      app.unmount();
      host.remove();
    };
  };

  it("fills the element the page sizes, and ends with it", () => {
    const session = fakeSession();
    const unmount = mount({ class: "sized", session, tokens: false });

    // `class` falls through to the one div, which preact then fills.
    expect(document.querySelector(".sized")?.firstElementChild).toBeTruthy();
    expect(screen.getByRole("textbox")).toBeTruthy();

    unmount();
    expect(session.disposed).toBe(0);
  });

  it("declares the tokens when nobody says otherwise", () => {
    // A vue `Boolean` prop is `false` when absent, which would read as "no
    // tokens" — `default: undefined` is what keeps an absent flag absent.
    const unmount = mount({ session: fakeSession() });
    expect(document.head.querySelector("style[data-agentak-tokens]")).toBeTruthy();
    unmount();
  });

  it("mounts the controlled surface, and redraws it on a changed prop", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const title = ref("First");
    const app = createApp(() =>
      h(VueChatView, {
        isStreaming: false,
        messages: [],
        onReset: () => {},
        onSend: () => {},
        onStop: () => {},
        title: title.value,
        tokens: false,
      }),
    );
    app.mount(host);

    expect(screen.getByText("First")).toBeTruthy();

    // The callbacks are props here, not emits — a changed one redraws the
    // island the same way, because the watcher takes every prop by value.
    title.value = "Second";
    await nextTick();
    expect(screen.getByText("Second")).toBeTruthy();

    app.unmount();
    host.remove();
  });
});
