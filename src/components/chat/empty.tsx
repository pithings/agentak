// Docs: @docs/3.widget.md
import {
  Agent,
  AgentContent,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "../ai-elements/agent.tsx";
import { ConversationEmptyState } from "../ai-elements/conversation.tsx";
import { ChatActions } from "./actions.tsx";
import { ChatRecent, type ChatRecentProps } from "./history.tsx";
import { ChatPrompts, type ChatPromptsProps } from "./prompts.tsx";
import type { ChatAgent, ChatEmptyItem } from "./types.ts";
import { Element } from "../elements.tsx";
import { Button } from "../ui/button.tsx";
import { AgentakIcon, SlidersIcon } from "../../lib/icons.tsx";
import { reset } from "../../styles/base.ts";
import { sx, type Sx } from "../../styles/sx.ts";

const S = {
  empty: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  // Who made the surface, over everything the surface is for. It is a credit
  // and not a message: the smallest type here, muted, and one line, so it costs
  // the greeting under it almost nothing.
  credit: {
    display: "inline-flex",
    // The column's own 1rem is a row's worth of room, and this is a line of
    // small print, not a row: it takes a little more air over it and gives back
    // most of what sat under it, so the greeting stays the first thing read.
    marginTop: "0.25rem",
    marginBottom: "-0.5rem",
    alignSelf: "center",
    alignItems: "center",
    gap: "0.25rem",
    color: "var(--muted-foreground)",
    fontSize: "0.6875rem",
  },
  // The mark stands in the line as a word of it, before the name, so it takes
  // the line's own height and not the 16px every other icon is drawn at.
  mark: { width: "0.875rem", height: "0.875rem" },
  // The greeting fills the box when it is all there is. With a launcher or the
  // agent card under it, it takes only the room it needs — a full-height
  // greeting would push everything after it under the fold.
  greeting: {
    height: "auto",
    paddingBlock: "1.5rem",
  },
  // What the host contributes: one column, centred, in the surface's own words
  // rather than in whatever the page around it writes with.
  items: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
    textAlign: "center",
  },
  text: {
    margin: "0",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // A row of host buttons, which wraps rather than runs past the edge: this is
  // a column and not the scrolling row the starters are.
  row: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "0.25rem",
  },
} satisfies Record<string, Sx>;

export interface ChatEmptyProps extends ChatRecentProps, ChatPromptsProps {
  /** Shown under the greeting, so the tools are visible before the first turn. */
  agent?: ChatAgent;
  /**
   * Host content — a note, a launcher. It goes under the greeting, as data:
   * see `ChatEmptyItem`.
   */
  items?: ChatEmptyItem[];
  /**
   * Nothing can answer yet, so the empty state offers the way to the settings
   * page first. It leads the host's own content, because choosing a model comes
   * before whatever a launcher offers to do with one.
   */
  onPickModel?: () => void;
}

/** What the transcript shows before the first message. */
export function ChatEmpty({
  agent,
  history,
  items,
  onOpenConversation,
  onPickModel,
  onPrompt,
  onShowHistory,
  prompts,
}: ChatEmptyProps) {
  const recent = onOpenConversation && history && history.length > 0;
  const starters = Boolean(onPrompt && prompts?.length);
  const host = Boolean(onPickModel || items?.length);
  const alone = !agent && !host && !recent && !starters;

  return (
    <div style={S.empty}>
      <a
        href="https://agentak.dev"
        rel="noreferrer noopener"
        style={sx(reset.link, S.credit)}
        target="_blank"
      >
        <AgentakIcon style={S.mark} />
        Agentak
      </a>
      {/* The credit above is the name and the mark, so the greeting is the one
          line that says what the chat is for. */}
      <ConversationEmptyState
        description="Ask about the current page, or anything else."
        style={alone ? undefined : S.greeting}
        title=""
      />
      {onPickModel && <PickHint onOpen={onPickModel} />}
      <ChatItems items={items} />
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

/** The host's own content, from definitions. An unknown name renders nothing. */
function ChatItems({ items }: { items?: ChatEmptyItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={S.items}>
      {items.map((item, index) => {
        // The list is the host's own and holds no ids: the index is the key,
        // which is what a static list of prose and buttons wants anyway.
        const key = `${item.kind}-${index}`;
        if (item.kind === "text") {
          return (
            <p key={key} style={sx(reset.text, S.text)}>
              {item.text}
            </p>
          );
        }
        if (item.kind === "actions") {
          return (
            <div key={key} style={S.row}>
              <ChatActions actions={item.actions} />
            </div>
          );
        }
        return <Element key={key} name={item.name} props={item.props ?? {}} />;
      })}
    </div>
  );
}

/** The empty state's way to the settings page, before any provider is set. */
function PickHint({ onOpen }: { onOpen: () => void }) {
  return (
    <div style={S.items}>
      <Button onClick={onOpen} size="sm" type="button" variant="outline">
        <SlidersIcon />
        Select a model
      </Button>
      <p style={sx(reset.text, S.text)}>Choose a provider and a model to start.</p>
    </div>
  );
}
