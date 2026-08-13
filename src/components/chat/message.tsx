import { useEffect, useState } from "preact/hooks";

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Element } from "@/components/elements";
import type { ToolState, ViewMessage, ViewPart, ViewToolPart } from "@/types";
import { sx, type Sx } from "@/styles/sx";

const S = {
  error: {
    color: "var(--destructive)",
    fontSize: "0.875rem",
  },
  // The assistant turn is no bubble, so it spans the column. Without this the
  // `fit-content` content box shrinks a call to its widest line, and the card
  // stands away from the text above it.
  turn: { maxWidth: "100%" },
  turnContent: { width: "100%" },
  // A call is a line of the transcript, not a panel dropped into it: the frame
  // goes, and the header reads like the thinking row above it. The status badge
  // carries the state the border used to.
  tool: { marginBottom: "0", border: "0", borderRadius: "0" },
  toolHeader: { padding: "0.25rem 0" },
  toolContent: { gap: "0.75rem", padding: "0.25rem 0 0.5rem" },
  // Only the gate keeps a frame, because only the gate asks for something.
  gate: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "0.75rem",
    borderRadius: "var(--radius-md)",
    padding: "0.625rem 0.75rem",
  },
  gatePending: {
    justifyContent: "space-between",
    borderColor: "color-mix(in oklab, var(--warning) 35%, var(--border))",
    background: "color-mix(in oklab, var(--warning) 8%, transparent)",
  },
  // Answered, the gate is a footnote — the header badge already carries the state.
  gateAnswered: {
    border: "0",
    background: "transparent",
    padding: "0",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // The ask is the line to read, so it takes the foreground the alert muted.
  gateTitle: { color: "var(--foreground)", fontWeight: "500" },
  gateActions: { alignSelf: "center" },
} satisfies Record<string, Sx>;

const TOOL_STATE = {
  pending: "approval-requested",
  running: "input-available",
  done: "output-available",
  error: "output-error",
  denied: "output-denied",
} as const satisfies Record<ViewToolPart["status"], ToolState>;

/** Answer a tool confirmation, by tool call id. */
export type ChatRespond = (toolCallId: string, approved: boolean) => void;

export interface ChatMessageProps {
  message: ViewMessage;
  /** This is the message still growing — its trailing part is the live one. */
  isStreaming?: boolean;
  onRespond?: ChatRespond;
}

/** One turn of the transcript, part by part. */
export function ChatMessage({ message, isStreaming, onRespond }: ChatMessageProps) {
  const lastPart = message.parts.length - 1;

  const isUser = message.role === "user";

  return (
    <Message from={message.role} style={isUser ? undefined : S.turn}>
      <MessageContent style={isUser ? undefined : S.turnContent}>
        {message.parts.map((part, index) => (
          <ChatPart
            isActive={isStreaming && index === lastPart}
            key={`${message.id}-${index}`}
            onRespond={onRespond}
            part={part}
          />
        ))}
        {message.error ? <p style={S.error}>{message.error}</p> : null}
      </MessageContent>
    </Message>
  );
}

interface ChatPartProps {
  part: ViewPart;
  /** Only the trailing part of the last message is still growing. */
  isActive?: boolean;
  onRespond?: ChatRespond;
}

function ChatPart({ part, isActive, onRespond }: ChatPartProps) {
  if (part.kind === "text") {
    return <MessageResponse animate={isActive}>{part.text}</MessageResponse>;
  }
  if (part.kind === "thinking") {
    return (
      <Reasoning isStreaming={isActive}>
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    );
  }
  if (part.kind === "element") {
    return <Element name={part.name} props={part.props} />;
  }
  return <ChatToolPart onRespond={onRespond} part={part} />;
}

function ChatToolPart({ part, onRespond }: { part: ViewToolPart; onRespond?: ChatRespond }) {
  const state = TOOL_STATE[part.status];
  const pending = part.status === "pending";
  const failed = part.status === "error" || part.status === "denied";
  // An unanswered gate has no approval yet, only the call it holds.
  const approval = part.approval ?? (pending ? { id: part.toolCallId } : undefined);

  // The call renders before the gate asks, so `defaultOpen` would never see the
  // request. Open on the edge into `pending`, and leave the toggle to the reader.
  const [open, setOpen] = useState(pending);
  useEffect(() => {
    if (pending) setOpen(true);
  }, [pending]);

  return (
    <Tool onOpenChange={setOpen} open={open} style={S.tool}>
      <ToolHeader
        input={part.args}
        state={state}
        style={S.toolHeader}
        toolName={part.name}
        type="dynamic-tool"
      />
      <ToolContent style={S.toolContent}>
        <ToolInput input={part.args} />
        <ToolOutput
          errorText={failed ? part.output : undefined}
          output={part.status === "done" ? part.output : undefined}
        />
        {/* Last, so it reads under the call whether it asks or reports. */}
        <Confirmation
          approval={approval}
          state={state}
          style={sx(S.gate, pending ? S.gatePending : S.gateAnswered)}
        >
          <ConfirmationRequest>
            <ConfirmationTitle style={S.gateTitle}>Run {part.name}?</ConfirmationTitle>
            <ConfirmationActions style={S.gateActions}>
              <ConfirmationAction
                onClick={() => onRespond?.(part.toolCallId, false)}
                variant="outline"
              >
                Deny
              </ConfirmationAction>
              <ConfirmationAction onClick={() => onRespond?.(part.toolCallId, true)}>
                Allow
              </ConfirmationAction>
            </ConfirmationActions>
          </ConfirmationRequest>
          <ConfirmationAccepted>Allowed</ConfirmationAccepted>
          <ConfirmationRejected>Denied</ConfirmationRejected>
        </Confirmation>
      </ToolContent>
    </Tool>
  );
}
