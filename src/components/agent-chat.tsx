import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "@/components/ai-elements/agent";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import { Context, type ContextCosts } from "@/components/ai-elements/context";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorShortcut,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Element } from "@/components/elements";
import { Button } from "@/components/ui/button";
import type {
  LanguageModelUsage,
  ToolDefinition,
  ToolState,
  ViewMessage,
  ViewToolPart,
} from "@/types";
import { BotIcon, RotateCcwIcon, XIcon } from "@/lib/icons";
import { u } from "@/styles/base";
import { sx, type Sx } from "@/styles/sx";

const S = {
  // `minWidth` and `overflow` hold the surface to the box the host gives it —
  // as a grid or flex item it would otherwise grow to its widest content.
  chat: {
    display: "flex",
    minWidth: "0",
    minHeight: "0",
    overflow: "hidden",
    flexDirection: "column",
    background: "var(--wa-background)",
    color: "var(--wa-foreground)",
    fontFamily: "var(--wa-font-sans)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    WebkitFontSmoothing: "antialiased",
  },
  chatHeader: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: "0",
    alignItems: "center",
    gap: "0.5rem",
    borderBottom: "1px solid var(--wa-border)",
    padding: "0.5rem 0.75rem",
  },
  chatTitle: {
    flexShrink: "0",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  // Shrinks below its content on a narrow panel: the model name ellipsizes
  // rather than widening the header, which would widen the whole chat.
  chatTools: {
    display: "flex",
    minWidth: "0",
    marginLeft: "auto",
    alignItems: "center",
    gap: "0.25rem",
  },
  chatError: {
    borderTop: "1px solid var(--wa-border)",
    background: "var(--wa-destructive-surface)",
    padding: "0.5rem 0.75rem",
    color: "var(--wa-destructive)",
    fontSize: "0.75rem",
  },
  chatComposer: {
    borderTop: "1px solid var(--wa-border)",
    padding: "0.75rem",
  },
  chatQueue: {
    padding: "0.75rem 0.75rem 0",
  },
  chatEmpty: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  messageError: {
    color: "var(--wa-destructive)",
    fontSize: "0.875rem",
  },
} satisfies Record<string, Sx>;

/** One entry of the model picker. */
export interface ChatModel {
  id: string;
  name: string;
  contextWindow: number;
}

/** What the context meter shows. Produced by `agent/transcript.ts`. */
export interface ChatUsage {
  usedTokens: number;
  maxTokens: number;
  usage?: LanguageModelUsage;
  modelId?: string;
  costs?: ContextCosts;
}

/** The agent behind the chat, shown before the first message. */
export interface ChatAgent {
  name: string;
  model?: string;
  instructions: string;
  tools: (ToolDefinition & { name: string })[];
}

/** A message typed while the agent was working, waiting its turn. */
export interface ChatQueueItem {
  id: string;
  text: string;
}

export interface AgentChatProps {
  messages: ViewMessage[];
  isStreaming: boolean;
  error?: string;
  onSend: (text: string) => void;
  onStop: () => void;
  onReset: () => void;
  className?: string;
  /** Merged over the chat's own box — how a host sizes the surface. */
  style?: Sx;
  /** The model picker. Omitted, the header carries none. */
  models?: ChatModel[];
  modelId?: string;
  onModelChange?: (id: string) => void;
  /** Heads the model list — which provider these models come from. */
  providerLabel?: string;
  /** The context meter. Omitted, the header carries none. */
  usage?: ChatUsage;
  /** Shown in the empty state, so the tools are visible before the first turn. */
  agent?: ChatAgent;
  /** Messages queued behind the current turn. */
  queued?: ChatQueueItem[];
  onDequeue?: (id: string) => void;
  /** Answer a tool confirmation, by tool call id. */
  onRespond?: (toolCallId: string, approved: boolean) => void;
  /** Reopen the API key form. Omitted, the header carries no such button. */
  onEditKey?: () => void;
}

const TOOL_STATE = {
  pending: "approval-requested",
  running: "input-available",
  done: "output-available",
  error: "output-error",
  denied: "output-denied",
} as const satisfies Record<ViewToolPart["status"], ToolState>;

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/**
 * Presentational chat surface. It knows nothing about any agent runtime — pass
 * it a transcript and callbacks, whatever produces them. Everything past the
 * transcript is optional, so a store that has no models, usage or queue still
 * renders the same surface.
 */
