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
 * every component, crosses the `<web-agent>` shadow boundary, and re-points on
 * `.dark` without a single component branching on theme. Style objects read the
 * names with `var()`.
 *
 * **A host must declare these.** `var(--wa-background)` with no token behind it
 * resolves to nothing, not to a default. `tokens` is exported from the package
 * root for exactly that: drop it in a `<style>`, adopt it, or copy the values.
 * The `:host` selectors are there for a host that adopts it into a shadow root
 * of its own, where `:root` matches nothing.
 *
 * `color-scheme` rides along because it is what paints `::placeholder` and
 * `::selection` now — a pseudo-element is a box of its own, so no inline style
 * ever reached them, and it inherits from here just as the tokens do.
 */
export const tokens = `
:root,
:host {
  color-scheme: light;

  --wa-radius: 0.625rem;
  --wa-radius-sm: calc(var(--wa-radius) - 4px);
  --wa-radius-md: calc(var(--wa-radius) - 2px);
  --wa-radius-lg: var(--wa-radius);

  --wa-font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial,
    sans-serif;
  --wa-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;

  --wa-background: oklch(1 0 0);
  --wa-foreground: oklch(0.145 0 0);
  --wa-primary: oklch(0.205 0 0);
  --wa-primary-foreground: oklch(0.985 0 0);
  --wa-secondary: oklch(0.97 0 0);
  --wa-secondary-foreground: oklch(0.205 0 0);
  --wa-muted: oklch(0.97 0 0);
  --wa-muted-foreground: oklch(0.556 0 0);
  --wa-accent: oklch(0.97 0 0);
  --wa-accent-foreground: oklch(0.205 0 0);
  --wa-destructive: oklch(0.577 0.245 27.325);
  --wa-destructive-foreground: oklch(0.985 0 0);
  --wa-border: oklch(0.922 0 0);
  --wa-input: oklch(0.922 0 0);
  --wa-ring: oklch(0.708 0 0);

  /* Blends that were alpha suffixes (bg-muted/50) before. Tokens instead, so no
     component needs a dark-mode rule of its own. */
  --wa-surface: var(--wa-background);
  --wa-surface-hover: var(--wa-accent);
  --wa-hover: var(--wa-accent);
  --wa-hover-foreground: var(--wa-accent-foreground);
  --wa-muted-surface: color-mix(in oklab, var(--wa-muted) 50%, transparent);
  --wa-destructive-surface: color-mix(in oklab, var(--wa-destructive) 10%, transparent);
  --wa-focus-ring: 0 0 0 3px color-mix(in oklab, var(--wa-ring) 50%, transparent);
  --wa-invalid-ring: 0 0 0 3px color-mix(in oklab, var(--wa-destructive) 20%, transparent);
  --wa-shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --wa-transition: 0.15s ease;

  /* Tool status. Fixed hues — they read as status, not as theme. */
  --wa-info: oklch(0.546 0.245 262.881);
  --wa-success: oklch(0.627 0.194 149.214);
  --wa-warning: oklch(0.681 0.162 75.834);
  --wa-notice: oklch(0.646 0.222 41.116);
  --wa-danger: oklch(0.577 0.245 27.325);

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
  --wa-terminal-bg: oklch(0.985 0 0);
  --wa-terminal-fg: oklch(0.205 0 0);
  /* Substituted where it is used, so the dark foreground below feeds it too. */
  --wa-terminal-muted: color-mix(in oklab, var(--wa-terminal-fg) 60%, transparent);
  --wa-ansi-black: #000000;
  --wa-ansi-red: #cd3131;
  --wa-ansi-green: #00bc00;
  --wa-ansi-yellow: #949800;
  --wa-ansi-blue: #0451a5;
  --wa-ansi-magenta: #bc05bc;
  --wa-ansi-cyan: #0598bc;
  --wa-ansi-white: #555555;
  --wa-ansi-bright-black: #666666;
  --wa-ansi-bright-red: #cd3131;
  --wa-ansi-bright-green: #14ce14;
  --wa-ansi-bright-yellow: #b5ba00;
  --wa-ansi-bright-blue: #0451a5;
  --wa-ansi-bright-magenta: #bc05bc;
  --wa-ansi-bright-cyan: #0598bc;
  --wa-ansi-bright-white: #a5a5a5;
}

.dark,
:host(.dark) {
  color-scheme: dark;
  --wa-background: oklch(0.145 0 0);
  --wa-foreground: oklch(0.985 0 0);
  --wa-primary: oklch(0.922 0 0);
  --wa-primary-foreground: oklch(0.205 0 0);
  --wa-secondary: oklch(0.269 0 0);
  --wa-secondary-foreground: oklch(0.985 0 0);
  --wa-muted: oklch(0.269 0 0);
  --wa-muted-foreground: oklch(0.708 0 0);
  --wa-accent: oklch(0.371 0 0);
  --wa-accent-foreground: oklch(0.985 0 0);
  --wa-destructive: oklch(0.704 0.191 22.216);
  --wa-border: oklch(1 0 0 / 10%);
  --wa-input: oklch(1 0 0 / 15%);
  --wa-ring: oklch(0.556 0 0);

  --wa-surface: color-mix(in oklab, var(--wa-input) 30%, transparent);
  --wa-surface-hover: color-mix(in oklab, var(--wa-input) 50%, transparent);
  --wa-hover: color-mix(in oklab, var(--wa-accent) 50%, transparent);
  --wa-invalid-ring: 0 0 0 3px color-mix(in oklab, var(--wa-destructive) 40%, transparent);

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
  --wa-terminal-bg: oklch(0.16 0 0);
  --wa-terminal-fg: oklch(0.95 0 0);
  --wa-ansi-black: #000000;
  --wa-ansi-red: #cd3131;
  --wa-ansi-green: #0dbc79;
  --wa-ansi-yellow: #e5e510;
  --wa-ansi-blue: #2472c8;
  --wa-ansi-magenta: #bc3fbc;
  --wa-ansi-cyan: #11a8cd;
  --wa-ansi-white: #e5e5e5;
  --wa-ansi-bright-black: #666666;
  --wa-ansi-bright-red: #f14c4c;
  --wa-ansi-bright-green: #23d18b;
  --wa-ansi-bright-yellow: #f5f543;
  --wa-ansi-bright-blue: #3b8eea;
  --wa-ansi-bright-magenta: #d670d6;
  --wa-ansi-bright-cyan: #29b8db;
  --wa-ansi-bright-white: #ffffff;
}

`;

