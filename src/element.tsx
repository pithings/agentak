import { render } from "preact";
import { AgentChat } from "@/agent-chat";
import { u } from "@/styles/base";

const TAG = "agent-chat";

/**
 * `<agent-chat>` — the library's public surface.
 *
 * Renders into a shadow root so host page styles cannot leak in, and adopts no
 * stylesheet of its own, so nothing leaks out either — every style is inline on
 * the element that carries it.
 *
 * The exception is the `--*` tokens, which the host page declares: a custom
 * property inherits, and inheritance crosses the shadow boundary. Export
 * `tokens` from the package root is the text to declare. Without it every
 * `var()` resolves to nothing and the tree renders unpainted.
 *
 * `display` is set here rather than by a `:host` rule for the same reason. It is
 * only a default — a host that sets its own inline `display` keeps it.
 *
 * Light-DOM children with `slot="actions"` land at the end of the agent's
 * header, so the page can put its own chrome — a minimise button, a switch —
 * on the one title bar the chat already has. `slot="empty"` lands under the
 * greeting, before the first message, for a suggestion or a launcher. They are
 * the page's nodes, so the page's stylesheet paints them; only their place is
 * the library's.
 *
 * Both slots are `display: contents`, so an unfilled one takes no room.
 */
export class AgentChatElement extends HTMLElement {
  #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    if (!this.style.display) this.style.display = "block";
    render(
      <AgentChat
        actions={<slot name="actions" style={u.contents} />}
        emptyActions={<slot name="empty" style={u.contents} />}
        style={u.fill}
      />,
      this.#root,
    );
  }

  disconnectedCallback() {
    render(null, this.#root);
  }
}

export function defineAgentChat(tag = TAG) {
  if (!customElements.get(tag)) customElements.define(tag, AgentChatElement);
}

defineAgentChat();
