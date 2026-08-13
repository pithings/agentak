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
import type { ChatModel, ChatProvider } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useControllableState } from "@/lib/use-controllable-state";
import { ArrowLeftIcon, ExternalLinkIcon, PlugIcon } from "@/lib/icons";
import { u } from "@/styles/base";
import { sx, type Sx } from "@/styles/sx";

const S = {
  // Spans the composer row, so the popover — which is `maxWidth: 100%` of this
  // box — opens as wide as the composer rather than as wide as the trigger.
  picker: {
    display: "flex",
    minWidth: "0",
    flex: "1",
  },
  // Under the search input, never over it: the popover gives its focus to the
  // first focusable child, which must stay the input. Outside the list too, so
  // the filter can never hide the way back.
  strip: {
    display: "flex",
    alignItems: "center",
    borderBottom: "1px solid var(--wa-border)",
  },
  back: {
    flex: "1",
    justifyContent: "flex-start",
    borderRadius: "0",
    color: "var(--wa-muted-foreground)",
  },
  key: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
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
    color: "var(--wa-muted-foreground)",
    fontSize: "0.75rem",
  },
  keyNote: {
    margin: "0",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/** Which of the three lists the panel is showing. */
type Level = "providers" | "models" | "key";

export interface ChatPickerProps {
  /** The models of the chosen provider. */
  models?: ChatModel[];
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
   * The panel, controlled — how a caller asks the question itself. `WebAgent`
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
  modelId,
  onModelChange,
  providers,
  providerId,
  onProviderChange,
  onSaveKey,
  providerLabel,
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

  // The query belongs to the level it was typed in — it would hide the other.
  const go = (next: Level | null) => {
    setLevel(next);
    setSearch("");
    setDraft("");
  };

  const close = () => {
    setOpen(false);
    go(null);
  };

  const pick = (entry: ChatProvider) => {
    // A key it does not have yet is the next level, not the chat: the provider
    // only changes once it can answer.
    if (entry.keyed && !entry.hasKey) {
      setKeying(entry);
      go("key");
      return;
    }
    if (entry.id !== providerId) onProviderChange?.(entry.id);
    close();
  };

  const save = () => {
    const key = draft.trim();
    if (!keying || !key) return;
    onSaveKey?.(keying.id, key);
    if (keying.id !== providerId) onProviderChange?.(keying.id);
    close();
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

  // The panel takes focus once, on open, so a level reached from inside it must
  // hand the focus over itself — the search input it came from is unmounted.
  const keyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (shown === "key") keyRef.current?.querySelector("input")?.focus();
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
      <ModelSelectorTrigger size="sm" variant="ghost">
        {/* Model and provider, because one model id says nothing about where it
            runs — a gateway carries the same names as the vendor. */}
        <ModelSelectorValue>
          {model?.name ?? provider?.label ?? "Select a provider"}
          {model && provider && <span style={u.muted}> ({provider.label})</span>}
        </ModelSelectorValue>
      </ModelSelectorTrigger>

      {/* Upwards: the composer is the last row of the surface. */}
      <ModelSelectorContent onSearchChange={setSearch} search={search} side="top">
        {shown !== "key" && (
          <ModelSelectorInput
            onKeyDown={back}
            placeholder={shown === "providers" ? "Search providers…" : "Search models…"}
          />
        )}

        {shown !== "providers" && providers && (
          <div style={S.strip}>
            <Button
              onClick={() => go("providers")}
              size="sm"
              style={S.back}
              // The composer is a form: a bare button would submit it.
              type="button"
              variant="ghost"
            >
              <ArrowLeftIcon style={u.icon} />
              Providers
            </Button>
            {shown === "models" && provider?.keyed && (
              <Button
                onClick={() => {
                  setKeying(provider);
                  go("key");
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <PlugIcon style={u.icon} />
                Key
              </Button>
            )}
          </div>
        )}

        {shown === "key" && keying ? (
          <div ref={keyRef} style={S.key}>
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
            <p style={sx(u.muted, S.keyNote)}>
              {keying.hasKey
                ? "A key is saved. A new one replaces it."
                : "Kept in this browser, and sent only to the provider you pick."}
            </p>
          </div>
        ) : (
          <ModelSelectorList>
            <ModelSelectorEmpty>
              {shown === "providers" ? "No providers found." : "No models found."}
            </ModelSelectorEmpty>

            {shown === "providers" ? (
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
      </ModelSelectorContent>
    </ModelSelector>
  );
}
