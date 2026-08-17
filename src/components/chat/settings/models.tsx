// Docs: @docs/3.widget.md
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { byFamily, latest, SEARCH_FROM, wellKnown } from "./catalog.ts";
import type { ChatModel } from "../types.ts";
import { noZoom, S, SettingsSection } from "./section.tsx";
import { Input } from "../../ui/input.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { CheckIcon, ChevronDownIcon } from "../../../lib/icons.tsx";
import { isTouch } from "../../../lib/utils.ts";
import { useInteraction } from "../../../lib/use-interaction.ts";
import { reset } from "../../../styles/base.ts";
import { sx, type Sx } from "../../../styles/sx.ts";

const M = {
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
} satisfies Record<string, Sx>;

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

export interface SettingsModelsProps {
  /** The models of the chosen provider. */
  models?: ChatModel[];
  /** The catalog is still on its way — the list says so instead of looking empty. */
  loading?: boolean;
  modelId?: string;
  onSelect?: (id: string) => void;
  /** Whose models these are, where the provider list is not the answer. */
  label?: string;
  /** Nothing is chosen yet: the list is empty for a reason worth saying. */
  needsProvider?: boolean;
  /** The catalog changes with it, so the search field takes the focus again. */
  providerId?: string;
  /** A key is being typed above — the focus belongs there and not here. */
  keying?: boolean;
}

/**
 * The models, open on the page rather than inside a popover the height of a
 * phone keyboard — this is the one list worth reading through.
 *
 * It is read as a recommendation until it is asked to be a catalog: the newest
 * of each well-known line, with everything else behind the row at its foot. The
 * search field is the other question and reads every model.
 */
export function SettingsModels({
  keying,
  label,
  loading,
  modelId,
  models,
  needsProvider,
  onSelect,
  providerId,
}: SettingsModelsProps) {
  const [search, setSearch] = useState("");
  // The older generations, asked for. A catalog is mostly models nobody picks
  // any more, so the list opens on one row per family.
  const [more, setMore] = useState(false);

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
  const searchable = !!models && models.length > SEARCH_FROM;

  // Preact forwards no ref through a component, so the field is read off the
  // section.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!searchable || keying || isTouch()) return;
    ref.current?.querySelector("input")?.focus();
  }, [searchable, keying, providerId]);

  return (
    <SettingsSection elementRef={ref} title={label ? `Model — ${label}` : "Model"}>
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

      {loading ? (
        <div style={M.loading}>
          <Spinner />
          <span>Loading the models…</span>
        </div>
      ) : !models || models.length === 0 ? (
        <p style={S.note}>
          {needsProvider ? "Choose a provider to see its models." : "No models to choose from."}
        </p>
      ) : shown && shown.length === 0 ? (
        <p style={S.note}>No models match “{search.trim()}”.</p>
      ) : (
        <div aria-label="Model" role="group" style={M.list}>
          {rows?.map((entry, index) => (
            <SettingsRow
              checked={entry.id === modelId}
              first={index === 0}
              key={entry.id}
              meta={`${compact.format(entry.contextWindow)} ctx`}
              onClick={() => onSelect?.(entry.id)}
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
    </SettingsSection>
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
        M.row,
        !first && M.rowLine,
        hovered && M.rowHover,
        focusVisible && M.rowFocus,
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
        M.row,
        M.rowLine,
        M.moreRow,
        hovered && M.rowHover,
        focusVisible && M.rowFocus,
      )}
      type="button"
      {...handlers}
    >
      <ChevronDownIcon style={sx(S.check, open && M.moreOpen)} />
      <span style={S.rowName}>{children}</span>
    </button>
  );
}
