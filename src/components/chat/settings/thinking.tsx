// Docs: @docs/3.widget.md
import type { ChatThinkingLevel } from "../types.ts";
import { SettingsSection } from "./section.tsx";
import { Button } from "../../ui/button.tsx";
import type { Sx } from "../../../styles/sx.ts";

const T = {
  // A scale reads as a scale, so the levels sit in one strip and wrap rather
  // than becoming a list of their own.
  levels: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.375rem",
  },
} satisfies Record<string, Sx>;

/** The scale reads as a scale, so the two ends get words rather than ids. */
const THINKING_LABEL: Record<ChatThinkingLevel, string> = {
  off: "Off",
  minimal: "Minimal",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Very high",
  max: "Maximum",
};

/** How hard the chosen model thinks, as the levels that model offers. */
export function SettingsThinking({
  level,
  levels,
  onChange,
}: {
  level: ChatThinkingLevel;
  levels: ChatThinkingLevel[];
  onChange?: (level: ChatThinkingLevel) => void;
}) {
  return (
    <SettingsSection title="Thinking">
      <div aria-label="Thinking level" role="group" style={T.levels}>
        {levels.map((entry) => (
          <Button
            aria-pressed={entry === level}
            key={entry}
            onClick={() => onChange?.(entry)}
            size="xs"
            type="button"
            variant={entry === level ? "default" : "outline"}
          >
            {THINKING_LABEL[entry]}
          </Button>
        ))}
      </div>
    </SettingsSection>
  );
}
