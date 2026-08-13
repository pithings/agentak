import type { Sx } from "@/styles/sx";

/**
 * The tokens, and nothing else. This library injects no stylesheet of its own —
 * every rule that could be reached from an element is an inline style object
 * now, and the two that could not (`::placeholder`, `::selection`) were dropped
 * in favour of `color-scheme`, which is inherited and therefore the host's to
 * set. `@keyframes` went the same way earlier: animations run through
 * `useAnimation()` — see `spinKeyframes`/`pulseKeyframes` below.
 *
 * A custom property inherits, so this text on the host page's `:root` reaches
 * every component — a shadow root of the host's own included — and re-points on
 * `.dark` without a single component branching on theme. Style objects read the
 * names with `var()`.
 *
 * **A host must declare these.** `var(--background)` with no token behind it
 * resolves to nothing, not to a default. `tokens` is exported from the package
 * root for exactly that: drop it in a `<style>`, adopt it, or copy the values.
 * The `:host` selectors are there for a host that adopts it into a shadow root
 * of its own, where `:root` matches nothing.
 *
 * The names are shadcn's, unprefixed on purpose: a page that already carries a
 * shadcn or tailwind theme feeds this library from it and should NOT declare
 * `tokens` on top — the widget reads what the page already has, and pasting
 * this text at `:root` would repoint the page instead. Declare it only where
 * nothing else defines the names, or scope it to the element. The names the
 * library adds beyond shadcn — `--surface`, `--hover`, `--transition`,
 * `--info`, `--terminal-*`, `--ansi-*` — always need declaring.
 *
 * `color-scheme` rides along because it is what paints `::placeholder` and
 * `::selection` now — a pseudo-element is a box of its own, so no inline style
 * ever reached them, and it inherits from here just as the tokens do.
 */
export const tokens = `
:root,
:host {
  color-scheme: light;

  --radius: 0.625rem;
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);

  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial,
    sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  /* Blends that were alpha suffixes (bg-muted/50) before. Tokens instead, so no
     component needs a dark-mode rule of its own. */
  --surface: var(--background);
  --surface-hover: var(--accent);
  --hover: var(--accent);
  --hover-foreground: var(--accent-foreground);
  --muted-surface: color-mix(in oklab, var(--muted) 50%, transparent);
  --destructive-surface: color-mix(in oklab, var(--destructive) 10%, transparent);
  --focus-ring: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent);
  --invalid-ring: 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent);
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --transition: 0.15s ease;

  /* Tool status. Fixed hues — they read as status, not as theme. */
  --info: oklch(0.546 0.245 262.881);
  --success: oklch(0.627 0.194 149.214);
  --warning: oklch(0.681 0.162 75.834);
  --notice: oklch(0.646 0.222 41.116);
  --danger: oklch(0.577 0.245 27.325);

  /* rangi token colors — github-light */
  --shj-fg: #1f2328;
  --shj-kwd: #cf222e;
  --shj-oper: #cf222e;
  --shj-err: #82071e;
  --shj-deleted: #82071e;
  --shj-class: #953800;
  --shj-cmnt: #6e7781;
  --shj-bracket: #57606a;
  --shj-num: #0550ae;
  --shj-bool: #0550ae;
  --shj-type: #0550ae;
  --shj-section: #0550ae;
  --shj-var: #0550ae;
  --shj-str: #0a3069;
  --shj-func: #8250df;
  --shj-esc: #8250df;
  --shj-insert: #116329;

  /* ANSI terminal palette — light, so the terminal follows the theme like
     the syntax tokens do and no component carries a dark-mode rule. */
  --terminal-bg: oklch(0.985 0 0);
  --terminal-fg: oklch(0.205 0 0);
  /* Substituted where it is used, so the dark foreground below feeds it too. */
  --terminal-muted: color-mix(in oklab, var(--terminal-fg) 60%, transparent);
  --ansi-black: #000000;
  --ansi-red: #cd3131;
  --ansi-green: #00bc00;
  --ansi-yellow: #949800;
  --ansi-blue: #0451a5;
  --ansi-magenta: #bc05bc;
  --ansi-cyan: #0598bc;
  --ansi-white: #555555;
  --ansi-bright-black: #666666;
  --ansi-bright-red: #cd3131;
  --ansi-bright-green: #14ce14;
  --ansi-bright-yellow: #b5ba00;
  --ansi-bright-blue: #0451a5;
  --ansi-bright-magenta: #bc05bc;
  --ansi-bright-cyan: #0598bc;
  --ansi-bright-white: #a5a5a5;
}

.dark,
:host(.dark) {
  color-scheme: dark;
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.371 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);

  --surface: color-mix(in oklab, var(--input) 30%, transparent);
  --surface-hover: color-mix(in oklab, var(--input) 50%, transparent);
  --hover: color-mix(in oklab, var(--accent) 50%, transparent);
  --invalid-ring: 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent);

  /* rangi token colors — github-dark */
  --shj-fg: #e6edf3;
  --shj-kwd: #ff7b72;
  --shj-oper: #ff7b72;
  --shj-err: #ffa198;
  --shj-deleted: #ffa198;
  --shj-class: #ffa657;
  --shj-cmnt: #8b949e;
  --shj-bracket: #8b949e;
  --shj-num: #79c0ff;
  --shj-bool: #79c0ff;
  --shj-type: #79c0ff;
  --shj-section: #79c0ff;
  --shj-var: #79c0ff;
  --shj-str: #a5d6ff;
  --shj-func: #d2a8ff;
  --shj-esc: #d2a8ff;
  --shj-insert: #7ee787;

  /* ANSI terminal palette — dark */
  --terminal-bg: oklch(0.16 0 0);
  --terminal-fg: oklch(0.95 0 0);
  --ansi-black: #000000;
  --ansi-red: #cd3131;
  --ansi-green: #0dbc79;
  --ansi-yellow: #e5e510;
  --ansi-blue: #2472c8;
  --ansi-magenta: #bc3fbc;
  --ansi-cyan: #11a8cd;
  --ansi-white: #e5e5e5;
  --ansi-bright-black: #666666;
  --ansi-bright-red: #f14c4c;
  --ansi-bright-green: #23d18b;
  --ansi-bright-yellow: #f5f543;
  --ansi-bright-blue: #3b8eea;
  --ansi-bright-magenta: #d670d6;
  --ansi-bright-cyan: #29b8db;
  --ansi-bright-white: #ffffff;
}

`;

