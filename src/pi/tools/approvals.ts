// Docs: @docs/4.agents/2.pi/4.tools-and-approvals.md
import type { BeforeToolCallContext, BeforeToolCallResult } from "@earendil-works/pi-agent-core";

import type { ToolApproval } from "../../types.ts";

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
  /** Hand to `createAgent`. The loop calls it after the arguments validate. */
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
  /** The session's own policy — what governs a tool that answers none of its own. */
  policy(): ApprovalPolicy;
  /**
   * Change it, mid-conversation: a person turning the gate off, or back on.
   *
   * Turning it off answers what is already at it, allowed. The alternative is a
   * call left waiting for a question nothing asks any more — and the click that
   * turned the gate off is an answer to that call as much as to the next one.
   * Turning it back on remembers no allow: every tool is asked about again.
   */
  setPolicy(policy: ApprovalPolicy): void;
  /** Deny what is waiting and forget the answers, with the transcript they belong to. */
  clear(): void;
}

/**
 * The confirmation gate.
 *
 * `beforeToolCall` parks the call on a promise and the UI resolves it, so a
 * denied call becomes an error tool result rather than an execution.
 *
 * `approvalFor` answers with a policy of its own for a tool that needs one, and
 * `undefined` for the rest — which is how the page's tools are gated on what
 * the site says about them. See `tools.ts`.
 *
 * A session-wide `never` still wins over any of it: a host that turned the gate
 * off meant it — and so does a person who turned it off from the chat's own bar,
 * which is `setPolicy`.
 */
export function createApprovalGate(
  initial: ApprovalPolicy = "once",
  approvalFor?: (toolName: string) => ApprovalPolicy | undefined,
): ApprovalGate {
  let policy = initial;
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

  /** What governs one tool: its own policy, else the session's. */
  const ruleFor = (toolName: string) => approvalFor?.(toolName) ?? policy;

  const answer = (id: string, approved: boolean, reason?: string) => {
    const entry = waiting.get(id);
    if (!entry) return;
    waiting.delete(id);
    answered.set(id, { id, approved, reason });
    // Only a tool asked about once is remembered. One asked about every time
    // is asked again, whatever this answer was.
    if (approved && ruleFor(entry.request.toolName) === "once") {
      allowed.add(entry.request.toolName);
    }
    entry.settle(approved);
    notify();
  };

  return {
    async beforeToolCall({ toolCall, args }, signal) {
      // The session's `never` is the whole gate off, and outranks a tool's own
      // policy. Anything else lets the tool answer for itself.
      if (policy === "never") return undefined;
      const rule = ruleFor(toolCall.name);
      if (rule === "never" || (rule === "once" && allowed.has(toolCall.name))) return undefined;
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

    policy: () => policy,

    setPolicy(next) {
      if (next === policy) return;
      policy = next;
      // The gate off is the gate off, a call already at it included. Allowed
      // rather than denied: the click that turned it off said run them.
      // `answer` deletes the entry it is given, which a Map iterator allows.
      if (next === "never") for (const id of waiting.keys()) answer(id, true);
      // A gate turned back on is a gate that asks: what one allow covered while
      // it was on last is not covered now.
      else allowed.clear();
      notify();
    },

    clear() {
      // `answer` deletes the entry it is given, which a Map iterator allows.
      for (const id of waiting.keys()) answer(id, false, "The conversation was reset.");
      answered.clear();
      allowed.clear();
      notify();
    },
  };
}
