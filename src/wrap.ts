import { type ComponentChildren, h, render } from "preact";

import { AgentChat, type AgentChatProps } from "@/agent-chat";
import type { ChatSession, ChatSessionOptions } from "@/session";
import { injectTokens } from "@/styles/inject";
import type { Sx } from "@/styles/sx";

/**
 * What the three framework wrappers share — `agentak/preact`, `agentak/react`
 * and `agentak/vue`.
 *
 * A wrapper is the surface, mounted the way a host framework mounts things: its
 * own element to size, the tokens declared, and the preact tree inside. It is
 * NOT the loop. `session` is required here exactly as it is on `AgentChat`, so
 * a host names its harness itself — `createPiSession()` from `agentak/pi` is
 * one import, and it is the import that decides whether pi is in the bundle.
 */
export interface AgentakChatProps extends ChatSessionOptions {
  /** What runs the chat. `createPiSession()` from `agentak/pi` is the built-in one. */
  session: ChatSession;
  /** Buttons for the end of the header. Preact children — `h()` builds them. */
  actions?: ComponentChildren;
  /** Content for the empty state, under the greeting. Preact children. */
  emptyActions?: ComponentChildren;
  /** Declare the `--*` tokens on the page. Default: yes. */
  tokens?: boolean;
}

/** The box the host sizes: a column, with the surface as its one row. */
export const HOST = {
  display: "flex",
  flexDirection: "column",
  minWidth: "0",
  minHeight: "0",
} as const;

/** The surface inside it. `auto` rather than `0`, so an unsized host still shows. */
const SURFACE: Sx = { flex: "1 1 auto" };

/** The surface's props, from the wrapper's. The host's own box is outside it. */
export function chatProps(props: AgentakChatProps): AgentChatProps {
  return {
    actions: props.actions,
    emptyActions: props.emptyActions,
    generateTitle: props.generateTitle,
    session: props.session,
    style: SURFACE,
  };
}

export interface ChatMount {
  /** Redraw the island. One preact diff — the transcript is untouched. */
  update(props: AgentChatProps): void;
  unmount(): void;
}

/**
 * A preact island in a tree that is not preact.
 *
 * React and vue each own the element; preact fills it and neither host ever
 * patches its children, so the two renderers never fight over the same nodes.
 */
export function mountChat(target: Element, props: AgentChatProps): ChatMount {
  const draw = (next: AgentChatProps) => render(h(AgentChat, next), target);
  draw(props);
  return {
    update: draw,
    unmount: () => render(null, target),
  };
}

export interface MountOptions extends AgentChatProps {
  /** Declare the `--*` tokens on the page. Default: yes. */
  tokens?: boolean;
}

/**
 * The chat in a plain page, in one call: the tokens declared, the element made
 * a box the surface fills, and the surface inside it.
 *
 * It is what the framework wrappers do, for a host that has no framework — a
 * CDN `<script type="module">` needs no preact import of its own:
 *
 * ```js
 * import { mount } from "agentak";
 * import { createPiSession } from "agentak/pi";
 *
 * const chat = mount("#chat", { session: createPiSession() });
 * ```
 *
 * `target` is an element or a selector. Size that element — the surface fills
 * it. `update()` redraws with new props, `unmount()` empties the element;
 * neither ends the session, because this never made one.
 */
export function mount(target: Element | string, props: MountOptions): ChatMount {
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) throw new Error(`agentak: no element for ${String(target)}`);

  if (props.tokens !== false) injectTokens(element.ownerDocument);
  // The host box, as the wrappers set it on the div they own themselves.
  if (element instanceof HTMLElement) Object.assign(element.style, HOST);

  const island = mountChat(element, { style: SURFACE, ...props });
  return {
    update: (next) => island.update({ style: SURFACE, ...next }),
    unmount: island.unmount,
  };
}
