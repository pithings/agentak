import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Chat } from "@/components/chat";
import { type ChatSession, type ChatSessionOptions, useSession } from "@/session";
import type { Sx } from "@/styles/sx";

export interface AgentChatProps extends ChatSessionOptions {
  /**
   * What runs the chat. `createPiSession()` from `agentak/pi` is the built-in
   * one — the pi loop over the page tools, with the provider picker in front of
   * it. A host with its own harness implements `ChatSession` instead, and no pi
   * module is loaded.
   */
  session: ChatSession;
  className?: string;
  /** Merged over the chat's own box — how a host sizes the element. */
  style?: Sx;
  /**
   * Host buttons for the end of the header, so a page can put its own chrome —
   * minimise, and whatever else it owns — on the agent's one title bar.
   */
  actions?: ComponentChildren;
  /**
   * Host content for the chat's empty state — a suggestion, a launcher. It
   * shows only before the first message.
   */
  emptyActions?: ComponentChildren;
}

/**
 * Top-level container: a session, driving `Chat`.
 *
 * It knows no agent runtime and no provider — the session holds both, so this
 * module carries no dependency on pi. What is left here is the wiring, plus the
 * one piece of state a session need not own: whether the picker is open.
 */
export function AgentChat({
  session,
  className,
  style,
  generateTitle,
  actions,
  emptyActions,
}: AgentChatProps) {
  const snapshot = useSession(session);

  // Declared by the host rather than the session — the prop changes without a
  // new session, and so without a lost transcript. Left out, it is not passed
  // on: a session built with one of its own keeps it.
  useEffect(() => {
    if (generateTitle !== undefined) session.setOptions?.({ generateTitle });
  }, [generateTitle, session]);

  // A session that opens the picker itself keeps the flag; one that does not
  // leaves it here, where a plain popover needs no session at all.
  const [held, setHeld] = useState(false);
  const pickerOpen = snapshot.pickerOpen ?? held;
  const onPickerOpenChange = session.setPickerOpen ?? setHeld;

  // The callbacks go through the session rather than out of it as bare
  // functions, so a session written as a class keeps its `this`. An absent one
  // stays absent: the surface leaves out what nothing answers.
  return (
    <Chat
      {...snapshot}
      actions={actions}
      className={className}
      emptyActions={emptyActions}
      onDequeue={session.dequeue && ((id) => session.dequeue?.(id))}
      onModelChange={session.selectModel && ((id) => session.selectModel?.(id))}
      onPickerOpenChange={onPickerOpenChange}
      onProviderChange={session.selectProvider && ((id) => session.selectProvider?.(id))}
      onReset={() => session.reset()}
      onRespond={session.respond && ((id, approved) => session.respond?.(id, approved))}
      onSaveKey={session.saveKey && ((id, key) => session.saveKey?.(id, key))}
      onSend={(text) => session.send(text)}
      onStop={() => session.stop()}
      pickerOpen={pickerOpen}
      style={style}
    />
  );
}
