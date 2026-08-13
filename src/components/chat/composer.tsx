import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextCacheUsage,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import { ChatPicker, type ChatPickerProps } from "@/components/chat/picker";
import type { ChatUsage } from "@/components/chat/types";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import type { Sx } from "@/styles/sx";

const S = {
  // Tight, because the surface is a side panel or a corner box: every row the
  // chrome takes is a row the transcript does not get.
  composer: {
    borderTop: "1px solid var(--border)",
    padding: "0.5rem",
  },
  textarea: {
    minHeight: "3rem",
  },
  // Takes the row the send button leaves, and pulls back over the footer's own
  // padding so the leading control lines up with the text above it.
  tools: {
    flex: "1",
    marginLeft: "-0.5rem",
  },
  // The anchor for the panel below, which the composer's last row cannot hold.
  usage: {
    position: "relative",
    flexShrink: "0",
  },
  // The composer sits at the foot of the surface, so the breakdown opens over
  // the transcript instead of pushing the composer taller.
  usagePanel: {
    position: "absolute",
    right: "0",
    bottom: "100%",
    zIndex: "50",
    marginTop: "0",
    marginBottom: "0.5rem",
  },
} satisfies Record<string, Sx>;

export interface ChatComposerProps extends ChatPickerProps {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /** The context meter, beside send. Omitted, the composer carries none. */
  usage?: ChatUsage;
}

/** The last row of the surface: what to say, which model says it, and send. */
export function ChatComposer({ isStreaming, onSend, onStop, usage, ...picker }: ChatComposerProps) {
  return (
    <div style={S.composer}>
      <PromptInput onSubmit={(message) => message.text.trim() && onSend(message.text)}>
        <PromptInputBody>
          <PromptInputTextarea
            placeholder={isStreaming ? "Queue a message…" : "Ask about this page…"}
            style={S.textarea}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools style={S.tools}>
            {Boolean(picker.providers?.length || picker.models?.length) && (
              <ChatPicker {...picker} />
            )}
          </PromptInputTools>
          {usage && (
            <Context
              costs={usage.costs}
              maxTokens={usage.maxTokens}
              modelId={usage.modelId}
              style={S.usage}
              usage={usage.usage}
              usedTokens={usage.usedTokens}
            >
              <ContextTrigger />
              <ContextContent style={S.usagePanel}>
                <ContextContentHeader />
                {usage.usage && (
                  <ContextContentBody>
                    <ContextInputUsage />
                    <ContextOutputUsage />
                    <ContextReasoningUsage />
                    <ContextCacheUsage />
                  </ContextContentBody>
                )}
                {usage.costs && <ContextContentFooter />}
              </ContextContent>
            </Context>
          )}
          <PromptInputSubmit onStop={onStop} status={isStreaming ? "streaming" : undefined} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
