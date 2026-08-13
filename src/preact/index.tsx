import { useLayoutEffect } from "preact/hooks";

import { AgentChat } from "@/agent-chat";
import { injectTokens } from "@/styles/inject";
import { sx, type Sx } from "@/styles/sx";
import { type AgentakChatProps, chatProps, HOST } from "@/wrap";

export type { AgentakChatProps } from "@/wrap";

export interface PreactAgentakChatProps extends AgentakChatProps {
  className?: string;
  /** The box around the surface — this is where a size goes. */
  style?: Sx;
}

/**
 * The chat, for a preact app: `AgentChat` in a box the page sizes, with the
 * `--*` tokens declared on mount.
 *
 * It carries no loop. `session` is what runs it, and the import that makes one
 * is the host's:
 *
 * ```tsx
 * import { AgentakChat } from "agentak/preact";
 * import { createPiSession } from "agentak/pi";
 *
 * const session = createPiSession();
 * <AgentakChat session={session} style={{ height: "600px" }} />
 * ```
 *
 * Whoever made the session ends it — this component never does.
 */
export function AgentakChat({ className, style, ...props }: PreactAgentakChatProps) {
  // Before the paint: the surface reads the tokens the moment it renders.
  useLayoutEffect(() => {
    if (props.tokens !== false) injectTokens();
  }, []);

  return (
    <div className={className} style={sx(HOST, style)}>
      <AgentChat {...chatProps(props)} />
    </div>
  );
}
