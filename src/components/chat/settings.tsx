// Docs: @docs/3.widget.md
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { ChatKeyLock, ChatModel, ChatProvider, ChatThinkingLevel } from "./types.ts";
import { Button, buttonSx } from "../ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";
import { Input } from "../ui/input.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { isTouch } from "../../lib/utils.ts";
import { useInteraction } from "../../lib/use-interaction.ts";
import {
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  KeyIcon,
  LockIcon,
  SlidersIcon,
  TrashIcon,
  UnlockIcon,
} from "../../lib/icons.tsx";
import { reset, u } from "../../styles/base.ts";
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
  section: {
    display: "flex",
    minWidth: "0",
    flexDirection: "column",
    gap: "0.5rem",
  },
  heading: {
    color: "var(--muted-foreground)",
    fontSize: "0.6875rem",
    fontWeight: "600",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  note: {
    margin: "0",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // A refusal is still a note, in the one colour that says it went wrong.
  noteBad: { color: "var(--destructive)" },
  // The `Popover` root is the anchor and is `inline-block`, which would shrink
  // the whole control to its trigger's text. Block, so the row is the section's
  // width and the panel below can take it too.
  menu: { display: "block", width: "100%" },
  // Was `buttonSx()` over the `outline` variant, plus what a value-and-chevron
  // row needs and a centred label does not.
  menuTrigger: {
    width: "100%",
    justifyContent: "flex-start",
    gap: "0.5rem",
  },
  menuValue: {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // `width` against the root, which is the trigger's row — the panel is as wide
  // as the control that opened it, whatever the longest label is. The cap is the
  // room the popover measured on the side it resolved to; the page it opens in
  // is a scroller, so that room is the page's, not the viewport's.
  menuContent: {
    width: "100%",
    maxWidth: "100%",
    maxHeight: "var(--popover-available, none)",
    overflowY: "auto",
  },
  // A menu row is a finger target first, so it keeps the height a list row has.
  menuItem: {
    minHeight: "2.25rem",
    gap: "0.5rem",
    fontSize: "0.8125rem",
  },
  chevron: { width: "0.875rem", height: "0.875rem", flexShrink: "0", opacity: "0.5" },
  // With nothing chosen there is no state beside the label to push it over.
  chevronAlone: { marginLeft: "auto" },
  // One frame around the rows, and the rows carry the seams between them.
  list: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    background: "var(--surface)",
  },
  // `minHeight` rather than `height`: a long name wraps, and the row grows.
  row: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    minHeight: "2.5rem",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0.625rem",
    outline: "none",
    textAlign: "left",
    fontSize: "0.8125rem",
    transition: "background-color var(--transition), color var(--transition)",
  },
  rowHover: { background: "var(--hover)", color: "var(--hover-foreground)" },
  // Inset, because the row is flush with the frame — an outset ring would be
  // clipped by the list's own `overflow: hidden`.
  rowFocus: { outline: "2px solid var(--ring)", outlineOffset: "-2px" },
  // Every row but the first: one seam per pair, and none against the frame.
  rowLine: { borderTop: "1px solid var(--border)" },
  rowName: {
    flex: "0 1 auto",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // Keeps the far side to itself, whatever the name does.
  rowMeta: {
    marginLeft: "auto",
    flexShrink: "0",
    paddingLeft: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.6875rem",
  },
  // Leading, so the names line up in a column whether or not a row is ticked.
  check: { width: "0.875rem", height: "0.875rem", flexShrink: "0" },
  // `visibility`, not `display`: the box stays, so nothing shifts on a tick.
  checkOff: { visibility: "hidden" },
  // The last row of the list is about the list and not a model, so it is the
  // one row in a quieter colour. Its chevron stands in the check's column, so
  // the words still line up with the names above them.
  moreRow: { color: "var(--muted-foreground)", fontSize: "0.75rem" },
  moreOpen: { transform: "rotate(180deg)" },
  loading: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.625rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // The field and its button, or the two buttons a stored key offers. Either
  // way the row is the section's width and the children take what they need.
  keyRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  keyLink: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    gap: "0.25rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // A scale reads as a scale, so the levels sit in one strip and wrap rather
  // than becoming a list of their own.
  levels: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.375rem",
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

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/** iOS zooms the page in on a field under 16px and never zooms back out. */
const noZoom = isTouch() ? u.noZoom : undefined;

/** Under this many models the field would filter a list already in one view. */
const SEARCH_FROM = 8;

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
 * Provider, key, thinking level and model are four sections of one scrolling
 * column, shown where the transcript was — see `chat.tsx`. Nothing drills down:
 * every section states what it is set to, and the models — the one list worth
 * reading through — are open on the page rather than inside a popover the
 * height of a phone keyboard. The nine providers are a dropdown, because which
 * one is set is a line and choosing another is rare.
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
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  // The older generations, asked for. A catalog is mostly models nobody picks
  // any more, so the list opens on one row per family.
  const [more, setMore] = useState(false);
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
  // A key is already stored and nothing has asked to replace it: there is
  // nothing to type, so the section is one button rather than an empty field.
  const stored = Boolean(target?.hasKey) && editing?.id !== target?.id;
  // The stored key is there and shut. Nothing can be done with it but unlock,
  // so that is what the section offers — with the field one click away, because
  // a passkey that is gone leaves typing another key as the only way back.
  const shut = stored && Boolean(target?.locked);
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

  // A catalog reads oldest first, so a family's newest model is at the foot of
  // it — Sonnet 4.5 over Sonnet 5. Reversed and then grouped, the list leads
  // with the models worth reading, which is what a picker of hundreds of rows
  // is opened for.
  const ordered = models && byFamily([...models].reverse());

  const query = search.trim().toLowerCase();
  const shown = query
    ? ordered?.filter(
        (entry) =>
          entry.name.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query),
      )
    : ordered;

  // Collapsed after the filter, so what the field matched is what is collapsed:
  // a search for one family reads as that family's newest, and the older rows of
  // it are what the button then offers.
  const heads = shown && latest(shown, modelId);
  // With nothing typed the list is a recommendation rather than a catalog, so it
  // is the lines a person asks for by name — Claude, GPT, Gemini, Qwen — and the
  // long tail of a gateway's hundreds is behind the button with the older
  // releases. A search is the other question and reads the whole catalog.
  const known = !query && heads && wellKnown(heads, modelId);
  const rows = more ? shown : known || heads;
  // Counted off the collapsed list either way, so the button says the same
  // number whichever state it is in.
  const rest = shown ? shown.length - (known || heads || shown).length : 0;

  // A list this long is read by typing at it, so the field takes the focus as
  // soon as a provider has one — on arrival, and again when another provider's
  // catalog lands. Not on a finger, where focus raises the keyboard over the
  // models the field is there to filter, and not while a key is being typed.
  const searchable = !unkeyed && !!models && models.length > SEARCH_FROM;

  // The field is the only thing this section is for, and it is reached by a tap
  // on a provider that needs a key — so it takes the focus, phone or not. Preact
  // forwards no ref through a component, so the field is read off the section.
  const keyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (keying) keyRef.current?.querySelector("input")?.focus();
  }, [keying]);

  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchable || keying || isTouch()) return;
    searchRef.current?.querySelector("input")?.focus();
  }, [searchable, keying, providerId]);

  // A provider is half the choice, so picking one never closes the page: the
  // model list under it changes to that provider's, which is what to read next.
  const pick = (entry: ChatProvider) => {
    // A key it does not have yet comes first: the provider only changes once it
    // can answer.
    if (entry.keyed && !entry.hasKey) {
      // Tapping the same row again is not a reason to lose what was typed.
      if (entry.id === keying) return;
      setKeying(entry.id);
      setDraft("");
      return;
    }
    setKeying(null);
    if (entry.id !== providerId) onProviderChange?.(entry.id);
  };

  const save = () => {
    const key = draft.trim();
    if (!target || !key) return;
    onSaveKey?.(target.id, key);
    if (target.id !== providerId) onProviderChange?.(target.id);
    setDraft("");
    setKeying(null);
  };

  // The key goes, and the provider goes with it where it was the one running —
  // the section is then the one a provider that never had a key shows.
  const forget = () => {
    if (!target) return;
    onForgetKey?.(target.id);
    setDraft("");
    setKeying(null);
  };

  return (
    <div data-slot="chat-settings" style={sx(S.page, style)}>
      {providers && providers.length > 0 && (
        <section style={S.section}>
          <h3 style={sx(reset.text, S.heading)}>Provider</h3>
          {/* A dropdown, not a list: which provider is set is one line, and the
              eight to choose between are worth a click rather than a third of
              the page above the models they are chosen for.

              Open on arrival where nothing is running, which is the first visit
              and the reason the page opened at all — the question the page is
              asking is which provider, so it asks it rather than showing a shut
              box that has to be found. `defaultOpen` is read once, at mount, so
              closing it stays closed and a page opened with a provider set
              opens nothing. */}
          <DropdownMenu defaultOpen={!chosen} style={S.menu}>
            <ProviderTrigger provider={chosen} />
            <DropdownMenuContent align="start" side="bottom" style={S.menuContent}>
              {providers.map((entry) => (
                <DropdownMenuItem
                  aria-checked={entry.id === chosen?.id}
                  key={entry.id}
                  onClick={() => pick(entry)}
                  // A menu already answers the arrow keys, so the role a set of
                  // one is owed costs nothing here — see `ui/dropdown-menu.tsx`.
                  role="menuitemradio"
                  style={S.menuItem}
                  title={entry.note}
                >
                  <CheckIcon style={sx(S.check, entry.id !== chosen?.id && S.checkOff)} />
                  <span style={S.rowName}>{entry.label}</span>
                  <span style={S.rowMeta}>{providerState(entry)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </section>
      )}

      {target && (
        <section ref={keyRef} style={S.section}>
          <h3 style={sx(reset.text, S.heading)}>{target.label} API key</h3>
          {shut ? (
            <div style={S.keyRow}>
              <Button
                disabled={keyLock?.busy}
                onClick={() => onUnlockKeys?.()}
                size="sm"
                type="button"
              >
                <UnlockIcon />
                Unlock
              </Button>
              <Button
                onClick={() => {
                  setKeying(target.id);
                  setDraft("");
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <KeyIcon />
                Use another key
              </Button>
            </div>
          ) : stored ? (
            // The key itself is never shown — nothing reads one back out of
            // storage to fill a field with, and a row of dots says no more than
            // the button does. So the two things left to do with one are the
            // whole of this row: type another, or take it out.
            <div style={S.keyRow}>
              <Button
                onClick={() => {
                  setKeying(target.id);
                  setDraft("");
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <KeyIcon />
                Change key
              </Button>
              {onForgetKey && (
                <Button
                  onClick={forget}
                  size="sm"
                  title={`Remove the ${target.label} key`}
                  type="button"
                  variant="ghost"
                >
                  <TrashIcon />
                  Remove
                </Button>
              )}
            </div>
          ) : (
            <div style={S.keyRow}>
              <Input
                autoComplete="off"
                onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  save();
                }}
                placeholder={target.keyPlaceholder}
                style={noZoom}
                type="password"
                value={draft}
              />
              <Button onClick={save} size="sm" type="button">
                Save
              </Button>
            </div>
          )}
          {shut && (
            <p style={S.note}>
              The saved key is locked to this device. Unlock it, or save another one.
            </p>
          )}
          {!stored && target.keyUrl && (
            <a href={target.keyUrl} rel="noreferrer noopener" style={S.keyLink} target="_blank">
              Get a key
              <ExternalLinkIcon style={u.icon} />
            </a>
          )}
          {!stored ? (
            <p style={S.note}>
              {target.hasKey
                ? "The new key replaces the one saved."
                : target.keyLost
                  ? // A key is stored under this provider and nothing opens it —
                    // the device lock it was sealed under is gone. An empty field
                    // with no word for it reads as a key that was never saved.
                    "The saved key was locked to a device this browser no longer has. Save another one."
                  : "Kept in this browser, and sent only to the provider you pick."}
            </p>
          ) : shut ? null : onForgetKey ? (
            // What removing it costs: a keyed provider answers nothing without
            // one, so it is a provider to set up again.
            <p style={S.note}>Removing the key stops {target.label} until another is saved.</p>
          ) : null}
        </section>
      )}

      {keyLock && keyed && (
        <section style={S.section}>
          <h3 style={sx(reset.text, S.heading)}>Device lock</h3>
          <div style={S.keyRow}>
            {keyLock.state === "off" ? (
              <Button
                disabled={keyLock.busy}
                onClick={() => onKeyLockChange?.(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                <LockIcon />
                Lock keys to this device
              </Button>
            ) : keyLock.state === "locked" ? (
              <Button
                disabled={keyLock.busy}
                onClick={() => onUnlockKeys?.()}
                size="sm"
                type="button"
              >
                <UnlockIcon />
                Unlock
              </Button>
            ) : (
              <Button
                disabled={keyLock.busy}
                onClick={() => onKeyLockChange?.(false)}
                size="sm"
                type="button"
                variant="outline"
              >
                <UnlockIcon />
                Turn the lock off
              </Button>
            )}
            {keyLock.busy && <Spinner />}
          </div>
          <p style={S.note}>
            {keyLock.state === "off"
              ? "Your keys are encrypted in this browser. Locking them keeps the key that opens them in this device’s own hardware, behind your fingerprint, face or PIN."
              : keyLock.state === "locked"
                ? "Your saved keys are locked. Unlocking them lasts until this page is closed; sending a message asks for them too."
                : "Unlocked until this page is closed. Turning the lock off puts the keys back behind this browser’s own key."}
          </p>
          {keyLock.error && <p style={sx(S.note, S.noteBad)}>{keyLock.error}</p>}
        </section>
      )}

      {levels && (
        <section style={S.section}>
          <h3 style={sx(reset.text, S.heading)}>Thinking</h3>
          <div aria-label="Thinking level" role="group" style={S.levels}>
            {levels.map((entry) => (
              <Button
                aria-pressed={entry === thinkingLevel}
                key={entry}
                onClick={() => onThinkingLevelChange?.(entry)}
                size="xs"
                type="button"
                variant={entry === thinkingLevel ? "default" : "outline"}
              >
                {THINKING_LABEL[entry]}
              </Button>
            ))}
          </div>
        </section>
      )}

      {/* A provider still waiting on its key has no models to show: what is
          loaded is either the provider before it, under a heading naming this
          one, or this one's own catalog — a list to pick from and then fail a
          turn on. So the section goes rather than standing there saying it is
          empty, and the key field above it is then the one thing to do next. */}
      {!unkeyed && (
        <section ref={searchRef} style={S.section}>
          {/* Whose models these are, where the provider list is not the answer —
              a gateway carries the same model names as the vendor. */}
          <h3 style={sx(reset.text, S.heading)}>{where ? `Model — ${where}` : "Model"}</h3>

          {searchable && (
            <Input
              aria-label="Search models"
              onInput={(event) => setSearch((event.target as HTMLInputElement).value)}
              placeholder="Search models…"
              style={noZoom}
              type="search"
              value={search}
            />
          )}

          {modelsLoading ? (
            <div style={S.loading}>
              <Spinner />
              <span>Loading the models…</span>
            </div>
          ) : !models || models.length === 0 ? (
            <p style={S.note}>
              {providers && !provider
                ? "Choose a provider to see its models."
                : "No models to choose from."}
            </p>
          ) : shown && shown.length === 0 ? (
            <p style={S.note}>No models match “{search.trim()}”.</p>
          ) : (
            <div aria-label="Model" role="group" style={S.list}>
              {rows?.map((entry, index) => (
                <SettingsRow
                  checked={entry.id === modelId}
                  first={index === 0}
                  key={entry.id}
                  meta={`${compact.format(entry.contextWindow)} ctx`}
                  onClick={() => onModelChange?.(entry.id)}
                >
                  {entry.name}
                </SettingsRow>
              ))}
              {rest > 0 && (
                <MoreRow onClick={() => setMore(!more)} open={more}>
                  {more ? "Show fewer" : `Show ${rest} more model${rest === 1 ? "" : "s"}`}
                </MoreRow>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** A token that is only a version: `5`, `4`, `v3`, `4o`. */
const VERSION = /^(?:v?\d+|\d+[ac-jln-z])$/;

/** What a version is written on, where it is fused to the name: `qwen3`, `o4`. */
const FUSED = /^([a-z]+?)\d+$/;

/**
 * A date or a build stamp rather than a version: `2024`, `20241022`, and the
 * `2603` of `mistral-small-2603`. Nobody writes a version in four digits, so a
 * run of four, six or eight of them is when a model shipped.
 */
const DATE = /^(?:\d{4}|\d{6}|\d{8})$/;

/** Words a catalog puts on a model that carries no version of its own. */
const NOISE = new Set(["beta", "exp", "experimental", "latest", "preview", "stable"]);

/**
 * The words a vendor names another model with, rather than another release of
 * one. Everything a person would choose between: how big it answers, how hard
 * it thinks, what it was tuned for.
 */
const VARIANT = new Set([
  "air",
  "chat",
  "coder",
  "codex",
  "fast",
  "flash",
  "flex",
  "haiku",
  "instruct",
  "lite",
  "max",
  "medium",
  "mini",
  "nano",
  "opus",
  "plus",
  "pro",
  "reasoner",
  "small",
  "sonnet",
  "thinking",
  "turbo",
  "ultra",
  "vision",
]);

const words = (id: string): string[] =>
  id
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * The family a model belongs to: its id with the release taken out of it, so one
 * row can stand for every generation of the same model.
 *
 * `claude-sonnet-4-5` and `claude-sonnet-5` are one family. `gpt-5` and
 * `gpt-5-mini` are two, because `mini` is another model and not an older one —
 * so a word is kept where it names a variant, or where it carries a number of
 * its own: `70b`, `a3b` and `120b` are what a model is, and `4o` is which
 * release of it this is.
 *
 * A word after the version that names no variant is that release's codename:
 * "GPT 5.6 Luna" is a GPT, so it belongs with GPT 5.5 rather than beside it.
 * A word before the version is always kept, because that is where most vendors
 * write the variant — `mistral-small-3.1`. A name left with nothing is its own
 * family, since a family of everything would collapse the list to one row.
 */
function family(id: string): string {
  const parts: string[] = [];
  let versioned = false;
  for (const word of words(id)) {
    if (NOISE.has(word)) continue;
    if (VERSION.test(word)) {
      versioned = true;
      continue;
    }
    const fused = FUSED.exec(word);
    if (fused) {
      versioned = true;
      parts.push(fused[1]);
      continue;
    }
    if (versioned && !VARIANT.has(word) && !/\d/.test(word)) continue;
    parts.push(word);
  }
  return parts.join("-") || id.toLowerCase();
}

/**
 * The version a model id carries, as the numbers it is written with: `gpt-5.10`
 * is `[5, 10]`, `claude-sonnet-4-5` is `[4, 5]`, `qwen3` is `[3]`.
 *
 * A date ends the reading, because an id writes the version before the date it
 * shipped on and a date read as a version outranks every version there is:
 * `qwen-plus-2025-07-28` is `[]` and stands under `qwen3.7-plus`.
 */
function version(id: string): number[] {
  const parts: number[] = [];
  for (const word of words(id)) {
    // Two parts and no more, because nobody writes a third and the numbers after
    // them are the model's size: `qwen3.8-2.4t-a95b` is 3.8, and the 2.4T is how
    // many parameters answer.
    if (parts.length === 2 || DATE.test(word)) break;
    if (VERSION.test(word)) parts.push(Number.parseInt(word.replace(/^v/, ""), 10));
    else if (FUSED.test(word)) parts.push(Number.parseInt(word.replace(/^[a-z]+/, ""), 10));
  }
  return parts;
}

/**
 * How plain a name is: the words of it that are not numbers. The line is named
 * after its plainest model, and everything else is that model with a word added —
 * a size, a codename, a batch endpoint.
 */
function plainness(id: string): number {
  return words(id).filter((word) => !/^\d/.test(word)).length;
}

/**
 * Newest first, part by part, where a part nobody wrote is a zero: 5.6 over 5.5
 * and 5.10 over 5.9, which is the one thing a catalog's own order gets wrong —
 * it is sorted as words, and as words `5.10` reads under `5.2`.
 */
function compare(one: number[], two: number[]): number {
  for (let index = 0; index < Math.max(one.length, two.length); index++) {
    const diff = (two[index] ?? 0) - (one[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * The generations of one model gathered into one run of rows, newest at the head
 * of it.
 *
 * The families keep the order they arrived in, so a catalog that was curated is
 * still read the way it was written; only the rows inside a family move, and
 * they move by version rather than by name. Equal versions keep their order,
 * because `sort` is stable.
 */
function byFamily(models: ChatModel[]): ChatModel[] {
  const families = new Map<string, ChatModel[]>();
  for (const entry of models) {
    const key = family(entry.id);
    const found = families.get(key);
    if (found) found.push(entry);
    else families.set(key, [entry]);
  }
  return [...families.values()].flatMap((entries) =>
    entries.length > 1 ? entries.sort((a, b) => compare(version(a.id), version(b.id))) : entries,
  );
}

/**
 * The model lines a person asks for by name, one row each before anything is
 * typed. A gateway lists hundreds, and nearly all of them are a name nobody came
 * here for.
 *
 * Each entry is the words that name the line, matched against a family's own
 * words — so it holds however a provider writes the rest of the id, and Claude's
 * four sizes are four entries because they are four things to choose between,
 * where GPT's minis and codexes are one line to pick the newest of. Nothing is
 * lost by a name missing from here: the search reads the whole catalog, and so
 * does the button under the list.
 */
const LINES = [
  ["claude", "opus"],
  ["claude", "sonnet"],
  ["claude", "haiku"],
  ["claude", "fable"],
  ["gpt"],
  ["gemini"],
  ["grok"],
  ["qwen"],
  ["deepseek"],
  ["kimi"],
  ["glm"],
  ["llama"],
  ["mistral"],
  ["minimax"],
  ["gemma"],
];

/**
 * The newest model of each well-known line, or nothing where holding the rest
 * back would not help.
 *
 * A catalog short enough to read is read as it is — a provider offering eight
 * models is not a catalog to be recommended from. And a list where these names
 * are the exception, as the free providers' are, keeps every row: a short list of
 * models nobody has heard of is still the whole of what that provider has.
 *
 * Of one line's models the newest wins, and of two the same age the plainer one —
 * fewest words in its family — because that is the model the line is named after
 * rather than a variant of it. The rows come back in the list's own order, so
 * opening the rest adds rows and moves none.
 */
function wellKnown(models: ChatModel[], running?: string): ChatModel[] | undefined {
  if (models.length <= SEARCH_FROM) return undefined;

  const read = models.map((entry) => ({
    entry,
    parts: family(entry.id).split("-"),
    plain: plainness(entry.id),
    version: version(entry.id),
  }));
  const picks = new Set<ChatModel>();
  for (const line of LINES) {
    let best: (typeof read)[number] | undefined;
    for (const model of read) {
      if (!line.every((word) => model.parts.includes(word))) continue;
      if (!best) {
        best = model;
        continue;
      }
      const order = compare(best.version, model.version);
      if (order > 0 || (order === 0 && model.plain < best.plain)) best = model;
    }
    if (best) picks.add(best.entry);
  }

  // Two rows is not a list to choose from — the whole of what is loaded is a
  // better answer than a page holding one name back.
  if (picks.size < 3) return undefined;
  return models.filter((entry) => picks.has(entry) || entry.id === running);
}

/**
 * The newest of each family, of a list already grouped — so the newest is
 * whichever came first.
 *
 * Every model of that same version comes with it, because a release under three
 * names is three models and not two older ones: GPT 5.6 Luna, Sol and Terra are
 * all rows, and GPT 5.5 is what goes behind the button. The model running is
 * kept whatever its version, because a list that hides it hides the tick with
 * it, and the page would then name a model in the bar that it says nothing
 * about here.
 */
function latest(models: ChatModel[], running?: string): ChatModel[] {
  const heads = new Map<string, number[]>();
  return models.filter((entry) => {
    const key = family(entry.id);
    const head = heads.get(key);
    if (!head) {
      heads.set(key, version(entry.id));
      return true;
    }
    return compare(head, version(entry.id)) === 0 || entry.id === running;
  });
}

/**
 * What a provider costs to use, in two words on the far side of its row. Plain
 * words and not the trade's: a person choosing here reads "needs key", where
 * "BYOK" is something they would have to already know.
 */
function providerState(provider: ChatProvider): string {
  if (!provider.keyed) return "Free";
  if (provider.locked) return "Locked";
  return provider.hasKey ? "Key saved" : "Needs key";
}

/**
 * The chosen provider, and the way to the rest.
 *
 * A trigger cannot itself render `<Button>` — this project has no `asChild`, so
 * `DropdownMenuTrigger` is the button — and takes the same look from
 * `buttonSx()` paired with `useInteraction`.
 */
function ProviderTrigger({ provider }: { provider?: ChatProvider }) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>();

  return (
    <DropdownMenuTrigger
      style={sx(
        buttonSx({ focusVisible, hasIcon: true, hovered, variant: "outline" }),
        S.menuTrigger,
      )}
      {...handlers}
    >
      <span style={S.menuValue}>{provider?.label ?? "Select a provider"}</span>
      {provider && <span style={S.rowMeta}>{providerState(provider)}</span>}
      <ChevronDownIcon style={sx(S.chevron, !provider && S.chevronAlone)} />
    </DropdownMenuTrigger>
  );
}

interface SettingsRowProps {
  checked?: boolean;
  /** The first row carries no seam — the list's own frame is the line above it. */
  first?: boolean;
  /** The far side of the row: what it costs, how big it is, what it needs. */
  meta?: ComponentChildren;
  onClick: () => void;
  title?: string;
  children: ComponentChildren;
}

/**
 * One choice. A hook cannot run inside `.map()`, so the hover and focus states
 * of a row need a component of their own.
 *
 * A pressed button rather than a radio: a radio group owes the reader arrow-key
 * navigation and one tab stop, and claiming the role without them reads worse
 * than a plain list of buttons that tab in order and say what they are set to.
 */
function SettingsRow({ checked = false, first, meta, onClick, title, children }: SettingsRowProps) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>();

  return (
    <button
      aria-pressed={checked}
      data-slot="chat-settings-row"
      onClick={onClick}
      style={sx(
        reset.button,
        S.row,
        !first && S.rowLine,
        hovered && S.rowHover,
        focusVisible && S.rowFocus,
      )}
      title={title}
      type="button"
      {...handlers}
    >
      <CheckIcon style={sx(S.check, !checked && S.checkOff)} />
      <span style={S.rowName}>{children}</span>
      {meta ? <span style={S.rowMeta}>{meta}</span> : null}
    </button>
  );
}

/**
 * The generations behind the list, as its last row.
 *
 * A row and not a button under the frame: it belongs to the list it opens, and
 * the chevron takes the tick's column so the words line up with the names.
 */
function MoreRow({
  onClick,
  open,
  children,
}: {
  onClick: () => void;
  open: boolean;
  children: ComponentChildren;
}) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>();

  return (
    <button
      aria-expanded={open}
      data-slot="chat-settings-more"
      onClick={onClick}
      style={sx(
        reset.button,
        S.row,
        S.rowLine,
        S.moreRow,
        hovered && S.rowHover,
        focusVisible && S.rowFocus,
      )}
      type="button"
      {...handlers}
    >
      <ChevronDownIcon style={sx(S.check, open && S.moreOpen)} />
      <span style={S.rowName}>{children}</span>
    </button>
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
