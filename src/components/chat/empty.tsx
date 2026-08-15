import type { ComponentChildren } from "preact";

import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "../ai-elements/agent.tsx";
import { ConversationEmptyState } from "../ai-elements/conversation.tsx";
import type { ChatAgent } from "./types.ts";
import { BotIcon } from "../../lib/icons.tsx";
import { u } from "../../styles/base.ts";
import type { Sx } from "../../styles/sx.ts";

const S = {
  empty: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  // The greeting fills the box when it is all there is. With a launcher or the
  // agent card under it, it takes only the room it needs — a full-height
  // greeting would push everything after it under the fold.
  greeting: {
    height: "auto",
    paddingBlock: "1.5rem",
  },
} satisfies Record<string, Sx>;

export interface ChatEmptyProps {
  /** Shown under the greeting, so the tools are visible before the first turn. */
  agent?: ChatAgent;
  /** Host content — a suggestion, a launcher. It goes under the greeting. */
  children?: ComponentChildren;
}

/** What the transcript shows before the first message. */
export function ChatEmpty({ agent, children }: ChatEmptyProps) {
  const alone = !agent && !children;

  return (
    <div style={S.empty}>
      <ConversationEmptyState
        description="Ask about the current page, or anything else."
        icon={<BotIcon style={u.iconLg} />}
        style={alone ? undefined : S.greeting}
        title="agentak"
      />
      {children}
      {agent && (
        <Agent>
          <AgentHeader model={agent.model} name={agent.name} />
          <AgentContent>
            <AgentInstructions>{agent.instructions}</AgentInstructions>
            <AgentTools>
              {agent.tools.map((tool) => (
                <AgentTool key={tool.name} tool={tool} value={tool.name} />
              ))}
            </AgentTools>
          </AgentContent>
        </Agent>
      )}
    </div>
  );
}
