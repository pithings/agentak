// Docs: @docs/3.widget.md
import { type Attributes, type ComponentType, h, render } from "preact";

import { AgentChat, type AgentChatProps } from "./agent-chat.tsx";
import type { ChatProps } from "./components/chat.tsx";
import { injectTokens } from "./styles/inject.ts";
import type { Sx } from "./styles/sx.ts";

/**
 * What the three framework wrappers share — `agentak/preact`, `agentak/react`
 * and `agentak/vue`.
 *
 * Each one exports two components over the two surfaces the root entry has:
 * `ChatPanel` over `AgentChat`, which a session drives, and `ChatView` over
 * `Chat`, which the host drives with a transcript and callbacks. A wrapper is
 * that surface, mounted the way a host framework mounts things: its own element
 * to size, the tokens declared, and the preact tree inside.
 *
 * Neither is the loop. `session` is required on `ChatPanel` exactly as it is on
 * `AgentChat`, so a host names its harness itself — `createPiSession()` from
 * `agentak/pi` is one import, and it is the import that decides whether pi is in
 * the bundle.
 */
export interface ChatHostProps {
  /** Declare the `--*` tokens on the page. Default: yes. */
  tokens?: boolean;
}

/**
 * `ChatPanel`, in every framework: `AgentChat` without the box it renders
 * itself. `className` and `style` belong to the host element instead, and each
 * wrapper declares them in its own framework's terms.
 */
export interface ChatPanelProps
  extends Omit<AgentChatProps, "className" | "style">, ChatHostProps {}

/** `ChatView`, in every framework: `Chat`, on the same terms. */
export interface ChatViewProps extends Omit<ChatProps, "className" | "style">, ChatHostProps {}

/** The box the host sizes: a column, with the surface as its one row. */
export const HOST = {
  display: "flex",
  flexDirection: "column",
  minWidth: "0",
  minHeight: "0",
} as const;

/** The surface inside it. `auto` rather than `0`, so an unsized host still shows. */
const SURFACE: Sx = { flex: "1 1 auto" };

/** What a wrapper's props become once its own element has taken its share. */
export type SurfaceProps<P> = Omit<P, keyof ChatHostProps | "className" | "style"> & { style: Sx };

/** The surface a wrapper mounts: `AgentChat` for a panel, `Chat` for a view. */
export type Surface<P> = ComponentType<SurfaceProps<P>>;

/**
 * The surface's props, from the wrapper's: what the wrapper keeps for the
 * element it owns — the tokens flag and the host's own box — stops here, and the
 * rest goes through untouched.
 */
export function surfaceProps<P extends ChatHostProps>(props: P): SurfaceProps<P> {
  const {
    tokens: _tokens,
    className: _className,
    style: _style,
    ...surface
  } = props as P & {
    className?: unknown;
    style?: unknown;
  };
  return { ...surface, style: SURFACE } as SurfaceProps<P>;
}

export interface ChatMount<P = AgentChatProps> {
  /** Redraw the island. One preact diff — the transcript is untouched. */
  update(props: P): void;
  unmount(): void;
}

/**
 * A preact island in a tree that is not preact.
 *
 * React and vue each own the element; preact fills it and neither host ever
 * patches its children, so the two renderers never fight over the same nodes.
 * The surface is a parameter, because a wrapper mounts whichever of the two it
 * is — `AgentChat` for `ChatPanel`, `Chat` for `ChatView`.
 */
export function mountIsland<P>(target: Element, surface: ComponentType<P>, props: P): ChatMount<P> {
  // `Attributes` is `key` and `ref`, both optional: a cast, because the props
  // are the surface's own and this one is generic over them.
  const draw = (next: P) => render(h(surface, next as Attributes & P), target);
  draw(props);
  return {
    update: draw,
    unmount: () => render(null, target),
  };
}

export interface MountChatOptions extends AgentChatProps {
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
 * import { mountChat } from "agentak";
 * import { createPiSession } from "agentak/pi";
 *
 * const chat = mountChat("#chat", { session: createPiSession() });
 * ```
 *
 * `target` is an element or a selector. Size that element — the surface fills
 * it. `update()` redraws with new props, `unmount()` empties the element;
 * neither ends the session, because this never made one.
 */
export function mountChat(target: Element | string, props: MountChatOptions): ChatMount {
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) throw new Error(`agentak: no element for ${String(target)}`);

  if (props.tokens !== false) injectTokens(element.ownerDocument);
  // The host box, as the wrappers set it on the div they own themselves.
  if (element instanceof HTMLElement) Object.assign(element.style, HOST);

  const island = mountIsland(element, AgentChat, { style: SURFACE, ...props });
  return {
    update: (next) => island.update({ style: SURFACE, ...next }),
    unmount: island.unmount,
  };
}
