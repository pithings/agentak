// Docs: @docs/3.widget.md
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

import { byFamily, latest, SEARCH_FROM, wellKnown } from "./catalog.ts";
import type { ChatModel } from "../types.ts";
import { noZoom, S, SettingsSection } from "./section.tsx";
import { buttonSx } from "../../ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu.tsx";
import { Input } from "../../ui/input.tsx";
import { usePopover } from "../../ui/popover.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { CheckIcon, ChevronDownIcon } from "../../../lib/icons.tsx";
import { isTouch } from "../../../lib/utils.ts";
import { useInteraction } from "../../../lib/use-interaction.ts";
import { sx, type Sx } from "../../../styles/sx.ts";

const M = {
  // The `Popover` root is the anchor and is `inline-block`, which would shrink
  // the whole control to its trigger's text. Block, so the row is the section's
  // width and the panel below can take it too.
  menu: { display: "block", width: "100%" },
  // `buttonSx()` over the `outline` variant, plus what a value-and-chevron row
  // needs and a centred label does not.
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
  // as the control that opened it, whatever the longest name is. A column
  // capped at the room the popover measured: the field keeps its height and the
  // rows give up the rest, since a list of hundreds must scroll inside the panel
  // and not off the end of the surface.
  menuContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    width: "100%",
    maxWidth: "100%",
    maxHeight: "var(--popover-available, none)",
  },
  search: { height: "2rem", fontSize: "0.8125rem" },
  // The one part of the panel that scrolls. `minHeight: 0` is what lets it give
  // height back to the field above it.
  list: {
    display: "flex",
    minHeight: "0",
    flexDirection: "column",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  // A menu row is a finger target first, so it keeps the height a list row has.
  item: {
    minHeight: "2.25rem",
    gap: "0.5rem",
    fontSize: "0.8125rem",
  },
  // The last row is about the list and not a model, so it is the one row in a
  // quieter colour. Its chevron stands in the check's column, so the words still
  // line up with the names above them.
  more: { color: "var(--muted-foreground)", fontSize: "0.75rem" },
  moreOpen: { transform: "rotate(180deg)" },
  chevron: { width: "0.875rem", height: "0.875rem", flexShrink: "0", opacity: "0.5" },
  // With nothing chosen there is no state beside the label to push it over.
  chevronAlone: { marginLeft: "auto" },
  loading: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 0",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  empty: { padding: "0.5rem" },
} satisfies Record<string, Sx>;

const compact = new Intl.NumberFormat("en-US", { notation: "compact" });

/** How big a model answers, on the far side of its row and of the trigger. */
const ctx = (model: ChatModel) => `${compact.format(model.contextWindow)} ctx`;

export interface SettingsModelsProps {
  /** The models of the chosen provider. */
  models?: ChatModel[];
  /** The catalog is still on its way — the section says so instead of looking empty. */
  loading?: boolean;
  modelId?: string;
  onSelect?: (id: string) => void;
  /** Whose models these are, where the provider list is not the answer. */
  label?: string;
  /** Nothing is chosen yet: the list is empty for a reason worth saying. */
  needsProvider?: boolean;
}

/**
 * Which model answers, as one line and a menu.
 *
 * A dropdown, as the provider above it is: which model is set is one line, and
 * a catalog of hundreds is a click rather than the rest of the page. The panel
 * is read as a recommendation until it is asked to be a catalog — the newest of
 * each well-known line, with everything else behind the row at its foot — and
 * the field at its head is the other question, which reads every model.
 */
