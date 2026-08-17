// Docs: @docs/3.widget.md
import { useState } from "preact/hooks";

import type { ChatKeyLock, ChatModel, ChatProvider, ChatThinkingLevel } from "./types.ts";
import { SettingsKey } from "./settings/key.tsx";
import { SettingsLock } from "./settings/lock.tsx";
import { SettingsModels } from "./settings/models.tsx";
import { SettingsProvider } from "./settings/provider.tsx";
import { SettingsThinking } from "./settings/thinking.tsx";
import { Button } from "../ui/button.tsx";
import { SlidersIcon } from "../../lib/icons.tsx";
import { u } from "../../styles/base.ts";
import { sx, type Sx } from "../../styles/sx.ts";

const S = {
  // A page, not a panel: it takes the room the transcript had, and scrolls as
  // one column. The sections are ordered short to long, so the model list — the
  // only one that can run to hundreds of rows — is last and needs no scroller
  // of its own inside this one.
  page: {
    boxSizing: "border-box",
    display: "flex",
    flex: "1",
    minHeight: "0",
    flexDirection: "column",
    gap: "1.25rem",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: "1rem",
  },
  // The trigger sits in the composer's tool row, where the room is whatever the
  // send button leaves.
  trigger: {
    justifyContent: "flex-start",
    gap: "0.375rem",
    minWidth: "0",
    maxWidth: "100%",
  },
  triggerLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
} satisfies Record<string, Sx>;

export interface ChatSettingsProps {
  /** The models of the chosen provider. */
  models?: ChatModel[];
  /** The catalog is still on its way — the list says so instead of looking empty. */
  modelsLoading?: boolean;
  modelId?: string;
  onModelChange?: (id: string) => void;
  /**
   * The providers. Without them the page shows no provider section and no key
   * section — a session with a fixed model chooses neither.
   */
  providers?: ChatProvider[];
  providerId?: string;
  /** Called with a provider that is ready to run — keyed ones, after the key. */
  onProviderChange?: (id: string) => void;
  onSaveKey?: (providerId: string, key: string) => void;
  /**
   * Drop the key a provider is set up with. Without it a stored key can only be
   * replaced, never taken out — so the section then offers no remove button.
   */
  onForgetKey?: (providerId: string) => void;
  /**
   * The device lock over the stored keys. Without it the page shows no such
   * section — a harness that stores nothing has nothing to lock.
   */
  keyLock?: ChatKeyLock;
  /** Turn the lock on, or off again. Both open the device's own dialog. */
  onKeyLockChange?: (on: boolean) => void;
  /** Ask the device for the key, for this visit. Pairs with a `locked` state. */
  onUnlockKeys?: () => void;
  /** Heads the model list. Only needed when the page carries no providers. */
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
   * The page, controlled — how a caller asks the question itself. `AgentChat`
   * opens it when a message is sent before any provider is chosen. `Chat` holds
   * the flag and shows the page in place of the transcript; the composer's
   * trigger only toggles it.
   */
  pickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
}

export type ChatSettingsPageProps = ChatSettingsProps & {
  /** Merged over the page's own box — `Chat` clears the floating composer with it. */
  style?: Sx;
};

/**
 * The whole of the choosing, as a page rather than a panel.
 *
 * Provider, key, device lock, thinking level and model are five sections of one
 * scrolling column, shown where the transcript was — see `chat.tsx`. Each is a
 * component of its own in `settings/`; this is the state they share and the
 * order they are read in. Nothing drills down: every section states what it is
 * set to, and the models — the one list worth reading through — are open on the
 * page rather than inside a popover the height of a phone keyboard.
 */
