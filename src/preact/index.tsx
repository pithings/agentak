// Docs: @docs/3.widget.md
import { useLayoutEffect } from "preact/hooks";

import { AgentChat } from "../agent-chat.tsx";
import { Chat } from "../components/chat.tsx";
import { injectTokens } from "../styles/inject.ts";
import { sx, type Sx } from "../styles/sx.ts";
import {
  type ChatPanelProps as BasePanelProps,
  type ChatViewProps as BaseViewProps,
  HOST,
  surfaceProps,
} from "../wrap.ts";

/** The box around the surface — `className` and `style` are where a size goes. */
interface PreactHost {
  className?: string;
  style?: Sx;
}

export interface ChatPanelProps extends BasePanelProps, PreactHost {}
export interface ChatViewProps extends BaseViewProps, PreactHost {}

/** The tokens, before the paint: the surface reads them the moment it renders. */
function useTokens(declare?: boolean) {
  useLayoutEffect(() => {
    if (declare !== false) injectTokens();
  }, []);
}

/**
 * The chat, for a preact app: `AgentChat` in a box the page sizes, with the
 * `--*` tokens declared on mount.
 *
 * It carries no loop. `session` is what runs it, and the import that makes one
 * is the host's:
 *
 * ```tsx
 * import { ChatPanel } from "agentak/preact";
 * import { createPiSession } from "agentak/pi";
 *
 * const session = createPiSession();
 * <ChatPanel session={session} style={{ height: "600px" }} />
 * ```
 *
 * Whoever made the session ends it — this component never does.
 */
export function ChatPanel({ className, style, ...props }: ChatPanelProps) {
  useTokens(props.tokens);

  return (
    <div className={className} style={sx(HOST, style)}>
      <AgentChat {...surfaceProps(props)} />
    </div>
  );
}

/**
 * The chat, for a preact app that runs the conversation itself: `Chat` in a box
 * the page sizes, with the `--*` tokens declared on mount.
 *
 * Nothing stands behind it. The transcript, the streaming flag and the
 * callbacks are the host's, so an app with its own store or its own transport
 * takes the surface and no session at all:
 *
 * ```tsx
 * import { ChatView } from "agentak/preact";
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
export function ChatView({ className, style, ...props }: ChatViewProps) {
  useTokens(props.tokens);

  return (
    <div className={className} style={sx(HOST, style)}>
      <Chat {...surfaceProps(props)} />
    </div>
  );
}
