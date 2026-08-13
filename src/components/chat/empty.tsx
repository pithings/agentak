import type { ComponentChildren } from "preact";

import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "@/components/ai-elements/agent";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import type { ChatAgent } from "@/components/chat/types";
import { BotIcon } from "@/lib/icons";
import { u } from "@/styles/base";
import type { Sx } from "@/styles/sx";

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
        title="web-agent"
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