export function ChatSettings({
  models,
  modelsLoading,
  modelId,
  onModelChange,
  providers,
  providerId,
  onProviderChange,
  onSaveKey,
  onForgetKey,
  keyLock,
  onKeyLockChange,
  onUnlockKeys,
  providerLabel,
  thinkingLevel = "off",
  thinkingLevels,
  onThinkingLevelChange,
  style,
}: ChatSettingsPageProps) {
  // Whose key field is open: a provider picked that cannot run without one, or
  // one already set up whose key is being replaced.
  const [keying, setKeying] = useState<string | null>(null);

  const provider = providers?.find((entry) => entry.id === providerId);
  const editing = providers?.find((entry) => entry.id === keying);
  // Picked, but it cannot answer yet — `pick` holds a keyed provider back until
  // its key is saved, so `providerId` still names the one before it. A provider
  // with a key is never this, whatever its field is doing.
  const pending = editing?.hasKey ? undefined : editing;
  // What the page is about. The control has to name what was just clicked, or a
  // click on a provider that needs a key looks like a click that did nothing.
  const chosen = pending ?? provider;
  const where = chosen?.label ?? providerLabel;
  const target = chosen?.keyed ? chosen : undefined;
  // Chosen and unable to answer: a keyed provider this browser holds no key for.
  // The row just clicked is one, and so is the provider a session opens on where
  // no key was ever saved — a key is what the page is for either way.
  const unkeyed = chosen?.keyed && !chosen.hasKey;
  // Whether this browser holds a key at all. The lock is about the keys and
  // nothing else on the page, so with none stored it locks nothing — and a
  // provider that needs no key never puts one there. `keyLost` counts: a key is
  // stored under it, and the lock is the reason it cannot be read.
  const keyed = providers?.some((entry) => entry.hasKey || entry.keyLost);
  // One level is no choice — a model with no reasoning offers `off` alone.
  const levels = thinkingLevels && thinkingLevels.length > 1 ? thinkingLevels : undefined;

  // A provider is half the choice, so picking one never closes the page: the
  // model list under it changes to that provider's, which is what to read next.
  const pick = (entry: ChatProvider) => {
    // A key it does not have yet comes first: the provider only changes once it
    // can answer.
    if (entry.keyed && !entry.hasKey) {
      // Tapping the same row again is not a reason to lose what was typed.
      if (entry.id === keying) return;
      setKeying(entry.id);
      return;
    }
    setKeying(null);
    if (entry.id !== providerId) onProviderChange?.(entry.id);
  };

  const save = (key: string) => {
    if (!target) return;
    onSaveKey?.(target.id, key);
    if (target.id !== providerId) onProviderChange?.(target.id);
    setKeying(null);
  };

  // The key goes, and the provider goes with it where it was the one running —
  // the section is then the one a provider that never had a key shows.
  const forget = () => {
    if (!target) return;
    onForgetKey?.(target.id);
    setKeying(null);
  };

  return (
    <div data-slot="chat-settings" style={sx(S.page, style)}>
      {providers && providers.length > 0 && (
        <SettingsProvider chosen={chosen} onPick={pick} providers={providers} />
      )}

      {target && (
        <SettingsKey
          busy={keyLock?.busy}
          editing={keying === target.id}
          // A field per provider: what was typed for one is not a draft for the
          // next, and the section remounts rather than carrying it over.
          key={target.id}
          onEdit={() => setKeying(target.id)}
          onForget={onForgetKey && forget}
          onSave={save}
          onUnlock={onUnlockKeys}
          target={target}
        />
      )}

      {keyLock && keyed && (
        <SettingsLock lock={keyLock} onChange={onKeyLockChange} onUnlock={onUnlockKeys} />
      )}

      {levels && (
        <SettingsThinking level={thinkingLevel} levels={levels} onChange={onThinkingLevelChange} />
      )}

      {/* A provider still waiting on its key has no models to show: what is
          loaded is either the provider before it, under a heading naming this
          one, or this one's own catalog — a list to pick from and then fail a
          turn on. So the section goes rather than standing there saying it is
          empty, and the key field above it is then the one thing to do next. */}
      {!unkeyed && (
        <SettingsModels
          keying={Boolean(keying)}
          label={where}
          loading={modelsLoading}
          modelId={modelId}
          models={models}
          needsProvider={Boolean(providers && !provider)}
          onSelect={onModelChange}
          providerId={providerId}
        />
      )}
    </div>
  );
}

/**
 * What opens the page, in the composer's tool row. It names what is chosen —
 * a model id says nothing about where it runs, so the provider comes with it.
 */
export function ChatSettingsTrigger({
  models,
  modelId,
  providers,
  providerId,
  pickerOpen,
  onPickerOpenChange,
}: ChatSettingsProps) {
  const model = models?.find((entry) => entry.id === modelId);
  const provider = providers?.find((entry) => entry.id === providerId);

  return (
    <Button
      aria-expanded={pickerOpen === true}
      data-slot="chat-settings-trigger"
      onClick={() => onPickerOpenChange?.(!pickerOpen)}
      size="xs"
      style={S.trigger}
      title="Provider, model and thinking level"
      // The composer is a form: a bare button would submit it.
      type="button"
      variant={pickerOpen ? "secondary" : "ghost"}
    >
      <SlidersIcon />
      <span style={S.triggerLabel}>
        {model?.name ?? provider?.label ?? "Select a provider"}
        {model && provider && <span style={u.muted}> ({provider.label})</span>}
      </span>
    </Button>
  );
}