/**
 * The utilities every component reuses. These were classes; nothing overrides
 * any of them, so each is a plain object now.
 */
/**
 * The reset, as style objects.
 *
 * These were the `.root :where(...)` rules. `:where()` carries no
 * specificity, so every other rule beat them; the same order holds here as long
 * as a preset is the FIRST argument to `sx()` and the component's own values
 * come after:
 *
 * ```tsx
 * style={sx(reset.button, S.trigger, hovered && S.triggerHover, style)}
 * ```
 *
 * A preset covers only the tag it is named for. `box-sizing` is in none of them:
 * it used to be one rule over every element, and inlining it everywhere would be
 * a property on all ~355 elements this library renders. It sits instead in the
 * ~56 style objects where a size and a padding or border meet on the same
 * element, which is the only place it changes a pixel. Nothing checks this — a
 * size next to a padding needs the property written in by hand.
 *
 * A caller's own children get no reset, and no box-sizing either — they are
 * outside every component's reach. See AGENTS.md.
 */
export const reset = {
  /** h1-h6, p, figure, blockquote. */
  text: { margin: "0", fontSize: "inherit", fontWeight: "inherit" },
  /** ul, ol — the text reset plus the list's own. */
  list: {
    margin: "0",
    fontSize: "inherit",
    fontWeight: "inherit",
    padding: "0",
    listStyle: "none",
  },
  /** input, textarea. */
  control: {
    margin: "0",
    border: "0",
    padding: "0",
    background: "none",
    color: "inherit",
    font: "inherit",
    letterSpacing: "inherit",
  },
  /** button — the control reset plus the pointer. */
  button: {
    margin: "0",
    border: "0",
    padding: "0",
    background: "none",
    color: "inherit",
    font: "inherit",
    letterSpacing: "inherit",
    cursor: "pointer",
  },
  link: { color: "inherit", textDecoration: "none" },
  svg: { display: "block", flexShrink: "0" },
  table: { borderCollapse: "collapse" },
  hr: { border: "0", borderTop: "1px solid var(--border)" },
  /** code, kbd, samp. */
  code: { fontFamily: "var(--font-mono)", fontSize: "1em" },
  /** pre is both: the text reset, then the mono one — `font-size` last wins. */
  pre: {
    margin: "0",
    fontWeight: "inherit",
    fontFamily: "var(--font-mono)",
    fontSize: "1em",
  },
} satisfies Record<string, Sx>;

