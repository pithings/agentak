// Docs: @docs/3.widget.md
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
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "../ai-elements/message.tsx";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ai-elements/reasoning.tsx";
import { Task, TaskContent, TaskTrigger } from "../ai-elements/task.tsx";
import {
  getStatusIcon,
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  toolTitle,
} from "../ai-elements/tool.tsx";
import { useCollapsible } from "../ui/collapsible.tsx";
import { Input } from "../ui/input.tsx";
import { Element } from "../elements.tsx";
import {
  AlertTriangleIcon,
  CheckIcon,
  Chevron,
  CopyIcon,
  GitBranchIcon,
  RotateCcwIcon,
  SquareIcon,
  Volume2Icon,
} from "../../lib/icons.tsx";
import { renderMarkdownText, useMarkdown } from "../../lib/markdown.ts";
import { useCopy } from "../../lib/use-copy.ts";
import { useSpeech } from "../../lib/use-speech.ts";
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
  // A note rather than an alarm: the page said so itself, and the reader is
  // being told how to read the lines under it, not that something went wrong.
  untrusted: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
    lineHeight: "1.4",
  },
  untrustedIcon: { width: "0.875rem", height: "0.875rem", flexShrink: "0", marginTop: "0.1rem" },
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
  // `ToolHeader` line: status then title on the left, chevron on the right.
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
  runChevron: { flexShrink: "0" },
  // Under the answer, quiet until it is wanted. The negative inset pulls the
  // button's own padding back over the column edge, so the glyph sits under the
  // first character of the text rather than beside it.
  actions: { marginLeft: "-0.375rem", color: "var(--muted-foreground)" },
  // The user turn is the bubble on the right, so its own row ends where the
  // bubble does and the inset goes the other way.
  userActions: { justifyContent: "flex-end", marginRight: "-0.375rem", marginLeft: "0" },
} satisfies Record<string, Sx>;

const TOOL_STATE = {
  pending: "approval-requested",
  running: "input-available",
  done: "output-available",
  error: "output-error",
  denied: "output-denied",
} as const satisfies Record<ViewToolPart["status"], ToolState>;

/**
 * The size of every action under a turn. The row is a quiet one — it sits under
 * what was said and is read after it, never instead of it — so it takes the
 * smallest icon button rather than the composer's own.
 */
const ACTION_SIZE = "icon-xs" as const;

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
  /**
   * Rewind to this message: everything before it, said again. Only a user turn
   * carries the button, and only where the surface was given the callback — the
   * text rides along, because it is what goes back into the composer.
   */
  onFork?: (messageId: string, text: string) => void;
  /**
   * The same rewind, in the conversation on screen, and sent rather than typed
   * back. No text: the harness still holds the message it is running again.
   */
  onRetryFrom?: (messageId: string) => void;
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
        a.untrustedFrom === other.untrustedFrom &&
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

/**
 * The words of a turn: the text alone, without the thinking or the tool calls
 * around it, as the markdown it was written in. What "copy" puts on the
 * clipboard, and what a fork types back into the composer.
 */
