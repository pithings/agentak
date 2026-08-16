/** The transcript the chat surface renders. Produced by whatever drives it. */
export type ViewPart =
  | { kind: "text"; text: string }
  | { kind: "thinking"; text: string }
  | {
      kind: "tool";
      toolCallId: string;
      name: string;
      args: unknown;
      /** `pending` is waiting for an answer; `denied` was refused before it ran. */
      status: "pending" | "running" | "done" | "error" | "denied";
      output?: string;
      /** Set once the call passed a confirmation gate, so the outcome can show. */
      approval?: ToolApproval;
      /**
       * The origin of a result its own site does not vouch for — WebMCP's
       * `untrustedContentHint`. The model is told in words; this is so the
       * reader is told too, because the words in the output may be an
       * instruction aimed at the model rather than an answer to the question.
       */
      untrustedFrom?: string;
    }
  // A ported AI element, rendered inline. `name` selects the renderer from
  // `components/elements.tsx`; props are checked there, not here, so a new
  // element needs no change to this union.
  | { kind: "element"; name: string; props: Record<string, unknown> };

/** The tool part on its own — a renderer maps its `status` to a `ToolState`. */
export type ViewToolPart = Extract<ViewPart, { kind: "tool" }>;

export interface ViewMessage {
  id: string;
  role: "user" | "assistant";
  parts: ViewPart[];
  error?: string;
}

/**
 * Types inlined from the `ai` package (v7 UI types), so the components do not
 * pull in the dependency. Only the fields the components read are kept.
 */

/** `UIMessage["role"]` */
export type MessageRole = "system" | "user" | "assistant";

/** `ChatStatus` */
export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

/** `ToolUIPart["state"]` — shared by static and dynamic tool parts. */
export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-denied"
  | "output-error";

interface ToolUIPartBase {
  state: ToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

/** `ToolUIPart` — a tool known ahead of time, named by its `tool-<name>` type. */
export interface ToolUIPart extends ToolUIPartBase {
  type: `tool-${string}`;
}

/** `DynamicToolUIPart` — a tool only known at runtime, named by `toolName`. */
export interface DynamicToolUIPart extends ToolUIPartBase {
  type: "dynamic-tool";
  toolName: string;
}

/** `Experimental_GeneratedImage` — `uint8Array` is the same bytes, unused here. */
export interface GeneratedImage {
  base64: string;
  mediaType: string;
  uint8Array?: Uint8Array;
}

/** `Experimental_TranscriptionResult["segments"][number]` */
export interface TranscriptionSegment {
  text: string;
  startSecond: number;
  endSecond: number;
}

/**
 * `ToolUIPartApproval` — the answer to an `approval-requested` tool part.
 * `approved` is undefined while the answer is still pending.
 */
export interface ToolApproval {
  id: string;
  approved?: boolean;
  reason?: string;
}

/** `LanguageModelUsage` — the token counts one turn reports. */
export interface LanguageModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

/** `Tool` — only what `AgentTool` shows. A tool carries one schema or the other. */
export interface ToolDefinition {
  description?: string;
  inputSchema?: unknown;
  jsonSchema?: unknown;
}
