// Docs: @docs/3.widget.md
import type { ComponentChildren } from "preact";

import {
  Agent,
  AgentContent,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "../ai-elements/agent.tsx";
import { ConversationEmptyState } from "../ai-elements/conversation.tsx";
import { ChatRecent, type ChatRecentProps } from "./history.tsx";
import { ChatPrompts, type ChatPromptsProps } from "./prompts.tsx";
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

export interface ChatEmptyProps extends ChatRecentProps, ChatPromptsProps {
  /** Shown under the greeting, so the tools are visible before the first turn. */
  agent?: ChatAgent;
  /** Host content — a suggestion, a launcher. It goes under the greeting. */
  children?: ComponentChildren;
}

/** What the transcript shows before the first message. */
export function ChatEmpty({
  agent,
  children,
  history,
  onOpenConversation,
  onPrompt,
  onShowHistory,
  prompts,
}: ChatEmptyProps) {
  const recent = onOpenConversation && history && history.length > 0;
  const starters = Boolean(onPrompt && prompts?.length);
  const alone = !agent && !children && !recent && !starters;

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
        // Open, and with no header over it: what is worth opening is a row
        // inside it. The greeting above already names the chat, and the status
        // bar under the composer names the model — a row saying "Assistant"
        // once more is a row that says nothing.
        <Agent defaultOpen>
          <AgentContent>
            <AgentInstructions>{agent.instructions}</AgentInstructions>
            {agent.tools.length > 0 && (
              <AgentTools>
                {agent.tools.map((tool) => (
                  <AgentTool key={tool.name} tool={tool} value={tool.name} />
                ))}
              </AgentTools>
            )}
          </AgentContent>
        </Agent>
      )}
      {/* Last, under whatever the host and the agent card put there: what was
          said before comes after what this chat is. */}
      <ChatRecent
        history={history}
        onOpenConversation={onOpenConversation}
        onShowHistory={onShowHistory}
      />
      {/* And last of all, nearest the composer: what to say. Everything above is
          what this chat is and what it has been; this is the one thing here that
          starts a turn, so it sits at the end, a click away from the field. */}
      <ChatPrompts onPrompt={onPrompt} prompts={prompts} />
    </div>
  );
}