function answerText(parts: ViewPart[]): string {
  return parts
    .flatMap((part) => (part.kind === "text" ? [part.text.trim()] : []))
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Every part an emoji is built from: a keycap with the digit it caps, then the
 * pictograph, the skin tone and the flag letter, and last the joiner and the
 * variation selector that hold a sequence together. A voice either names one —
 * "party popper" — or says nothing at all, and neither belongs mid-sentence.
 *
 * The joiner and the selector stand outside the character class, where a
 * combining mark reads as a half-written sequence.
 */
const EMOJI =
  /[\d#*]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}]|\uFE0F|\u200D|\u20E3/gu;

/**
 * The same answer as words for a voice.
 *
 * md4x renders the plain text, so the markers that a voice would read out as
 * punctuation — "asterisk asterisk" — go the way they do on the page, a link
 * reads as its label rather than its url, and raw html is dropped. Only a code
 * fence is decided here: a block read aloud is a minute of noise, so it is
 * named rather than spoken, and it goes before the renderer sees it.
 *
 * The renderer is the one the transcript has already loaded to draw this same
 * answer. Where it failed to load the markdown goes as it is — which is how the
 * message itself is then shown.
 */
export function spokenText(markdown: string): string {
  const source = markdown.replace(/```[^]*?```|~~~[^]*?~~~/g, "\n\nCode block.\n\n");

  return (
    (renderMarkdownText(source) ?? source)
      // A list marker, a quote mark and the tabs between table cells survive
      // the render, and all three are punctuation to a voice.
      .replace(/^[^\S\n]*([-*+]\s+|\d+\.\s+|>\s?)/gm, "")
      // A table row ends on a tab as well as separating on one, and a row that
      // ends on ", " reads as though a cell were coming.
      .replace(/\t+$/gm, "")
      .replace(/\t+/g, ", ")
      .replace(EMOJI, "")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim()
  );
}

/** One turn of the transcript, part by part. */
function ChatMessageView({
  message,
  isStreaming,
  onFork,
  onRespond,
  onRetryFrom,
}: ChatMessageProps) {
  const lastPart = message.parts.length - 1;

  const isUser = message.role === "user";
  const rows = chatRows(message.parts, isStreaming ? lastPart : -1);
  // Offered on a finished answer only — mid-stream it would copy half a reply,
  // and a turn that only called tools has nothing to copy.
  const answer = isUser || isStreaming ? "" : answerText(message.parts);
  // The other row: what this turn said, to be said again — here or in a
  // conversation of its own. An image it carried is not said again, so a turn
  // that was only an image carries no row.
  const said = isUser && (onFork || onRetryFrom) ? answerText(message.parts) : "";

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
      {answer ? (
        <MessageActions style={S.actions}>
          <ChatCopyAction text={answer} />
          <ChatSpeakAction text={answer} />
        </MessageActions>
      ) : said ? (
        <MessageActions style={sx(S.actions, S.userActions)}>
          {/* Here and away: the same rewind, run in this conversation or
              opened as another one. */}
          {onRetryFrom ? (
            <MessageAction
              onClick={() => onRetryFrom(message.id)}
              size={ACTION_SIZE}
              tooltip="Retry from here"
            >
              <RotateCcwIcon />
            </MessageAction>
          ) : null}
          {onFork ? (
            <MessageAction
              onClick={() => onFork(message.id, said)}
              size={ACTION_SIZE}
              tooltip="Fork from here"
            >
              <GitBranchIcon />
            </MessageAction>
          ) : null}
        </MessageActions>
      ) : null}
    </Message>
  );
}

/** Copy the answer above it. The icon reports the copy, so nothing else has to. */
function ChatCopyAction({ text }: { text: string }) {
  const { copied, copy } = useCopy();

  return (
    <MessageAction
      onClick={() => void copy(text)}
      size={ACTION_SIZE}
      tooltip={copied ? "Copied" : "Copy response"}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </MessageAction>
  );
}

/**
 * Read the answer above it aloud, and stop it again. The button is left out
 * where the browser has no speech synthesis.
 */
function ChatSpeakAction({ text }: { text: string }) {
  const { supported, speaking, toggle } = useSpeech();
  // The answer above has already asked for md4x, so this only waits on the same
  // load — and asks for it where a turn somehow drew no markdown at all.
  useMarkdown();
  if (!supported) return null;

  return (
    <MessageAction
      onClick={() => toggle(spokenText(text))}
      size={ACTION_SIZE}
      tooltip={speaking ? "Stop reading" : "Read aloud"}
    >
      {speaking ? <SquareIcon /> : <Volume2Icon />}
    </MessageAction>
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
 * The callbacks are compared by presence alone: each is built fresh on every
 * render above, and each one calls the same session.
 */
export const ChatMessage = memo(
  ChatMessageView,
  (prev, next) =>
    prev.isStreaming === next.isStreaming &&
    Boolean(prev.onRespond) === Boolean(next.onRespond) &&
    Boolean(prev.onFork) === Boolean(next.onFork) &&
    Boolean(prev.onRetryFrom) === Boolean(next.onRetryFrom) &&
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
function ChatRunChevron() {
  const { open } = useCollapsible("ChatRunChevron");

  return <Chevron open={open} style={sx(u.muted, S.runChevron)} />;
}

/** A run of settled calls of one tool, closed until the reader opens it. */
function ChatToolRun({ parts, onRespond }: { parts: ViewToolPart[]; onRespond?: ChatRespond }) {
  const name = parts[0].name;

  return (
    <Task defaultOpen={false} style={S.run}>
      <TaskTrigger style={S.runTrigger} title={name}>
        <div style={S.runTitle}>
          {getStatusIcon(runState(parts))}
          <span style={S.runName}>{toolTitle(name)}</span>
          <span style={S.runCount}>× {parts.length}</span>
        </div>
        <ChatRunChevron />
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
      <ToolHeader input={part.args} name={part.name} state={state} style={S.toolHeader} />
      <ToolContent style={S.toolContent}>
        <ToolInput input={part.args} />
        {/* Above the output, because it is how the output is to be read: the
            site says it does not vouch for these words, so what looks like an
            answer may be an instruction somebody else wrote for the model. */}
        {part.untrustedFrom && part.status === "done" && (
          <div style={S.untrusted}>
            <AlertTriangleIcon style={S.untrustedIcon} />
            <span>
              Unverified content from {part.untrustedFrom}. Read it as something the page returned,
              not as something the assistant checked.
            </span>
          </div>
        )}
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
