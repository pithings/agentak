import type { BeforeToolCallContext, BeforeToolCallResult } from "@earendil-works/pi-agent-core";

import type { ToolApproval } from "@/types";

/**
 * How often the user is asked before a tool runs.
 *
 * - `always` — every call.
 * - `once` — the first call of each tool; an allow covers the rest of the session.
 * - `never` — no gate.
 */
export type ApprovalPolicy = "always" | "once" | "never";

/** One tool call waiting for an answer. */
export interface ApprovalRequest {
  /** The tool call id — one call, one answer. */
  id: string;
  toolName: string;
  args: unknown;
}

export interface ApprovalGate {
  /** Hand to `createWebAgent`. The loop calls it after the arguments validate. */
  beforeToolCall(
    context: BeforeToolCallContext,
    signal?: AbortSignal,
  ): Promise<BeforeToolCallResult | undefined>;
  /** Called whenever a request arrives or is answered. */
  subscribe(listener: () => void): () => void;
  pending(): ApprovalRequest[];
  /** Answered calls, by tool call id. The transcript keeps showing the outcome. */
  answers(): Record<string, ToolApproval>;
  respond(id: string, approved: boolean, reason?: string): void;
  /** Deny what is waiting and forget the answers, with the transcript they belong to. */
  clear(): void;
}

/**
 * The confirmation gate.
 *
 * `beforeToolCall` parks the call on a promise and the UI resolves it, so a
 * denied call becomes an error tool result rather than an execution.
 */
export function createApprovalGate(policy: ApprovalPolicy = "once"): ApprovalGate {
  const waiting = new Map<
    string,
    { request: ApprovalRequest; settle: (approved: boolean) => void }
  >();
  const answered = new Map<string, ToolApproval>();
  const allowed = new Set<string>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const answer = (id: string, approved: boolean, reason?: string) => {
    const entry = waiting.get(id);
    if (!entry) return;
    waiting.delete(id);
    answered.set(id, { id, approved, reason });
    if (approved && policy === "once") allowed.add(entry.request.toolName);
    entry.settle(approved);
    notify();
  };

  return {
    async beforeToolCall({ toolCall, args }, signal) {
      if (policy === "never" || allowed.has(toolCall.name)) return undefined;
      if (signal?.aborted) return { block: true, reason: "The run was stopped." };

      const request: ApprovalRequest = { id: toolCall.id, toolName: toolCall.name, args };
      const approved = await new Promise<boolean>((resolve) => {
        const onAbort = () => answer(request.id, false, "The run was stopped.");
        signal?.addEventListener("abort", onAbort, { once: true });
        waiting.set(request.id, {
          request,
          settle: (value) => {
            signal?.removeEventListener("abort", onAbort);
            resolve(value);
          },
        });
        notify();
      });

      return approved
        ? undefined
        : { block: true, reason: answered.get(request.id)?.reason ?? "The user denied this call." };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    pending: () => [...waiting.values()].map((entry) => entry.request),

    answers: () => Object.fromEntries(answered),

    respond: (id, approved, reason) => answer(id, approved, reason),

    clear() {
      // `answer` deletes the entry it is given, which a Map iterator allows.
      for (const id of waiting.keys()) answer(id, false, "The conversation was reset.");
      answered.clear();
      allowed.clear();
      notify();
    },
  };
}
