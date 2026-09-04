import type { ComponentChild, JSX, VNode } from "preact";
import { cn } from "./utils.ts";
import { u } from "../styles/base.ts";
import { sx, type Sx, type WithSx } from "../styles/sx.ts";

// Icon geometry traced from lucide (ISC). Inlined so the bundle carries no
// React icon package.

export type IconProps = Omit<JSX.SVGAttributes<SVGSVGElement>, "size"> & {
  size?: number | string;
};

function Icon({ size = 24, className, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("lucide", className)}
      fill="none"
      height={size}
      stroke="currentColor"
      // Hyphenated, not camelCase: preact writes SVG attribute names verbatim,
      // and the SVG namespace does not lowercase them, so `strokeWidth` is inert.
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width={2}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 15V3" />
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
  </Icon>
);

export const CheckCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const XCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </Icon>
);

export const CircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
  </Icon>
);

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Icon>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);

const S = {
  // Icon size is baked in — every caller wanted it, and the transition has to
  // sit beside the transform it animates.
  chevron: { ...u.icon, transition: "transform 0.2s ease" },
} satisfies Record<string, Sx>;

export type ChevronProps = Omit<IconProps, "children" | "style"> & {
  /** True when the section the chevron marks is open. */
  open: boolean;
  /** Narrowed to a plain object, so it can fold into `sx()` — see `styles/sx.ts`. */
  style?: Sx;
  /**
   * Degrees the chevron turns between closed and open. 180 flips a
   * down-pointing chevron to point up; 90 turns a right-pointing chevron to
   * point down toward the content it discloses. Default 180.
   */
  turn?: 90 | 180;
};

/**
 * A collapsible's disclosure chevron. One component covers every rotation a
 * trigger needs: a 180 turn (points down, flips to point up) or a 90 turn
 * (points right, turns to point down) — the "points right when closed" case
 * is just `turn={90}` with `open` false, not a separate mode.
 */
export function Chevron({ open, turn = 180, style, ...props }: ChevronProps) {
  const Glyph = turn === 90 ? ChevronRightIcon : ChevronDownIcon;
  return (
    <Glyph style={sx(S.chevron, open && { transform: `rotate(${turn}deg)` }, style)} {...props} />
  );
}

export const CircleDotIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="1" />
  </Icon>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icon>
);

export const ExternalLinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </Icon>
);

export const MessageCircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </Icon>
);

export const CodeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m16 18 6-6-6-6" />
    <path d="m8 6-6 6 6 6" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Icon>
);

export const CornerDownLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    <path d="m9 10-5 5 5 5" />
  </Icon>
);

export const SquareIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="18" rx="2" width="18" x="3" y="3" />
  </Icon>
);

export const XIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);

export const LoaderIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </Icon>
);

export const WrenchIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" />
  </Icon>
);

export const BrainIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 18V5" />
    <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
    <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
    <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
    <path d="M18 18a4 4 0 0 0 2-7.464" />
    <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
    <path d="M6 18a4 4 0 0 1-2-7.464" />
    <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
  </Icon>
);

/**
 * The agentak mark, not a lucide glyph: `assets/agentak.svg` scaled from its
 * 52-unit box into the 24 the others use, so it takes the same stroke width and
 * sits on the same grid. The eyes are the one filled part, so they name the
 * colour the rest inherits. The logo blinks; an icon this size does not.
 */
export const BotIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="16.15" rx="5.54" width="13.85" x="5.08" y="3.92" />
    <path d="M2.54 10.85q-1.85 2.77 0 6" />
    <path d="M21.46 10.85q1.85 2.77 0 6" />
    <path d="M10.62 14.54q1.38 1.62 2.77 0" />
    <circle cx="9.23" cy="11.31" fill="currentColor" r="1.11" stroke="none" />
    <circle cx="14.77" cy="11.31" fill="currentColor" r="1.11" stroke="none" />
  </Icon>
);

