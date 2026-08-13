import {
  Agent,
  type AgentTool,
  type StreamFn,
  type ThinkingLevel,
} from "@earendil-works/pi-agent-core";

import { type ApprovalGate, type ApprovalPolicy, createApprovalGate } from "@/agent/approvals";
import { DEFAULT_MODEL } from "@/agent/models";
import { documentBridge, type PageBridge } from "@/agent/page-bridge";
import { type AnyModel, findProvider, streamFor } from "@/agent/providers";
import { createPageTools } from "@/agent/tools";

export const AGENT_NAME = "Page reader";

export const SYSTEM_PROMPT = [
  "You are a browsing assistant embedded in a web page.",
  "",
  "Answer from the page in front of you. Call `read_page` before you answer a question",
  "about it, and `find_elements` when you need a specific part of the DOM.",
  "Say so plainly when the page does not carry the answer — do not guess it.",
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
  thinkingLevel?: ThinkingLevel;
  systemPrompt?: string;
  /** Defaults to the document this script runs in. */
  page?: PageBridge;
  /** Defaults to the page tools. */
  tools?: AgentTool<any>[];
  /** How often a tool call is confirmed. Default: once per tool. */
  approvals?: ApprovalPolicy;
  /** A scripted provider under test. Default: the api the model names. */
  streamFn?: StreamFn;
}

/** What `useAgent` drives: the loop, plus the gate that stands in front of it. */
export interface AgentRuntime {
  agent: Agent;
  approvals: ApprovalGate;
  page: PageBridge;
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
  thinkingLevel = "off",
  systemPrompt = SYSTEM_PROMPT,
  page = documentBridge(),
  tools,
  approvals = "once",
  streamFn = streamFor,
}: AgentOptions): AgentRuntime {
  const gate = createApprovalGate(approvals);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      thinkingLevel,
      tools: tools ?? createPageTools(page),
    },
    streamFn,
    // A free provider needs no key, but the openai client wants a string.
    getApiKey: (provider) => {
      const key = typeof apiKey === "function" ? apiKey(provider) : apiKey;
      return key || (findProvider(provider)?.free ? "unused" : key);
    },
    beforeToolCall: (context, signal) => gate.beforeToolCall(context, signal),
  });

  return { agent, approvals: gate, name: AGENT_NAME, page };
}