export const u = {
  icon: { width: "1rem", height: "1rem" },
  iconLg: { width: "1.5rem", height: "1.5rem" },

  info: { color: "var(--info)" },
  success: { color: "var(--success)" },
  warning: { color: "var(--warning)" },
  notice: { color: "var(--notice)" },
  danger: { color: "var(--danger)" },

  // iOS zooms the page in when it focuses a field under 16px, and does not zoom
  // back out on blur — the page is left scaled, and scrolled off to the right.
  // So a text field takes this behind `isTouch()`, and nothing under 16px.
  noZoom: { fontSize: "16px" },

  // The other two zooms, off for the whole surface: `pan-x pan-y` is
  // `manipulation` minus the pinch, so a touch that starts inside scrolls and
  // does nothing else — no pinch, no double-tap zoom. The restriction holds for
  // every descendant, whatever its own `touch-action`. `text-size-adjust` stops
  // mobile safari and chrome inflating the text on their own.
  noZoomSurface: {
    touchAction: "pan-x pan-y",
    WebkitTextSizeAdjust: "100%",
    textSizeAdjust: "100%",
  },

  muted: { color: "var(--muted-foreground)" },
  mono: { fontFamily: "var(--font-mono)" },
  fill: { height: "100%" },
  viewport: { height: "100dvh" },
  // A box that lays out nothing of its own — a `<slot>` whose children must
  // sit in the flex row around it.
  contents: { display: "contents" },

  srOnly: {
    boxSizing: "border-box",
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: 0,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
  },
} satisfies Record<string, Sx>;

/**
 * WAAPI replacements for the `spin` and `pulse` keyframes that used to
 * sit above `u`, named by `u.spin`/`u.pulse`. A keyframe has no inline form,
 * but `element.animate()` does — pass these to `useAnimation()`
 * (`lib/use-animation.ts`) instead of writing `animation` into a style
 * object:
 *
 * ```tsx
 * const spin = useAnimation(spinKeyframes, spinOptions);
 * return <LoaderIcon ref={spin} style={sx(u.icon, style)} />;
 * ```
 *
 * Both were partial CSS keyframes — only a `to`/`50%` stop written, the rest
 * implicit from the element's own resting style. WAAPI has no such fallback,
 * so the implicit `0%`/`100%` frames are written out here instead.
 */
export const spinKeyframes: Keyframe[] = [
  { transform: "rotate(0deg)" },
  { transform: "rotate(360deg)" },
];
export const spinOptions: KeyframeAnimationOptions = {
  duration: 1000,
  easing: "linear",
  iterations: Infinity,
};

/**
 * One word arriving mid-stream — see `components/markdown.tsx`. It plays once
 * per word, on mount, so the resting style is the element's own: opacity 1,
 * no blur, which is also what a reduced-motion reader gets.
 *
 * Kept short and barely blurred on purpose. Nothing throttles the stream, so a
 * fast provider mounts a word every frame or two and every word still inside
 * its fade is unreadable at once — the tail smears rather than one word
 * softening. The blur therefore clears by `0.55`, leaving opacity to finish
 * alone: the tip is sharp within ~100ms whatever the token rate, and 2px is
 * softness at body size where 4px was a full x-height.
 */
export const fadeInKeyframes: Keyframe[] = [
  { offset: 0, opacity: 0, filter: "blur(2px)" },
  { offset: 0.55, opacity: 1, filter: "blur(0)" },
  { offset: 1, opacity: 1, filter: "blur(0)" },
];
export const fadeInOptions: KeyframeAnimationOptions = {
  duration: 180,
  easing: "ease-out",
};

export const pulseKeyframes: Keyframe[] = [
  { offset: 0, opacity: 1 },
  { offset: 0.5, opacity: 0.5 },
  { offset: 1, opacity: 1 },
];
export const pulseOptions: KeyframeAnimationOptions = {
  duration: 2000,
  easing: "cubic-bezier(0.4, 0, 0.6, 1)",
  iterations: Infinity,
};