export function SettingsModels({
  label,
  loading,
  modelId,
  models,
  needsProvider,
  onSelect,
}: SettingsModelsProps) {
  const model = models?.find((entry) => entry.id === modelId);

  return (
    <SettingsSection title={label ? `Model — ${label}` : "Model"}>
      {loading ? (
        <div style={M.loading}>
          <Spinner />
          <span>Loading the models…</span>
        </div>
      ) : !models || models.length === 0 ? (
        <p style={S.note}>
          {needsProvider ? "Choose a provider to see its models." : "No models to choose from."}
        </p>
      ) : (
        /* Open on arrival where no model is running, which is the question this
           section is then the answer to — a page opened by a refused model, or
           by a first message on a provider with nothing picked under it. Left
           shut while a provider is still being chosen, since the list above is
           what opens then. `defaultOpen` is read once, at mount, so closing it
           stays closed. */
        <DropdownMenu
          data-slot="chat-settings-models"
          defaultOpen={!modelId && !needsProvider}
          style={M.menu}
        >
          <ModelTrigger model={model} />
          {/* Never to a finger: the field would raise a keyboard over the rows
              it is there to filter, so the panel keeps the focus itself. */}
          <DropdownMenuContent
            align="start"
            autoFocus={!isTouch()}
            side="bottom"
            style={M.menuContent}
          >
            {/* Mounted with the panel, so a fresh open reads the recommendation
                again rather than the last search typed into it. */}
            <ModelMenu modelId={modelId} models={models} onSelect={onSelect} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </SettingsSection>
  );
}

/**
 * The chosen model, and the way to the rest.
 *
 * A trigger cannot itself render `<Button>` — this project has no `asChild`, so
 * `DropdownMenuTrigger` is the button — and takes the same look from
 * `buttonSx()` paired with `useInteraction`.
 */
function ModelTrigger({ model }: { model?: ChatModel }) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>();

  return (
    <DropdownMenuTrigger
      style={sx(
        buttonSx({ focusVisible, hasIcon: true, hovered, variant: "outline" }),
        M.menuTrigger,
      )}
      {...handlers}
    >
      <span style={M.menuValue}>{model?.name ?? "Select a model"}</span>
      {model && <span style={S.rowMeta}>{ctx(model)}</span>}
      <ChevronDownIcon style={sx(M.chevron, !model && M.chevronAlone)} />
    </DropdownMenuTrigger>
  );
}

/**
 * What is in the panel: the field, the rows it leaves, and the row that opens
 * the rest of the catalog.
 */
function ModelMenu({
  modelId,
  models,
  onSelect,
}: {
  modelId?: string;
  models: ChatModel[];
  onSelect?: (id: string) => void;
}) {
  const { setOpen } = usePopover("SettingsModels");
  const [search, setSearch] = useState("");
  // The older generations, asked for. A catalog is mostly models nobody picks
  // any more, so the panel opens on one row per family.
  const [more, setMore] = useState(false);

  // A catalog reads oldest first, so a family's newest model is at the foot of
  // it — Sonnet 4.5 over Sonnet 5. Reversed and then grouped, the list leads
  // with the models worth reading, which is what a picker of hundreds of rows
  // is opened for.
  const ordered = byFamily([...models].reverse());

  const query = search.trim().toLowerCase();
  const shown = query
    ? ordered.filter(
        (entry) =>
          entry.name.toLowerCase().includes(query) || entry.id.toLowerCase().includes(query),
      )
    : ordered;

  // Collapsed after the filter, so what the field matched is what is collapsed:
  // a search for one family reads as that family's newest, and the older rows of
  // it are what the button then offers.
  const heads = latest(shown, modelId);
  // With nothing typed the list is a recommendation rather than a catalog, so it
  // is the lines a person asks for by name — Claude, GPT, Gemini, Qwen — and the
  // long tail of a gateway's hundreds is behind the button with the older
  // releases. A search is the other question and reads the whole catalog.
  const known = !query && wellKnown(heads, modelId);
  const rows = more ? shown : known || heads;
  // Counted off the collapsed list either way, so the button says the same
  // number whichever state it is in.
  const rest = shown.length - (known || heads).length;

  const pick = (id: string) => {
    setOpen(false);
    onSelect?.(id);
  };

  return (
    <>
      {models.length > SEARCH_FROM && (
        <Input
          aria-label="Search models"
          onInput={(event) => setSearch((event.target as HTMLInputElement).value)}
          onKeyDown={(event) => {
            // The panel walks its rows on the arrows, and this is a field: Home
            // and End belong to the text being typed rather than to the ends of
            // the list, so they are kept from the menu above.
            if (event.key === "Home" || event.key === "End") {
              event.stopPropagation();
              return;
            }
            // Enter takes the top row of what was typed — a name looked for is
            // usually the only one it matched. With nothing typed there is
            // nothing being looked for, and the key is left alone.
            if (event.key !== "Enter" || !query) return;
            event.stopPropagation();
            const first = rows[0];
            if (!first) return;
            event.preventDefault();
            pick(first.id);
          }}
          placeholder="Search models…"
          style={sx(M.search, noZoom)}
          type="search"
          value={search}
        />
      )}

      {shown.length === 0 ? (
        <p style={sx(S.note, M.empty)}>No models match “{search.trim()}”.</p>
      ) : (
        <div style={M.list}>
          {rows.map((entry) => (
            <DropdownMenuItem
              aria-checked={entry.id === modelId}
              key={entry.id}
              onClick={() => pick(entry.id)}
              // A menu already answers the arrow keys, so the role a set of one
              // is owed costs nothing here — see `ui/dropdown-menu.tsx`.
              role="menuitemradio"
              style={M.item}
            >
              <CheckIcon style={sx(S.check, entry.id !== modelId && S.checkOff)} />
              <span style={S.rowName}>{entry.name}</span>
              <span style={S.rowMeta}>{ctx(entry)}</span>
            </DropdownMenuItem>
          ))}
          {rest > 0 && (
            <MoreRow onClick={() => setMore(!more)} open={more}>
              {more ? "Show fewer" : `Show ${rest} more model${rest === 1 ? "" : "s"}`}
            </MoreRow>
          )}
        </div>
      )}
    </>
  );
}

/**
 * The generations behind the list, as its last row.
 *
 * A row and not a button under the panel: it belongs to the list it opens, and
 * the chevron takes the tick's column so the words line up with the names. The
 * click is the one in this menu that chooses nothing, so it keeps the panel up —
 * `preventDefault` is what a menu item says that with.
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
  return (
    <DropdownMenuItem
      aria-expanded={open}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      style={sx(M.item, M.more)}
    >
      <ChevronDownIcon style={sx(S.check, open && M.moreOpen)} />
      <span style={S.rowName}>{children}</span>
    </DropdownMenuItem>
  );
}
