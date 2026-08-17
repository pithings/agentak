// Docs: @docs/3.widget.md
import { Suggestion, Suggestions } from "../ai-elements/suggestion.tsx";
import type { ChatPrompt } from "./types.ts";
import type { Sx } from "../../styles/sx.ts";

const S = {
  // A little air under the row, over the column's own gap: this is the foot of
  // the empty state and the composer is right below it, so the last thing on
  // the page does not want to sit against the first thing under it.
  prompts: {
    paddingBottom: "0.25rem",
  },
  // Centred while the buttons fit, and scrolling once they do not. `minWidth`
  // is what does both: the row is as wide as its content, and no narrower than
  // the surface — so a short row has room to centre in and a long one still
  // runs past the edge.
  row: {
    minWidth: "100%",
    justifyContent: "center",
  },
} satisfies Record<string, Sx>;

export interface ChatPromptsProps {
  /**
   * What an empty chat offers to say, one button each. A string is the whole of
   * one — the words on the button are the words sent — and `{ label, prompt }`
   * is a button that is the short of a longer message.
   */
  prompts?: ChatPrompt[];
  /** Send one. Without it the row is left out: a button that says nothing. */
  onPrompt?: (text: string) => void;
}

/**
 * The starters, at the foot of the empty state.
 *
 * They come after everything else there — the greeting, the host's own content,
 * the agent card, the conversations already had — because those say what this
 * chat is and what it has been, and this is the one thing on the page that
 * starts a turn. Last also means nearest the composer, which is where a message
 * is going anyway. A click sends it outright: the button is the message, and a
 * starter that only filled the field would be a click asking for a second one.
 *
 * The row scrolls and does not wrap. The surface is often a side panel, and a
 * starter is read at a glance or not at all — a column of wrapped buttons would
 * be a page of chrome in front of an empty chat. It is centred while it fits,
 * because one or two buttons packed against the leading edge read as the start
 * of a list that was cut off.
 */
export function ChatPrompts({ prompts, onPrompt }: ChatPromptsProps) {
  if (!onPrompt || !prompts || prompts.length === 0) return null;

  return (
    <div data-slot="chat-prompts" style={S.prompts}>
      <Suggestions style={S.row}>
        {prompts.map((prompt) => {
          const label = typeof prompt === "string" ? prompt : prompt.label;
          const text = typeof prompt === "string" ? prompt : (prompt.prompt ?? prompt.label);
          return (
            <Suggestion key={label} onClick={onPrompt} suggestion={text}>
              {label}
            </Suggestion>
          );
        })}
      </Suggestions>
    </div>
  );
}