export const MicIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 19v3" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <rect height="13" rx="3" width="6" x="9" y="2" />
  </Icon>
);

export const Volume2Icon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
    <path d="M16 9a5 5 0 0 1 0 6" />
    <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
  </Icon>
);

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </Icon>
);

export const RotateCcwIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </Icon>
);

export const BookmarkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Icon>
);

export const PaperclipIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </Icon>
);

export const FileIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </Icon>
);

export const GitCommitIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M3 12h6" />
    <path d="M15 12h6" />
  </Icon>
);

export const GitBranchIcon = (props: IconProps) => (
  <Icon {...props}>
    <line x1="6" x2="6" y1="3" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </Icon>
);

export const MinusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14" />
  </Icon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Icon>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </Icon>
);

export const BookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
  </Icon>
);

export const FolderIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </Icon>
);

export const FolderOpenIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" />
  </Icon>
);

export const PackageIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m7.5 4.27 9 5.15" />
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5" />
    <path d="M12 22V12" />
  </Icon>
);

export const DotIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12.1" cy="12.1" r="1" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </Icon>
);

export const ChevronsUpDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m7 15 5 5 5-5" />
    <path d="m7 9 5-5 5 5" />
  </Icon>
);

export const TerminalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 17 6-6-6-6" />
    <path d="M12 19h8" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </Icon>
);

export const KeyIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m15.5 7.5 3 3L22 7l-3-3" />
    <path d="m21 2-9.6 9.6" />
    <circle cx="7.5" cy="15.5" r="5.5" />
  </Icon>
);

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);

/** The same lock with the shackle open — what the keys are while a visit lasts. */
export const UnlockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </Icon>
);

/** The gate in front of a tool call, standing. */
export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </Icon>
);

/** And the same gate crossed out — the calls run unasked. */
export const ShieldOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m2 2 20 20" />
    <path d="M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67 0c1.9-.65 3.79-1.5 5.19-2.93" />
    <path d="M9.3 3.65a12.3 12.3 0 0 0 1.94-1.37 1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.8 9.8 0 0 1-.08 1.26" />
  </Icon>
);

export const PlugIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
  </Icon>
);

export const SlidersIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 7h-9" />
    <path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" />
    <circle cx="7" cy="7" r="3" />
  </Icon>
);

/** A panel folding back into the edge it came from — a host's "put this away". */
export const PanelRightCloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect height="18" rx="2" width="18" x="3" y="3" />
    <path d="M15 3v18" />
    <path d="m8 9 3 3-3 3" />
  </Icon>
);

/**
 * The agentak mark — `assets/agentak.svg`, in ink of its own no more.
 *
 * The file it is traced from carries a `<style>`: a scheme-swapped ink and a
 * blink. Neither survives here. This library ships no stylesheet, and a
 * `<style>` inside an inline svg is a stylesheet — one that would reach the
 * host page's own `#agentak` and keyframes. So the ink is `currentColor`, which
 * is what every other icon here paints with, and the eyes hold still.
 *
 * Its frame is the drawing's own, not the 24px grid above: the ears fall
 * outside a `0 0 24 24` box, and refitting the geometry would redraw the logo.
 * `width`/`height` still answer to `size`, so it sits in a row of icons.
 */
export const AgentakIcon = ({ size = 24, className, ...props }: IconProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height={size}
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width={3.2}
    viewBox="6 6.5 52 52"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect height="35" rx="12" width="30" x="17" y="15" />
    <path d="M11.5 30q-4 6 0 13" />
    <path d="M52.5 30q4 6 0 13" />
    <path d="M29 38q3 3.5 6 0" />
    <circle cx="26" cy="31" fill="currentColor" r="2.4" stroke="none" />
    <circle cx="38" cy="31" fill="currentColor" r="2.4" stroke="none" />
  </svg>
);

