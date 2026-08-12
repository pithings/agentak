import { render } from "preact";
import { WebAgent } from "@/web-agent";
import { u } from "@/styles/base";

const TAG = "web-agent";

/**
 * `<web-agent>` — the library's public surface.
 *
 * Renders into a shadow root so host page styles cannot leak in, and adopts no
 * stylesheet of its own, so nothing leaks out either — every style is inline on
 * the element that carries it.
 *
 * The exception is the `--wa-*` tokens, which the host page declares: a custom
 * property inherits, and inheritance crosses the shadow boundary. Export
 * `tokens` from the package root is the text to declare. Without it every
 * `var()` resolves to nothing and the tree renders unpainted.
 *
 * `display` is set here rather than by a `:host` rule for the same reason. It is
 * only a default — a host that sets its own inline `display` keeps it.
 */
export class WebAgentElement extends HTMLElement {
  #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    if (!this.style.display) this.style.display = "block";
    render(<WebAgent style={u.fill} />, this.#root);
  }

  disconnectedCallback() {
    render(null, this.#root);
  }
}

export function defineWebAgent(tag = TAG) {
  if (!customElements.get(tag)) customElements.define(tag, WebAgentElement);
}

defineWebAgent();
