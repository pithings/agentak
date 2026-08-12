import { render } from "preact";
import { WebAgent } from "@/web-agent";
import { u } from "@/styles/base";
import { adoptStyles } from "@/styles/sheet";

const TAG = "web-agent";

/**
 * `<web-agent>` — the library's public surface.
 *
 * Renders into a shadow root so host page styles cannot leak in. The stylesheet
 * is built in JS and adopted by that root alone, so nothing leaks out either.
 */
export class WebAgentElement extends HTMLElement {
  #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    adoptStyles(this.#root);
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
