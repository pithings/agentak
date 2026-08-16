import { memo } from "preact/compat";
import { useEffect, useState } from "preact/hooks";

import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "../ai-elements/confirmation.tsx";
import { Message, MessageContent, MessageResponse } from "../ai-elements/message.tsx";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ai-elements/reasoning.tsx";
import { Task, TaskContent, TaskTrigger } from "../ai-elements/task.tsx";
import {
  getStatusBadge,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "../ai-elements/tool.tsx";
import { useCollapsible } from "../ui/collapsible.tsx";
import { Input } from "../ui/input.tsx";
import { Element } from "../elements.tsx";
import { Chevron, WrenchIcon } from "../../lib/icons.tsx";
import type { ToolState, ViewMessage, ViewPart, ViewToolPart } from "../../types.ts";
import { u } from "../../styles/base.ts";
import { sx, type Sx } from "../../styles/sx.ts";

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
    // The answer row carries a text field now, so it drops under the ask when
    // the surface is a narrow panel rather than squeezing the two together.
    flexWrap: "wrap",
    gap: "0.5rem",
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
  // Takes the room the ask leaves, down to the width the reason field needs —
  // under that, the whole row wraps.
  gateActions: { flex: "1 1 15rem", alignSelf: "center", minWidth: "0" },
  // Only a denial carries it, so it says so rather than asking for a note the
  // reader would think Allow also sends.
  gateReason: { flex: "1", minWidth: "0", height: "1.75rem", fontSize: "0.75rem" },
  // A run reads as one more call in the column, so its trigger repeats the
  // `ToolHeader` line: title left, status and chevron right.
  run: { width: "100%" },
  runTrigger: { padding: "0.25rem 0" },
  runTitle: {
    display: "flex",
    flex: "1",
    minWidth: "0",
    alignItems: "center",
    gap: "0.5rem",
    overflow: "hidden",
    textAlign: "left",
  },
  runName: { flexShrink: "0", fontSize: "0.875rem", fontWeight: "500" },
  runCount: { flexShrink: "0", color: "var(--muted-foreground)", fontSize: "0.75rem" },
  runMeta: { display: "flex", flexShrink: "0", alignItems: "center", gap: "0.5rem" },
} satisfies Record<string, Sx>;

const TOOL_STATE = {
  pending: "approval-requested",
  running: "input-available",
  done: "output-available",
  error: "output-error",
  denied: "output-denied",
} as const satisfies Record<ViewToolPart["status"], ToolState>;

/**
 * Answer a tool confirmation, by tool call id. `reason` goes only with a denial
 * — it is what the model is told in place of the tool's output.
 */
export type ChatRespond = (toolCallId: string, approved: boolean, reason?: string) => void;

/** Shortest run of one tool that collapses into a single row. */
const RUN_MIN = 2;

/** A row of the turn: one part, or a run of calls of the same tool. */
type ChatRow =
  | { kind: "part"; part: ViewPart; index: number }
  | { kind: "run"; parts: ViewToolPart[]; index: number };

/**
 * Only a settled call folds into a run. A gate has to stay where the reader can
 * answer it, and a running call is the progress being reported — both would be
 * hidden inside a collapsed group.
 */
const foldable = (part: ViewPart, index: number, active: number): part is ViewToolPart =>
  part.kind === "tool" &&
  index !== active &&
  (part.status === "done" || part.status === "error" || part.status === "denied");

/** Fold each run of ≥2 settled calls of one tool into a row of its own. */
function chatRows(parts: ViewPart[], active: number): ChatRow[] {
  const rows: ChatRow[] = [];

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (!foldable(part, index, active)) {
      rows.push({ kind: "part", part, index });
      continue;
    }

    // Take the whole run at once, so the loop never revisits a folded call.
    let end = index + 1;
    while (end < parts.length) {
      const next = parts[end];
      if (!foldable(next, end, active) || next.name !== part.name) break;
      end++;
    }

    const run = parts.slice(index, end) as ViewToolPart[];
    rows.push(
      run.length >= RUN_MIN ? { kind: "run", parts: run, index } : { kind: "part", part, index },
    );
    index = end - 1;
  }

  return rows;
}

export interface ChatMessageProps {
  message: ViewMessage;
  /** This is the message still growing — its trailing part is the live one. */
  isStreaming?: boolean;
  onRespond?: ChatRespond;
}

/** Two objects with the same keys and the same values under them. */
function sameProps(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
}

/**
 * The same part, whatever object it arrives in. Only what the row renders is
 * compared — `args` and an element's props are the session's own objects, so
 * they are taken as they come.
 */
function samePart(a: ViewPart, b: ViewPart): boolean {
  if (a === b) return true;
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "text":
    case "thinking":
      return a.text === (b as Extract<ViewPart, { kind: "text" | "thinking" }>).text;

    case "element": {
      const other = b as Extract<ViewPart, { kind: "element" }>;
      return a.name === other.name && sameProps(a.props, other.props);
    }

    default: {
      const other = b as ViewToolPart;
      return (
        a.toolCallId === other.toolCallId &&
        a.name === other.name &&
        a.status === other.status &&
        a.output === other.output &&
        a.approval === other.approval &&
        Object.is(a.args, other.args)
      );
    }
  }
}

