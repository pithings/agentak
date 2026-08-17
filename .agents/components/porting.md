# Porting registry components

1. Fetch `https://elements.ai-sdk.dev/api/registry/<name>.json`.
2. Replace React imports with Preact; use `preact/compat` only for `memo`/`forwardRef`.
   Replace Lucide with `lib/icons.ts` and Radix state helpers with local primitives.
3. Copy only required AI SDK type fields into `src/types.ts`.
4. Convert every class to module-scope `Sx`; follow [`styling.md`](styling.md).
5. Prefer a playground demo wrapper over adding data-only props to the shipped component.
6. Park a complete component if nothing renders it. Do not add a dependency casually.
7. Show the port in the playground and run typecheck, tests, lint, and format.

Important deviations: no `asChild`, no remote assets, no `dangerouslySetInnerHTML`, no
command dialog, and no React-only packages. ANSI output uses `src/lib/ansi.ts`. Compound
transcript parts contain serializable data, never JSX.

Not ported because they require new dependencies: XYFlow components (`canvas`,
`connection`, `controls`, `edge`, `node`, `panel`, `toolbar`), `persona`, `jsx-preview`, and
`audio-player`. Restore them only through an explicit dependency decision.
