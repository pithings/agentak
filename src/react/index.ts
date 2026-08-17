// Docs: @docs/3.widget.md
import { type CSSProperties, createElement, type ReactElement, useEffect, useRef } from "react";

import { AgentChat } from "../agent-chat.tsx";
import { Chat } from "../components/chat.tsx";
import { injectTokens } from "../styles/inject.ts";
import {
  type ChatHostProps,
  type ChatMount,
  type ChatPanelProps as BasePanelProps,
  type ChatViewProps as BaseViewProps,
  HOST,
  mountIsland,
  type Surface,
  type SurfaceProps,
  surfaceProps,
} from "../wrap.ts";

/** The box around the surface — `className` and `style` are where a size goes. */
interface ReactHost {
  className?: string;
  style?: CSSProperties;
}

export interface ChatPanelProps extends BasePanelProps, ReactHost {}
export interface ChatViewProps extends BaseViewProps, ReactHost {}

/**
 * One `<div>` react owns, with a preact island inside it — the whole of both
 * components, over whichever surface they were given.
 *
 * React never patches the children of that div, and preact never looks outside
 * it, so the two renderers never fight over the same nodes.
 */
function useIsland<P extends ChatHostProps>(surface: Surface<P>, props: P) {
  const host = useRef<HTMLDivElement>(null);
  const island = useRef<ChatMount<SurfaceProps<P>> | undefined>(undefined);
  // The mount effect runs once and must not hold the props of that one render.
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    if (latest.current.tokens !== false) injectTokens(target.ownerDocument);

    const mount = mountIsland(target, surface, surfaceProps(latest.current));
    island.current = mount;
    return () => {
      island.current = undefined;
      mount.unmount();
    };
  }, []);

  // Every render of the host is a render of the island — one preact diff, which
  // is also how a new `session` reaches the surface.
  useEffect(() => {
    island.current?.update(surfaceProps(props));
  });

  return host;
}

/**
 * The chat, for a react app: the surface in a box the page sizes, with the `--*`
 * tokens declared on mount.
 *
 * It carries no loop. `session` is what runs it, and the import that makes one
 * is the host's:
 *
 * ```tsx
 * import { ChatPanel } from "agentak/react";
 * import { createPiSession } from "agentak/pi";
 *
 * const session = useMemo(() => createPiSession(), []);
 * <ChatPanel session={session} style={{ height: "600px" }} />
 * ```
 *
 * Whoever made the session ends it — this component never does.
 *
 * `actions` and `emptyActions` are preact children, not react ones — build them
 * with `h()` from preact, or leave them out.
 */
export function ChatPanel(props: ChatPanelProps): ReactElement {
  const host = useIsland(AgentChat, props);

  return createElement("div", {
    className: props.className,
    ref: host,
    style: { ...HOST, ...props.style },
  });
}

/**
 * The chat, for a react app that runs the conversation itself: `Chat` in a box
 * the page sizes, with the `--*` tokens declared on mount.
 *
 * Nothing stands behind it. The transcript, the streaming flag and the
 * callbacks are the host's, so an app with its own store or its own transport
 * takes the surface and no session at all:
 *
 * ```tsx
 * import { ChatView } from "agentak/react";
 *
 * <ChatView
 *   isStreaming={busy}
 *   messages={messages}
 *   onReset={clear}
 *   onSend={send}
 *   onStop={stop}
 *   style={{ height: "600px" }}
 * />
 * ```
 */
export function ChatView(props: ChatViewProps): ReactElement {
  const host = useIsland(Chat, props);

  return createElement("div", {
    className: props.className,
    ref: host,
    style: { ...HOST, ...props.style },
  });
}
