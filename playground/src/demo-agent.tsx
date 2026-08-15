import type { ComponentChildren } from "preact";

import { toTitle } from "@/pi/title.ts";
import { Chat } from "@/components/chat.tsx";
import type { Sx } from "@/styles/sx.ts";

import { useDemoChat } from "./demo-chat.ts";
// Registers the demo renderers the canned turns reach for. Side effect.
import "./demo-elements.tsx";

/**
 * `<AgentChat>` without the loop: the canned turns, replayed. It lived in
 * `agent-chat.tsx` as the `demo` prop; the fixtures are demo-only, so the
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
    <Chat
      actions={actions}
      className={className}
      isStreaming={chat.isStreaming}
      messages={chat.messages}
      onReset={chat.reset}
      onRespond={chat.respond}
      onSend={chat.send}
      onStop={chat.stop}
      style={style}
      // The canned turns reach no provider, so the derived title is the one
      // this surface can show.
      title={toTitle(chat.messages)}
    />
  );
}
