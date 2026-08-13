import type { ComponentChildren } from "preact";

import { AgentChat } from "@/components/chat";
import type { Sx } from "@/styles/sx";

import { useDemoChat } from "./demo-chat";
// Registers the demo renderers the canned turns reach for. Side effect.
import "./demo-elements";

/**
 * `<WebAgent>` without the loop: the canned turns, replayed. It lived in
 * `web-agent.tsx` as the `demo` prop; the fixtures are demo-only, so the
 * component is too.
 */
export function DemoAgent({
  className,
  style,
  autoStart,
  actions,
}: {
  className?: string;
  style?: Sx;
  /** Stream every canned turn on mount. */
  autoStart?: boolean;
  /** Host chrome for the end of the header — see `chat-actions.tsx`. */
  actions?: ComponentChildren;
}) {
  const chat = useDemoChat({ autoStart });

  return (
    <AgentChat
      actions={actions}
      className={className}
      isStreaming={chat.isStreaming}
      messages={chat.messages}
      onReset={chat.reset}
      onSend={chat.send}
      onStop={chat.stop}
      style={style}
    />
  );
}
