import { useState } from "preact/hooks";

import { ChatMessage } from "@/components/chat/message";
import type { ViewMessage } from "@/types";
import type { Sx } from "@/styles/sx";

import { answerApproval, promptParts, turns } from "./demo-chat";
// Registers the demo renderers the turns reach for. Side effect.
import "./demo-elements";

const S = {
  // The rows carry no surface of their own, so the base the chat sets goes here.
  transcript: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    color: "var(--foreground)",
    fontFamily: "var(--font-sans)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
  },
} satisfies Record<string, Sx>;

/**
 * The scripted conversation as a finished transcript — every part at the state
 * the replay leaves it in. The stamp is fixed, so the ids do not move between
 * renders. The one gate stays unanswered: that is where the replay stops too.
 */
export function demoMessages(): ViewMessage[] {
  return turns.flatMap((turn, index) => [
    { id: `static-user-${index}`, role: "user" as const, parts: promptParts(turn.prompt) },
    { id: `static-${index}`, role: "assistant" as const, parts: turn.reply(0) },
  ]);
}

/**
 * Every turn at once, with no playback. `/demo` renders this, so the whole
 * conversation can be read — and its gate answered — without waiting for the
 * reel in the chatbox.
 */
export function DemoTranscript() {
  const [messages, setMessages] = useState(demoMessages);

  return (
    <div style={S.transcript}>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onRespond={(id, approved) =>
            setMessages((current) => answerApproval(current, id, approved))
          }
        />
      ))}
    </div>
  );
}