/** The same turn, part for part. */
function sameMessage(a: ViewMessage, b: ViewMessage): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.role === b.role &&
    a.error === b.error &&
    a.parts.length === b.parts.length &&
    a.parts.every((part, index) => samePart(part, b.parts[index]))
  );
}

/** One turn of the transcript, part by part. */
function ChatMessageView({ message, isStreaming, onRespond }: ChatMessageProps) {
  const lastPart = message.parts.length - 1;

  const isUser = message.role === "user";
  const rows = chatRows(message.parts, isStreaming ? lastPart : -1);

  return (
    <Message from={message.role} style={isUser ? undefined : S.turn}>
      <MessageContent style={isUser ? undefined : S.turnContent}>
        {rows.map((row) =>
          row.kind === "run" ? (
            <ChatToolRun
              key={`${message.id}-${row.index}`}
              onRespond={onRespond}
              parts={row.parts}
            />
          ) : (
            <ChatPart
              isActive={isStreaming && row.index === lastPart}
              key={`${message.id}-${row.index}`}
              onRespond={onRespond}
              part={row.part}
            />
          ),
        )}
        {message.error ? <p style={S.error}>{message.error}</p> : null}
      </MessageContent>
    </Message>
  );
}

/**
 * A turn is redrawn when it changes, not when the surface around it does.
 *
 * A session rebuilds its whole transcript on every event — the pi one does, and
 * the contract asks only that a snapshot hold still *between* events — so a new
 * `ViewMessage` object is not a changed turn. Compared by what it holds instead,
 * which keeps a token, a keyboard or a resize from redrawing every turn above
 * the one that moved.
 *
 * `onRespond` is compared by presence alone: `AgentChat` builds a fresh closure
 * on every render and each one calls the same session.
 */
export const ChatMessage = memo(
  ChatMessageView,
  (prev, next) =>
    prev.isStreaming === next.isStreaming &&
    Boolean(prev.onRespond) === Boolean(next.onRespond) &&
    sameMessage(prev.message, next.message),
);

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

/** The status the whole run reports — the worst one in it. */
function runState(parts: ViewToolPart[]): ToolState {
  if (parts.some((part) => part.status === "error")) return TOOL_STATE.error;
  if (parts.some((part) => part.status === "denied")) return TOOL_STATE.denied;
  return TOOL_STATE.done;
}

/** The half of the run trigger that reads the open state — a hook, so a component. */
function ChatRunMeta({ state }: { state: ToolState }) {
  const { open } = useCollapsible("ChatRunMeta");

  return (
    <div style={S.runMeta}>
      {getStatusBadge(state)}
      <Chevron open={open} style={u.muted} />
    </div>
  );
}

/** A run of settled calls of one tool, closed until the reader opens it. */
function ChatToolRun({ parts, onRespond }: { parts: ViewToolPart[]; onRespond?: ChatRespond }) {
  const name = parts[0].name;

  return (
    <Task defaultOpen={false} style={S.run}>
      <TaskTrigger style={S.runTrigger} title={name}>
        <div style={S.runTitle}>
          <WrenchIcon style={sx(u.icon, u.muted)} />
          <span style={S.runName}>{name}</span>
          <span style={S.runCount}>× {parts.length}</span>
        </div>
        <ChatRunMeta state={runState(parts)} />
      </TaskTrigger>
      <TaskContent>
        {parts.map((part) => (
          <ChatToolPart key={part.toolCallId} onRespond={onRespond} part={part} />
        ))}
      </TaskContent>
    </Task>
  );
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

  const [reason, setReason] = useState("");
  const deny = () => onRespond?.(part.toolCallId, false, reason.trim() || undefined);

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
              {/* Optional, and Deny stays one click without it. Enter denies,
                  because typing a reason is already the answer. */}
              <Input
                aria-label={`Why not run ${part.name}?`}
                onInput={(event) => setReason(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") deny();
                }}
                placeholder="Why not? Optional"
                style={S.gateReason}
                value={reason}
              />
              <ConfirmationAction onClick={deny} variant="outline">
                Deny
              </ConfirmationAction>
              <ConfirmationAction onClick={() => onRespond?.(part.toolCallId, true)}>
                Allow
              </ConfirmationAction>
            </ConfirmationActions>
          </ConfirmationRequest>
          <ConfirmationAccepted>Allowed</ConfirmationAccepted>
          {/* The reason went to the model, so it is shown where it was given. */}
          <ConfirmationRejected>
            {approval?.reason ? `Denied — ${approval.reason}` : "Denied"}
          </ConfirmationRejected>
        </Confirmation>
      </ToolContent>
    </Tool>
  );
}
