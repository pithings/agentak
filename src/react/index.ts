import { type CSSProperties, createElement, type ReactElement, useEffect, useRef } from "react";

import { injectTokens } from "@/styles/inject";
import { type AgentakChatProps, type ChatMount, chatProps, HOST, mountChat } from "@/wrap";

export type { AgentakChatProps } from "@/wrap";

export interface ReactAgentakChatProps extends AgentakChatProps {
  className?: string;
  /** The box around the surface — this is where a size goes. */
  style?: CSSProperties;
}

/**
 * The chat, for a react app: the surface in a box the page sizes, with the `--*`
 * tokens declared on mount.
 *
 * It carries no loop. `session` is what runs it, and the import that makes one
 * is the host's:
 *
 * ```tsx
 * import { AgentakChat } from "agentak/react";
 * import { createPiSession } from "agentak/pi";
 *
 * const session = useMemo(() => createPiSession(), []);
 * <AgentakChat session={session} style={{ height: "600px" }} />
 * ```
 *
 * Whoever made the session ends it — this component never does.
 *
 * The surface itself is preact, so this renders one `<div>` that react owns and
 * preact fills. React never patches the children of that div, and preact never
 * looks outside it. `actions` and `emptyActions` are therefore preact children,
 * not react ones — build them with `h()` from preact, or leave them out.
 */
export function AgentakChat(props: ReactAgentakChatProps): ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const island = useRef<ChatMount | undefined>(undefined);
  // The mount effect runs once and must not hold the props of that one render.
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const target = host.current;
    if (!target) return;
    if (latest.current.tokens !== false) injectTokens(target.ownerDocument);

    const mount = mountChat(target, chatProps(latest.current));
    island.current = mount;
    return () => {
      island.current = undefined;
      mount.unmount();
    };
  }, []);

  // Every render of the host is a render of the island — one preact diff, which
  // is also how a new `session` reaches the surface.
  useEffect(() => {
    island.current?.update(chatProps(props));
  });

  return createElement("div", {
    className: props.className,
    ref: host,
    style: { ...HOST, ...props.style },
  });
}
