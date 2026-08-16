import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import type { ChatModel, ChatProvider, ChatThinkingLevel } from "./types.ts";
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
  SlidersIcon,
  TrashIcon,
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
  providerLabel,
  thinkingLevel = "off",
  thinkingLevels,
  onThinkingLevelChange,
  style,
}: ChatSettingsPageProps) {
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
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
  // One level is no choice — a model with no reasoning offers `off` alone.
  const levels = thinkingLevels && thinkingLevels.length > 1 ? thinkingLevels : undefined;

  const query = search.trim().toLowerCase();
  const shown = query
    ? models?.filter(
        (entry) =>
          entry.name.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query),
      )
    : models;

  // A list this long is read by typing at it, so the field takes the focus as
  // soon as a provider has one — on arrival, and again when another provider's
  // catalog lands. Not on a finger, where focus raises the keyboard over the
  // models the field is there to filter, and not while a key is being typed.
  const searchable = !pending && !!models && models.length > SEARCH_FROM;

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
              nine to choose between are worth a click rather than a third of
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
          {stored ? (
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
                : "Kept in this browser, and sent only to the provider you pick."}
            </p>
          ) : onForgetKey ? (
            // What removing it costs: a keyed provider answers nothing without
            // one, so it is a provider to set up again.
            <p style={S.note}>Removing the key stops {target.label} until another is saved.</p>
          ) : null}
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

        {/* The models under a heading naming the provider being set up are the
            previous provider's — so say what is missing rather than list them. */}
        {pending ? (
          <p style={S.note}>Save the key to load {pending.label}’s models.</p>
        ) : modelsLoading ? (
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
            {shown?.map((entry, index) => (
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
          </div>
        )}
      </section>
    </div>
  );
}

/** What a provider costs to use, in two words on the far side of its row. */
function providerState(provider: ChatProvider): string {
  if (!provider.keyed) return "Free";
  return provider.hasKey ? "Configured" : "BYOK";
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
