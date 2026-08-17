// Docs: @docs/3.widget.md
import type { ChatProvider } from "../types.ts";
import { S, SettingsSection } from "./section.tsx";
import { buttonSx } from "../../ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu.tsx";
import { CheckIcon, ChevronDownIcon } from "../../../lib/icons.tsx";
import { useInteraction } from "../../../lib/use-interaction.ts";
import { sx, type Sx } from "../../../styles/sx.ts";

const P = {
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
} satisfies Record<string, Sx>;

/**
 * Which provider answers, as one line and a menu.
 *
 * A dropdown, not a list: which provider is set is one line, and the eight to
 * choose between are worth a click rather than a third of the page above the
 * models they are chosen for.
 */
export function SettingsProvider({
  chosen,
  onPick,
  providers,
}: {
  /** What the page is about — the provider running, or the one just clicked. */
  chosen?: ChatProvider;
  onPick: (provider: ChatProvider) => void;
  providers: ChatProvider[];
}) {
  return (
    <SettingsSection title="Provider">
      {/* Open on arrival where nothing is running, which is the first visit and
          the reason the page opened at all — the question the page is asking is
          which provider, so it asks it rather than showing a shut box that has
          to be found. `defaultOpen` is read once, at mount, so closing it stays
          closed and a page opened with a provider set opens nothing. */}
      <DropdownMenu defaultOpen={!chosen} style={P.menu}>
        <ProviderTrigger provider={chosen} />
        <DropdownMenuContent align="start" side="bottom" style={P.menuContent}>
          {providers.map((entry) => (
            <DropdownMenuItem
              aria-checked={entry.id === chosen?.id}
              key={entry.id}
              onClick={() => onPick(entry)}
              // A menu already answers the arrow keys, so the role a set of one
              // is owed costs nothing here — see `ui/dropdown-menu.tsx`.
              role="menuitemradio"
              style={P.menuItem}
              title={entry.note}
            >
              <CheckIcon style={sx(S.check, entry.id !== chosen?.id && S.checkOff)} />
              <span style={S.rowName}>{entry.label}</span>
              <span style={S.rowMeta}>{providerState(entry)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SettingsSection>
  );
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
        P.menuTrigger,
      )}
      {...handlers}
    >
      <span style={P.menuValue}>{provider?.label ?? "Select a provider"}</span>
      {provider && <span style={S.rowMeta}>{providerState(provider)}</span>}
      <ChevronDownIcon style={sx(P.chevron, !provider && P.chevronAlone)} />
    </DropdownMenuTrigger>
  );
}
