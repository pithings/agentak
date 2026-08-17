// Docs: @docs/4.agents/2.pi-agent/9.advanced-api.md
// Docs: @docs/4.agents/2.pi-agent/4.tools-and-approvals.md
import {
  Agent,
  type AgentMessage,
  type AgentTool,
  type StreamFn,
  type ThinkingLevel,
} from "@earendil-works/pi-agent-core";

import { type ApprovalGate, type ApprovalPolicy, createApprovalGate } from "./approvals.ts";
import { DEFAULT_MODEL } from "./models.ts";
import { type AnyModel, findProvider, streamFor } from "./providers.ts";

export const AGENT_NAME = "Assistant";

export const SYSTEM_PROMPT = [
  "You are an assistant embedded in a web page.",
  "",
  "Say so plainly when you do not have the answer — do not guess it.",
  "Keep answers short. Markdown is rendered, so use it for lists and code.",
].join("\n");

export interface AgentOptions {
  /**
   * The key for a provider. A function, so a key from storage can change, and a
   * second provider can be added, without a new agent. A free provider needs
   * none.
   */
  apiKey?: string | ((provider: string) => string | undefined);
  /** Defaults to the default provider's default model. */
  model?: AnyModel;
  /**
   * A transcript to start from, rather than an empty one — a conversation a host
   * stored and brought back. Pass it through `usablePiMessages()` first: pi
   * takes whatever it is given, and a transcript cut mid tool call is one no
   * provider accepts.
   */
  messages?: AgentMessage[];
  thinkingLevel?: ThinkingLevel;
  systemPrompt?: string;
  /** The agent tools. None are included, so the loop answers from the chat alone. */
  tools?: AgentTool<any>[];
  /** How often a tool call is confirmed. Default: once per tool. */
  approvals?: ApprovalPolicy;
  /**
   * A policy for one tool, where it needs its own — `undefined` leaves it to
   * `approvals`. The page's own tools are gated through here on what the site
   * says about them; see `page-tools.ts`. `approvals: "never"` outranks it.
   */
  approvalFor?: (toolName: string) => ApprovalPolicy | undefined;
  /** A scripted provider under test. Default: the api the model names. */
  streamFn?: StreamFn;
}

/** What `useAgent` drives: the loop, plus the gate that stands in front of it. */
export interface AgentRuntime {
  agent: Agent;
  approvals: ApprovalGate;
  name: string;
}

/**
 * The agent loop: pi's `Agent` over whichever provider the current model names.
 *
 * The stream function is chosen per model and its module is fetched on use, so
 * a provider costs nothing until it is picked. Every supported provider allows
 * the key to be used from a page, which is where this one lives.
 */
export function createAgent({
  apiKey,
  model = DEFAULT_MODEL,
  messages = [],
  thinkingLevel = "off",
  systemPrompt = SYSTEM_PROMPT,
  tools = [],
  approvals = "once",
  approvalFor,
  streamFn = streamFor,
}: AgentOptions): AgentRuntime {
  const gate = createApprovalGate(approvals, approvalFor);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      messages,
      thinkingLevel,
      tools,
    },
    streamFn,
    // A free provider needs no key, but the openai client wants a string.
    getApiKey: (provider) => {
      const key = typeof apiKey === "function" ? apiKey(provider) : apiKey;
      return key || (findProvider(provider)?.free ? "unused" : key);
    },
    beforeToolCall: (context, signal) => gate.beforeToolCall(context, signal),
  });

  return { agent, approvals: gate, name: AGENT_NAME };
}
