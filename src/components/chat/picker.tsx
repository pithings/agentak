import { useLayoutEffect, useRef, useState } from "preact/hooks";

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
  ModelSelectorValue,
} from "@/components/ai-elements/model-selector";
import type { ChatModel, ChatProvider, ChatThinkingLevel } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useControllableState } from "@/lib/use-controllable-state";
import { isTouch } from "@/lib/utils";
import { ArrowLeftIcon, BrainIcon, ExternalLinkIcon, PlugIcon } from "@/lib/icons";
import { u } from "@/styles/base";
import { sx, type Sx } from "@/styles/sx";

const S = {
  // Spans the composer row, so the panel — clamped to this box by `S.content`
  // below — opens as wide as the composer rather than as wide as the trigger.
  picker: {
    display: "flex",
    minWidth: "0",
    flex: "1",
  },
  // A percentage max-width resolves against the `Popover` root, which is
  // `S.picker`. PopoverContent clamps to the viewport by default, which is too
  // wide for a chat surface narrower than the panel — the chatbox.
  content: { maxWidth: "100%" },
  // The last row of the panel, never the first: the popover gives its focus to
  // the first focusable child, which must stay the input. Outside the list too,
  // so the filter can never hide the way back.
  strip: {
    display: "flex",
    flexShrink: "0",
    alignItems: "center",
  },
  // Only where the strip follows the list. Where the field is between them —
  // a phone, see `listFirst` — the field's own bottom border is that line.
  stripLine: { borderTop: "1px solid var(--border)" },
  // `xs` for the text and the glyphs, which is what a row of the list runs at.
  // The height is the one thing it keeps of `sm` — a strip is still a target.
  stripButton: { height: "2rem", borderRadius: "0" },
  back: {
    flex: "1",
    justifyContent: "flex-start",
    color: "var(--muted-foreground)",
  },
  // The key that does the same thing, on the far side of the same button. The
  // glyph is missing from many mono faces, so it takes the button's own font
  // rather than the `kbd` default.
  backHint: {
    marginLeft: "auto",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    lineHeight: "1",
    opacity: "0.7",
  },
  // Scrolls rather than overflows: with a keyboard up, the panel may be shorter
  // than the field, the link and the note together.
  key: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    overflowY: "auto",
    padding: "0.75rem",
  },
  keyLabel: {
    fontSize: "0.75rem",
    fontWeight: "500",
  },
  keyRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  keyLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  keyNote: {
    margin: "0",
    fontSize: "0.75rem",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    padding: "1.5rem 0.75rem",
    fontSize: "0.875rem",
  },
} satisfies Record<string, Sx>;

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

const touch = isTouch();

/** Both fields the panel holds — search and key — carry it on a phone. */
const noZoom = touch ? u.noZoom : undefined;

/**
 * On a phone the list goes **above** the field, not below it.
 *
 * The panel is bottom-anchored — it grows up from the trigger — so anything
 * that takes room off the top moves every row down except the last. A keyboard
 * opening is exactly that, and the tap that opened it is on the field: with the
 * field first, it drops out from under the finger before the tap resolves, the
 * tap lands on whatever row took its place, and nothing is focused. Last, it
 * cannot move — the list gives the height up instead — and it sits against the
 * keyboard, which is where a field being typed into belongs.
 */
// It carries the line under it too: the strip drops its own, so the seams stay
// one per row wherever the field sits.
const listFirst = touch ? { borderBottom: "1px solid var(--border)", order: "-1" } : undefined;

/** Which of the four lists the panel is showing. */
type Level = "providers" | "models" | "key" | "thinking";

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

