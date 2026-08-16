import type { ComponentChildren } from "preact";
import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Chat } from "./components/chat.tsx";
import { Button } from "./components/ui/button.tsx";
import { SlidersIcon } from "./lib/icons.tsx";
import {
  CHAT_SESSION_OPTIONS,
  type ChatSession,
  type ChatSessionOptions,
  useSession,
} from "./session.ts";
import { reset } from "./styles/base.ts";
import { sx, type Sx } from "./styles/sx.ts";

const S = {
  hint: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
    textAlign: "center",
  },
  hintNote: {
    margin: "0",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

export interface AgentChatProps extends ChatSessionOptions {
  /**
   * What runs the chat. `createPiSession()` from `agentak/pi` is the built-in
   * one — the pi loop with the provider picker in front of it. A host with its
   * own harness implements `ChatSession` instead, and no pi module is loaded.
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
  actions,
  emptyActions,
  ...options
}: AgentChatProps) {
  const snapshot = useSession(session);

  // Declared by the host rather than the session — the prop changes without a
  // new session, and so without a lost transcript. An absent one is not passed
  // on: a session built with one of its own keeps it. Forwarded by the key list
  // rather than one branch per option, so a new option needs no edit here.
  const declared = Object.fromEntries(
    CHAT_SESSION_OPTIONS.filter((key) => options[key] !== undefined).map((key) => [
      key,
      options[key],
    ]),
  ) as ChatSessionOptions;
  // The values, not the object: the object is fresh on every render, and the
  // options are the host's own primitives.
  const signature = JSON.stringify(declared);

  useEffect(() => {
    if (signature !== "{}") session.setOptions?.(JSON.parse(signature) as ChatSessionOptions);
  }, [signature, session]);

  // A session that answers `setPickerOpen` owns the flag, both halves of it —
  // reading `snapshot.pickerOpen` when nothing sets it would leave the picker
  // shut for good. One that does not leaves the state here, where a plain
  // popover needs no session at all.
  const [held, setHeld] = useState(false);
  const pickerOpen = session.setPickerOpen ? (snapshot.pickerOpen ?? false) : held;
  const onPickerOpenChange = session.setPickerOpen ?? setHeld;

  // The history page is the same flag twice over: the session owns it when it
  // answers `setHistoryOpen`, and the surface holds it when nothing does.
  const [heldHistory, setHeldHistory] = useState(false);
  const historyOpen = session.setHistoryOpen ? (snapshot.historyOpen ?? false) : heldHistory;
  const onHistoryOpenChange = session.setHistoryOpen ?? setHeldHistory;

  // Nothing can answer yet: the first message would only open the settings page,
  // so the empty state says so first. It leads the host's own content, because
  // choosing a model comes before whatever a launcher offers to do with one.
  const unset = Boolean(snapshot.providers?.length) && !snapshot.providerId;
  const empty = unset ? (
    <Fragment>
      <PickHint onOpen={() => onPickerOpenChange(true)} />
      {emptyActions}
    </Fragment>
  ) : (
    emptyActions
  );

  // The callbacks go through the session rather than out of it as bare
  // functions, so a session written as a class keeps its `this`. An absent one
  // stays absent: the surface leaves out what nothing answers.
  return (
    <Chat
      {...snapshot}
      actions={actions}
      className={className}
      emptyActions={empty}
      historyOpen={historyOpen}
      onDequeue={session.dequeue && ((id) => session.dequeue?.(id))}
      onDismissError={session.dismissError && (() => session.dismissError?.())}
      onForgetConversation={
        session.forgetConversation && ((id) => session.forgetConversation?.(id))
      }
      onForgetKey={session.forgetKey && ((id) => session.forgetKey?.(id))}
      onHistoryOpenChange={onHistoryOpenChange}
      onModelChange={session.selectModel && ((id) => session.selectModel?.(id))}
      onOpenConversation={session.openConversation && ((id) => session.openConversation?.(id))}
      onPickerOpenChange={onPickerOpenChange}
      onProviderChange={session.selectProvider && ((id) => session.selectProvider?.(id))}
      onReset={() => session.reset()}
      onRespond={
        session.respondToTool &&
        ((id, approved, reason) => session.respondToTool?.(id, approved, reason))
      }
      onRetry={session.retry && (() => session.retry?.())}
      onSaveKey={session.saveKey && ((id, key) => session.saveKey?.(id, key))}
      onSend={(text) => session.send(text)}
      onStop={() => session.stop()}
      onThinkingLevelChange={
        session.setThinkingLevel && ((level) => session.setThinkingLevel?.(level))
      }
      pickerOpen={pickerOpen}
      style={style}
    />
  );
}

/** The empty state's way to the settings page, before any provider is set. */
function PickHint({ onOpen }: { onOpen: () => void }) {
  return (
    <div style={S.hint}>
      <Button onClick={onOpen} size="sm" type="button" variant="outline">
        <SlidersIcon />
        Select a model
      </Button>
      <p style={sx(reset.text, S.hintNote)}>Choose a provider and a model to start.</p>
    </div>
  );
}