/**
 * The utilities every component reuses. These were classes; nothing overrides
 * any of them, so each is a plain object now.
 */
/**
 * The reset, as style objects.
 *
 * These were the `.wa-root :where(...)` rules. `:where()` carries no
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
 * element, which is the only place it changes a pixel. `styles.test.tsx` fails
 * on any element that pairs the two without it.
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
  hr: { border: "0", borderTop: "1px solid var(--wa-border)" },
  /** code, kbd, samp. */
  code: { fontFamily: "var(--wa-font-mono)", fontSize: "1em" },
  /** pre is both: the text reset, then the mono one — `font-size` last wins. */
  pre: {
    margin: "0",
    fontWeight: "inherit",
    fontFamily: "var(--wa-font-mono)",
    fontSize: "1em",
  },
} satisfies Record<string, Sx>;

export const u = {
  icon: { width: "1rem", height: "1rem" },
  iconLg: { width: "1.5rem", height: "1.5rem" },

  info: { color: "var(--wa-info)" },
  success: { color: "var(--wa-success)" },
  warning: { color: "var(--wa-warning)" },
  notice: { color: "var(--wa-notice)" },
  danger: { color: "var(--wa-danger)" },

  muted: { color: "var(--wa-muted-foreground)" },
  mono: { fontFamily: "var(--wa-font-mono)" },
  fill: { height: "100%" },
  viewport: { height: "100dvh" },

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
 * WAAPI replacements for the `wa-spin` and `wa-pulse` keyframes that used to
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