export function AgentChat({
  messages,
  isStreaming,
  error,
  onSend,
  onStop,
  onReset,
  className,
  style,
  models,
  modelId,
  onModelChange,
  providerLabel = "Models",
  usage,
  agent,
  queued = [],
  onDequeue,
  onRespond,
  onEditKey,
}: AgentChatProps) {
  const handleSubmit = (message: PromptInputMessage) => {
    if (message.text.trim()) onSend(message.text);
  };

  const last = messages.at(-1);
  // Nothing has come back yet: the turn is still the user's, or it is empty.
  const waiting = isStreaming && (last?.role !== "assistant" || last.parts.length === 0);
  const current = models?.find((model) => model.id === modelId);

  return (
    <div className={className} style={sx(S.chat, style)}>
      <header style={S.chatHeader}>
        <BotIcon style={sx(u.icon, u.muted)} />
        <span style={S.chatTitle}>web-agent</span>

        <div style={S.chatTools}>
          {models && models.length > 0 && (
            <ModelSelector onValueChange={onModelChange} value={modelId}>
              <ModelSelectorTrigger>{current?.name ?? "Model"}</ModelSelectorTrigger>
              <ModelSelectorContent>
                <ModelSelectorInput />
                <ModelSelectorList>
                  <ModelSelectorEmpty />
                  <ModelSelectorGroup heading={providerLabel}>
                    {models.map((model) => (
                      <ModelSelectorItem key={model.id} textValue={model.name} value={model.id}>
                        <ModelSelectorName>{model.name}</ModelSelectorName>
                        <ModelSelectorShortcut>
                          {compact.format(model.contextWindow)}
                        </ModelSelectorShortcut>
                      </ModelSelectorItem>
                    ))}
                  </ModelSelectorGroup>
                </ModelSelectorList>
              </ModelSelectorContent>
            </ModelSelector>
          )}

          {usage && (
            <Context
              costs={usage.costs}
              maxTokens={usage.maxTokens}
              modelId={usage.modelId}
              usage={usage.usage}
              usedTokens={usage.usedTokens}
            />
          )}

          {onEditKey && (
            <Button onClick={onEditKey} size="sm" title="Change the API key" variant="ghost">
              Key
            </Button>
          )}

          <Button onClick={onReset} size="icon-sm" title="New conversation" variant="ghost">
            <RotateCcwIcon />
          </Button>
        </div>
      </header>

      <Conversation pin={messages.at(-1)?.id}>
        <ConversationContent>
          {messages.length === 0 ? (
            <div style={S.chatEmpty}>
              <ConversationEmptyState
                description="Ask about the current page, or anything else."
                icon={<BotIcon style={u.iconLg} />}
                title="web-agent"
              />
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
          ) : (
            messages.map((message, messageIndex) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) => {
                    const key = `${message.id}-${index}`;
                    // Only the trailing part of the last message is still growing.
                    const isActive =
                      isStreaming &&
                      messageIndex === messages.length - 1 &&
                      index === message.parts.length - 1;
                    if (part.kind === "text") {
                      return <MessageResponse key={key}>{part.text}</MessageResponse>;
                    }
                    if (part.kind === "thinking") {
                      return (
                        <Reasoning isStreaming={isActive} key={key}>
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    }
                    if (part.kind === "element") {
                      return <Element key={key} name={part.name} props={part.props} />;
                    }
                    // An unanswered gate has no approval yet, only the call it holds.
                    const approval =
                      part.approval ??
                      (part.status === "pending" ? { id: part.toolCallId } : undefined);
                    return (
                      <Tool defaultOpen={part.status === "pending"} key={key}>
                        <ToolHeader
                          state={TOOL_STATE[part.status]}
                          toolName={part.name}
                          type="dynamic-tool"
                        />
                        <ToolContent>
                          <ToolInput input={part.args} />
                          <Confirmation approval={approval} state={TOOL_STATE[part.status]}>
                            <ConfirmationTitle>Run {part.name}?</ConfirmationTitle>
                            <ConfirmationRequest>
                              <ConfirmationActions>
                                <ConfirmationAction
                                  onClick={() => onRespond?.(part.toolCallId, false)}
                                  variant="outline"
                                >
                                  Deny
                                </ConfirmationAction>
                                <ConfirmationAction
                                  onClick={() => onRespond?.(part.toolCallId, true)}
                                >
                                  Allow
                                </ConfirmationAction>
                              </ConfirmationActions>
                            </ConfirmationRequest>
                            <ConfirmationAccepted>Allowed.</ConfirmationAccepted>
                            <ConfirmationRejected>Denied.</ConfirmationRejected>
                          </Confirmation>
                          <ToolOutput
                            errorText={
                              part.status === "error" || part.status === "denied"
                                ? part.output
                                : undefined
                            }
                            output={part.status === "done" ? part.output : undefined}
                          />
                        </ToolContent>
                      </Tool>
                    );
                  })}
                  {message.error ? <p style={S.messageError}>{message.error}</p> : null}
                </MessageContent>
              </Message>
            ))
          )}
          {waiting ? <Shimmer>Working…</Shimmer> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error ? <p style={S.chatError}>{error}</p> : null}

      {queued.length > 0 && (
        <div style={S.chatQueue}>
          <Queue>
            <QueueSection>
              <QueueSectionTrigger>
                <QueueSectionLabel count={queued.length} label="Queued" />
              </QueueSectionTrigger>
              <QueueSectionContent>
                <QueueList>
                  {queued.map((item) => (
                    <QueueItem key={item.id}>
                      <QueueItemIndicator />
                      <QueueItemContent>{item.text}</QueueItemContent>
                      <QueueItemActions>
                        <QueueItemAction onClick={() => onDequeue?.(item.id)} title="Remove">
                          <XIcon />
                        </QueueItemAction>
                      </QueueItemActions>
                    </QueueItem>
                  ))}
                </QueueList>
              </QueueSectionContent>
            </QueueSection>
          </Queue>
        </div>
      )}

      <div style={S.chatComposer}>
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={isStreaming ? "Queue a message…" : "Ask about this page…"}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit onStop={onStop} status={isStreaming ? "streaming" : undefined} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
