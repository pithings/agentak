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
import type { Sx } from "@/styles/sx";

const S = {
  error: {
    color: "var(--destructive)",
    fontSize: "0.875rem",
  },
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

  return (
    <Message from={message.role}>
      <MessageContent>
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
    <Tool onOpenChange={setOpen} open={open}>
      <ToolHeader state={state} toolName={part.name} type="dynamic-tool" />
      <ToolContent>
        <ToolInput input={part.args} />
        <Confirmation approval={approval} state={state}>
          <ConfirmationTitle>Run {part.name}?</ConfirmationTitle>
          <ConfirmationRequest>
            <ConfirmationActions>
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
          <ConfirmationAccepted>Allowed.</ConfirmationAccepted>
          <ConfirmationRejected>Denied.</ConfirmationRejected>
        </Confirmation>
        <ToolOutput
          errorText={failed ? part.output : undefined}
          output={part.status === "done" ? part.output : undefined}
        />
      </ToolContent>
    </Tool>
  );
}
