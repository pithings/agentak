import { render } from "preact";
import { AgentChat } from "@/agent-chat";
import type { ChatSession } from "@/session";
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
 *
 * One attribute: `generate-title` asks the model to name the conversation
 * instead of taking the name from the first message. It costs one request.
 *
 * The element carries no loop of its own — `defineAgentChat` hands it the
 * session to run, so this module knows nothing about pi. `agentak/element`
 * supplies the built-in one.
 */
export class AgentChatElement extends HTMLElement {
  static observedAttributes = ["generate-title"];

  /**
   * The harness, set by `defineAgentChat` — one call per element, on connect. A
   * session assigned to `session` wins over it. It is optional only because a
   * `customElements.define` of this class cannot pass one; connecting such an
   * element throws rather than paints an empty box.
   */
  createSession?: () => ChatSession;

  #root: ShadowRoot;
  #session?: ChatSession;
  /** Made here, so disposed here. A host's own session is the host's to end. */
  #owned = false;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  /**
   * What runs this element, for a host holding a session rather than a factory:
   * `document.querySelector("agent-chat").session = mine`. It can be set before
   * the element lands or after, and it wins over the registered factory.
   */
  get session(): ChatSession | undefined {
    return this.#session;
  }

  set session(session: ChatSession | undefined) {
    if (this.#owned) this.#session?.dispose?.();
    this.#session = session;
    this.#owned = false;
    if (this.isConnected) this.#render();
  }

  connectedCallback() {
    if (!this.style.display) this.style.display = "block";
    if (!this.#session) {
      // A session is not optional. `defineAgentChat` requires one, so this is
      // only reached by a `customElements.define` of the class itself — and a
      // surface that paints nothing is the worst way to say so. A throw would
      // not reach the caller either: the browser reports an exception from a
      // reaction callback and carries on.
      if (!this.createSession) {
        console.error(
          `<${this.localName}> has no session. Register the tag with ` +
            `defineAgentChat({ session }), or set the element's \`session\`.`,
        );
        return;
      }
      this.#session = this.createSession();
      this.#owned = true;
    }
    this.#render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  disconnectedCallback() {
    render(null, this.#root);
    if (!this.#owned) return;
    this.#session?.dispose?.();
    this.#session = undefined;
    this.#owned = false;
  }

  // A second render into the same root is a diff, so the transcript survives an
  // attribute change.
  #render() {
    if (!this.#session) return; // set before the element landed, and not yet connected
    render(
      <AgentChat
        actions={<slot name="actions" style={u.contents} />}
        emptyActions={<slot name="empty" style={u.contents} />}
        generateTitle={this.hasAttribute("generate-title")}
        session={this.#session}
        style={u.fill}
      />,
      this.#root,
    );
  }
}

export interface DefineAgentChatOptions {
  /**
   * The tag to register. Default `agent-chat` — the built-in name is not
   * reserved for the built-in loop, so a host harness can take it.
   */
  tag?: string;
  /** What runs the chat. One call per element. */
  session: () => ChatSession;
}

/**
 * Registers the tag, over the session it should run.
 *
 * This module does not call it — `agentak/element` is the entry that does, with
 * `createPiSession`, so nothing registers a tag and nothing pulls in a loop as a
 * side effect of importing the class. A host with its own harness calls this
 * itself, and pi never loads.
 *
 * The factory is held on a subclass rather than a module variable, so a second
 * tag over a second harness does not overwrite the first.
 */
export function defineAgentChat({ tag = TAG, session }: DefineAgentChatOptions) {
  if (customElements.get(tag)) return;
  customElements.define(
    tag,
    class extends AgentChatElement {
      createSession = session;
    },
  );
}