export interface ChatPickerProps {
  /** The models of the chosen provider. */
  models?: ChatModel[];
  /** The catalog is still on its way — the list says so instead of looking empty. */
  modelsLoading?: boolean;
  modelId?: string;
  onModelChange?: (id: string) => void;
  /**
   * The providers, the level ahead of the models. Until one is chosen the panel
   * opens on this list, and nothing leads out of it.
   */
  providers?: ChatProvider[];
  providerId?: string;
  /** Called with a provider that is ready to run — keyed ones, after the key. */
  onProviderChange?: (id: string) => void;
  onSaveKey?: (providerId: string, key: string) => void;
  /** Heads the model list. Only needed when the picker carries no providers. */
  providerLabel?: string;
  /**
   * How hard the chosen model thinks. Paired with `thinkingLevels`: a model
   * that offers one level offers no choice, and the level is then not shown.
   */
  thinkingLevel?: ChatThinkingLevel;
  /** What the chosen model offers, in order. */
  thinkingLevels?: ChatThinkingLevel[];
  onThinkingLevelChange?: (level: ChatThinkingLevel) => void;
  /**
   * The panel, controlled — how a caller asks the question itself. `AgentChat`
   * opens it when a message is sent before any provider is chosen.
   */
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

/**
 * Provider, then model, then the key if one is needed — one popover, three
 * levels. There is no key screen and no provider screen anywhere else: this is
 * the whole of the choosing, and it sits in the composer next to send.
 */
export function ChatPicker({
  models,
  modelsLoading,
  modelId,
  onModelChange,
  providers,
  providerId,
  onProviderChange,
  onSaveKey,
  providerLabel,
  thinkingLevel = "off",
  thinkingLevels,
  onThinkingLevelChange,
  pickerOpen,
  onPickerOpenChange,
}: ChatPickerProps) {
  const [open, setOpen] = useControllableState({
    defaultProp: false,
    onChange: onPickerOpenChange,
    prop: pickerOpen,
  });
  // Null is the level the state implies — a provider is chosen, or it is not.
  const [level, setLevel] = useState<Level | null>(null);
  const [keying, setKeying] = useState<ChatProvider | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  const model = models?.find((entry) => entry.id === modelId);
  const provider = providers?.find((entry) => entry.id === providerId);
  const shown: Level = level ?? (!providers || provider ? "models" : "providers");
  // One level is no choice — a model with no reasoning offers `off` alone.
  const levels = thinkingLevels && thinkingLevels.length > 1 ? thinkingLevels : undefined;

  // The query belongs to the level it was typed in — it would hide the other.
  const go = (next: Level | null) => {
    setLevel(next);
    setSearch("");
    setDraft("");
  };

  // A provider is half the choice. Picking one goes on to its models rather
  // than closing, so nothing runs on a model nobody looked at.
  const pick = (entry: ChatProvider) => {
    // A key it does not have yet comes first: the provider only changes once it
    // can answer.
    if (entry.keyed && !entry.hasKey) {
      setKeying(entry);
      go("key");
      return;
    }
    if (entry.id !== providerId) onProviderChange?.(entry.id);
    go("models");
  };

  const save = () => {
    const key = draft.trim();
    if (!keying || !key) return;
    onSaveKey?.(keying.id, key);
    if (keying.id !== providerId) onProviderChange?.(keying.id);
    go("models");
  };

  // Backspace on an empty field is the way back, in both fields: nothing is
  // left to delete, and the level behind is what a delete would reach next.
  const back = (event: KeyboardEvent) => {
    const field = event.currentTarget as HTMLInputElement;
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    if (field.value || shown === "providers" || !providers) return;
    event.preventDefault();
    go("providers");
  };

  // The panel takes focus once, on open, so every level reached from inside it
  // must hand the focus back itself: a row or a strip button keeps the focus it
  // was clicked with, which leaves both typing and the arrow keys dead.
  //
  // Not the search field on a phone, though — see `autoFocus` below. The keyboard
  // it raises is subtracted from the room the panel measured, and that room is
  // the whole of the list: a panel focused on open is a list two rows tall before
  // it is read once. The field is a tap away under it, and the panel gives the
  // height up only for someone who asked to filter.
  //
  // The key level is the other way round: typing the key is the only thing that
  // level is for, so it takes the focus on a phone as well.
  //
  // The panel comes from a bubbled `focusin` rather than a ref, because a ref on
  // a component is the component — preact forwards none to the element.
  const panelRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (touch && shown !== "key") return;
    // One field to a level: the search, or the key.
    panelRef.current?.querySelector("input")?.focus();
  }, [shown]);

  return (
    <ModelSelector
      onOpenChange={(next) => {
        setOpen(next);
        go(null);
      }}
      onValueChange={onModelChange}
      open={open}
      style={S.picker}
      value={modelId}
    >
      <ModelSelectorTrigger variant="ghost">
        {/* Model and provider, because one model id says nothing about where it
            runs — a gateway carries the same names as the vendor. */}
        <ModelSelectorValue>
          {model?.name ?? provider?.label ?? "Select a provider"}
          {model && provider && <span style={u.muted}> ({provider.label})</span>}
        </ModelSelectorValue>
      </ModelSelectorTrigger>

      {/* Upwards: the composer is the last row of the surface. On a phone the
          panel itself takes the focus rather than the field inside it — the
          keyboard is what the list would be paying for — and it opens over the
          composer rather than on top of it: with a keyboard up, the rows it
          would leave under itself are a third of the list. */}
      <ModelSelectorContent
        autoFocus={!touch}
        fill={touch}
        onFocusIn={(event) => {
          panelRef.current = event.currentTarget;
        }}
        onSearchChange={setSearch}
        search={search}
        side="top"
        style={S.content}
      >
        {/* Seven rows need no filter, so the thinking level carries none. */}
        {(shown === "providers" || shown === "models") && (
          <ModelSelectorInput
            onKeyDown={back}
            placeholder={shown === "providers" ? "Search providers…" : "Search models…"}
            style={noZoom}
          />
        )}

        {shown === "key" && keying ? (
          <div style={S.key}>
            <span style={S.keyLabel}>{keying.label} API key</span>
            <div style={S.keyRow}>
              <Input
                autoComplete="off"
                onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
                onKeyDown={(event) => {
                  back(event);
                  if (event.defaultPrevented || event.key !== "Enter") return;
                  event.preventDefault();
                  save();
                }}
                placeholder={keying.keyPlaceholder}
                style={noZoom}
                type="password"
                value={draft}
              />
              <Button onClick={save} size="sm" type="button">
                Save
              </Button>
            </div>
            {keying.keyUrl && (
              <a href={keying.keyUrl} rel="noreferrer noopener" style={S.keyLink} target="_blank">
                Get a key
                <ExternalLinkIcon style={u.icon} />
              </a>
            )}
            {/* <p style={sx(u.muted, S.keyNote)}>
              {keying.hasKey
                ? "A key is saved. A new one replaces it."
                : "Kept in this browser, and sent only to the provider you pick."}
            </p> */}
          </div>
        ) : (
          <ModelSelectorList style={listFirst}>
            {shown === "models" && modelsLoading && (
              <div style={S.loading}>
                <Spinner />
                <span style={u.muted}>Loading the models…</span>
              </div>
            )}

            <ModelSelectorEmpty>
              {shown === "providers" ? "No providers found." : "No models found."}
            </ModelSelectorEmpty>

            {shown === "thinking" ? (
              <ModelSelectorGroup heading="Thinking">
                {levels?.map((entry) => (
                  <ModelSelectorItem
                    checked={entry === thinkingLevel}
                    key={entry}
                    // Not a model, so the row must not commit itself as one.
                    onClick={(event) => {
                      event.preventDefault();
                      onThinkingLevelChange?.(entry);
                      go("models");
                    }}
                    textValue={THINKING_LABEL[entry]}
                    value={entry}
                  >
                    <ModelSelectorName>{THINKING_LABEL[entry]}</ModelSelectorName>
                  </ModelSelectorItem>
                ))}
              </ModelSelectorGroup>
            ) : shown === "providers" ? (
              <ModelSelectorGroup heading="Providers">
                {providers?.map((entry) => (
                  <ModelSelectorItem
                    checked={entry.id === providerId}
                    key={entry.id}
                    // Not a model: `preventDefault` keeps the row from
                    // committing itself as the chosen value.
                    onClick={(event) => {
                      event.preventDefault();
                      pick(entry);
                    }}
                    textValue={entry.label}
                    title={entry.note}
                    value={entry.id}
                  >
                    <ModelSelectorName>{entry.label}</ModelSelectorName>
                    <ModelSelectorShortcut>
                      {!entry.keyed ? "Free" : entry.hasKey ? "Key" : "Needs key"}
                    </ModelSelectorShortcut>
                  </ModelSelectorItem>
                ))}
              </ModelSelectorGroup>
            ) : (
              <ModelSelectorGroup heading={provider?.label ?? providerLabel ?? "Models"}>
                {models?.map((entry) => (
                  <ModelSelectorItem key={entry.id} textValue={entry.name} value={entry.id}>
                    <ModelSelectorName>{entry.name}</ModelSelectorName>
                    <ModelSelectorShortcut>
                      {compact.format(entry.contextWindow)}
                    </ModelSelectorShortcut>
                  </ModelSelectorItem>
                ))}
              </ModelSelectorGroup>
            )}
          </ModelSelectorList>
        )}

        {shown !== "providers" && (providers || levels) && (
          <div style={sx(S.strip, !touch && S.stripLine)}>
            {/* The thinking level is reached from the models, so it goes back
                there; every other level came from the providers. */}
            {(shown === "thinking" || providers) && (
              <Button
                // The key, not a second name for the button: the glyph is hidden
                // from the reader, which gets the shortcut as a shortcut.
                aria-keyshortcuts={shown === "thinking" ? undefined : "Backspace"}
                onClick={() => go(shown === "thinking" ? "models" : "providers")}
                size="xs"
                style={sx(S.stripButton, S.back)}
                // The composer is a form: a bare button would submit it.
                type="button"
                variant="ghost"
              >
                <ArrowLeftIcon />
                {shown === "thinking" ? "Models" : "Providers"}
                {/* Only while the field it listens on is empty — see `back`. */}
                {shown !== "thinking" && (
                  <kbd aria-hidden="true" style={S.backHint} title="Backspace">
                    ⌫
                  </kbd>
                )}
              </Button>
            )}
            {shown === "models" && levels && (
              <Button
                // The strip has room for the level alone, which names nothing
                // on its own — the reader gets what the word is a level of.
                aria-label={`Thinking level: ${THINKING_LABEL[thinkingLevel]}`}
                onClick={() => go("thinking")}
                size="xs"
                style={S.stripButton}
                title="Thinking level"
                type="button"
                variant="ghost"
              >
                <BrainIcon />
                {THINKING_LABEL[thinkingLevel]}
              </Button>
            )}
            {shown === "models" && provider?.keyed && (
              <Button
                onClick={() => {
                  setKeying(provider);
                  go("key");
                }}
                size="xs"
                style={S.stripButton}
                type="button"
                variant="ghost"
              >
                <PlugIcon />
                Key
              </Button>
            )}
          </div>
        )}
      </ModelSelectorContent>
    </ModelSelector>
  );
}
