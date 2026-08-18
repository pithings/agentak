// Docs: @docs/3.widget.md
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "../ai-elements/context.tsx";
import { ChatSettingsTrigger, type ChatSettingsProps } from "./settings.tsx";
import type { ChatToolPolicy, ChatUsage } from "./types.ts";
import { Button } from "../ui/button.tsx";
import { ShieldIcon, ShieldOffIcon } from "../../lib/icons.tsx";
import { sx, type Sx } from "../../styles/sx.ts";

const S = {
  // The last row of the surface, so it carries the safe area a phone leaves at
  // the bottom of the screen. `--chat-safe-bottom` is the surface's override —
  // a foot lifted over a virtual keyboard is nowhere near the home bar, and
  // `Chat` zeroes it there.
  bar: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: "0",
    flexShrink: "0",
    alignItems: "center",
    gap: "0.125rem",
    padding: "0 0.5rem 0.375rem",
    paddingBottom: "calc(0.375rem + var(--chat-safe-bottom, env(safe-area-inset-bottom, 0px)))",
  },
  // Pushes the meter and the host's own chrome to the far side, whatever the
  // model's name does.
  gap: { flex: "1" },
  // The anchor for the panel above, which the row itself cannot hold.
  usage: {
    position: "relative",
    flexShrink: "0",
  },
  // The bar is the foot of the surface, so the breakdown opens upward over the
  // composer rather than pushing the surface taller — and from the trailing
  // edge, which is the edge the meter now sits against.
  usagePanel: {
    position: "absolute",
    bottom: "100%",
    right: "0",
    zIndex: "50",
    marginTop: "0",
    marginBottom: "0.5rem",
  },
  // The gate off is the state worth seeing across a room, so it is the state
  // that carries a colour — the amber the meter warns in, over a ghost button
  // that only says the word while the gate stands.
  bypass: { color: "var(--warning)" },
} satisfies Record<string, Sx>;

export interface ChatBarProps extends ChatSettingsProps {
  /** The context meter, at the trailing end. Omitted, the bar carries none. */
  usage?: ChatUsage;
  /**
   * What stands in front of a tool call. Omitted, the bar shows no such button:
   * a harness with no tools has nothing to gate, and one that gates nothing has
   * no switch to offer.
   */
  toolPolicy?: ChatToolPolicy;
  /** The other half of it. Without it the state is read and not changed. */
  onToolPolicyChange?: (policy: ChatToolPolicy) => void;
  /** Merged over the bar's own box — `Chat` draws its seam with it. */
  style?: Sx;
}

/**
 * The chat's status row, under the composer: what is running.
 *
 * Which model answers and how much of its window is spent are readings and not
 * questions, so they sit under the field they apply to rather than in the title
 * bar. The title bar keeps what is about the conversation itself; see
 * `header.tsx`.
 *
 * The row is read from both ends. The leading edge is what the next turn runs
 * on and what a click changes: the model, which doubles as the way to the
 * settings page, and then whether a tool call is confirmed — one control each
 * for "what is running" and "change it". The trailing edge is what the turns so
 * far have cost: the meter is a number that only grows, so it is read where a
 * number is read rather than in front of the controls it would push along as it
 * widens. Nothing of the host's is here — its own chrome heads the surface with
 * the title; see `header.tsx`.
 */
export function ChatBar({
  usage,
  style,
  toolPolicy,
  onToolPolicyChange,
  ...settings
}: ChatBarProps) {
  const choices = Boolean(settings.providers?.length || settings.models?.length);
  const bypassing = toolPolicy === "bypass";

  return (
    <div data-slot="chat-bar" style={sx(S.bar, style)}>
      {choices && <ChatSettingsTrigger {...settings} />}

      {toolPolicy && onToolPolicyChange && (
        <Button
          // One switch and not two buttons: `aria-pressed` is the state, and the
          // name says the same state in full — the word on the button with what
          // it is about after it, so a name spoken at the surface is the name it
          // answers to.
          aria-label={bypassing ? "Bypass tool confirmations" : "Ask before tool calls"}
          aria-pressed={bypassing}
          onClick={() => onToolPolicyChange(bypassing ? "ask" : "bypass")}
          size="xs"
          style={bypassing ? S.bypass : undefined}
          title={
            bypassing
              ? "Tool calls run without asking. Click to be asked first."
              : "Tool calls are confirmed first. Click to run them without asking."
          }
          // The bar sits in the composer's form: a bare button would submit it.
          type="button"
          variant="ghost"
        >
          {bypassing ? <ShieldOffIcon /> : <ShieldIcon />}
          {/* Both states say which one they are, because a shield alone is a
              picture of a gate and not of a gate that is up. */}
          {bypassing ? "Bypass" : "Ask"}
        </Button>
      )}

      <div style={S.gap} />

      {usage && (
        <Context
          costs={usage.costs}
          maxTokens={usage.maxTokens}
          modelId={usage.modelId}
          nearLimit={usage.nearLimit}
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
    </div>
  );
}