/**
 * A host's own geometry, in the frame the built-in icons are drawn in.
 *
 * A definition names an icon this library ships, or carries the path data of
 * one it does not — see `ChatIcon` in `components/chat/types.ts`. The data is
 * geometry and never markup, so a host adds an icon without a preact node and
 * without any way to put elements of its own on the surface.
 */
export const PathIcon = ({ paths, ...props }: IconProps & { paths: string[] }) => (
  <Icon {...props}>
    {paths.map((d) => (
      <path d={d} key={d} />
    ))}
  </Icon>
);

/**
 * Runtime marker for the icons above. A component that renders `children` can
 * then size and colour a caller-passed icon without a prop reaching this
 * deep — see `isIconChild`.
 */
type IconComponent = ((props: IconProps) => JSX.Element) & { isIcon: true };

const ICONS: ((props: IconProps) => JSX.Element)[] = [
  ArrowDownIcon,
  DownloadIcon,
  CheckCircleIcon,
  XCircleIcon,
  CircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  AlertTriangleIcon,
  ExternalLinkIcon,
  MessageCircleIcon,
  CodeIcon,
  CheckIcon,
  CopyIcon,
  CornerDownLeftIcon,
  SquareIcon,
  XIcon,
  LoaderIcon,
  WrenchIcon,
  BrainIcon,
  BotIcon,
  MicIcon,
  Volume2Icon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  BookmarkIcon,
  PaperclipIcon,
  FileIcon,
  GitCommitIcon,
  GitBranchIcon,
  PlusIcon,
  MinusIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  BookIcon,
  FolderIcon,
  FolderOpenIcon,
  PackageIcon,
  DotIcon,
  SearchIcon,
  ChevronsUpDownIcon,
  TerminalIcon,
  TrashIcon,
  KeyIcon,
  LockIcon,
  UnlockIcon,
  ShieldIcon,
  ShieldOffIcon,
  PlugIcon,
  SlidersIcon,
  PanelRightCloseIcon,
  AgentakIcon,
];
for (const component of ICONS) (component as IconComponent).isIcon = true;
// The host's own geometry is one of them too, so a button sizes it the same.
(PathIcon as unknown as IconComponent).isIcon = true;

/**
 * True for one of the icons above, or a raw `<svg>` from elsewhere. Narrows to
 * `WithSx`, so a caller can fold a computed style over `child.props.style`
 * with `sx()` — see `styles/sx.ts`.
 */
export function isIconChild(child: ComponentChild): child is VNode<WithSx<IconProps>> {
  if (!child || typeof child !== "object") return false;
  const type = (child as VNode).type;
  return type === "svg" || (typeof type === "function" && (type as IconComponent).isIcon === true);
}

/**
 * The icons a definition can name, by their lucide names.
 *
 * Host chrome is a handful of glyphs — put away, open, go back, read more — so
 * this is a short list and not the whole file: a name map holds every icon it
 * lists in the bundle, and a host whose glyph is not here passes the path data
 * instead. Add a name when a host needs one, not before.
 */
export const CHAT_ICONS = {
  "alert-triangle": AlertTriangleIcon,
  "arrow-left": ArrowLeftIcon,
  "arrow-right": ArrowRightIcon,
  book: BookIcon,
  bot: BotIcon,
  check: CheckIcon,
  clock: ClockIcon,
  code: CodeIcon,
  copy: CopyIcon,
  download: DownloadIcon,
  "external-link": ExternalLinkIcon,
  file: FileIcon,
  key: KeyIcon,
  "message-circle": MessageCircleIcon,
  minus: MinusIcon,
  "panel-right-close": PanelRightCloseIcon,
  plus: PlusIcon,
  "rotate-ccw": RotateCcwIcon,
  search: SearchIcon,
  sliders: SlidersIcon,
  terminal: TerminalIcon,
  trash: TrashIcon,
  wrench: WrenchIcon,
  x: XIcon,
} satisfies Record<string, (props: IconProps) => JSX.Element>;

/** The name of one of them. */
export type ChatIconName = keyof typeof CHAT_ICONS;
