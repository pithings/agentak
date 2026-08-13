# Porting a registry component

`image` is the smallest worked example — read it beside this list. The registry has no
index endpoint: the component list comes from
`https://elements.ai-sdk.dev/sitemap.xml`.

1. **Get the source.** `curl -s https://elements.ai-sdk.dev/api/registry/<name>.json`.
   The file text is `.files[0].content`; `.dependencies` and `.registryDependencies`
   say what it wants from npm and from the registry.
2. **Retarget the imports.** `react`/`react-dom` become `preact` and `preact/hooks`;
   `memo` and `forwardRef` come from `preact/compat`. `lucide-react` icons become
   `@/lib/icons` — add the icon there if it is missing, with the geometry from lucide.
   Radix `use-controllable-state` becomes `@/lib/use-controllable-state`. A radix
   primitive with no `components/ui/` twin is a blocker: hand-roll it first, and read
   [primitives.md](primitives.md) for what the existing ones do and do not carry.
3. **Cut the `ai` dependency.** Copy only the fields the component reads into
   `src/types.ts`, under the upstream type name in a comment.
4. **Convert the classes.** Every tailwind string becomes an `Sx` object in the
   module-scope `S`, merged with `sx()`. Follow [styling.md](styling.md) — above all,
   reset first and caller's `style` last.
5. **Show it in the demo.** A port is not done until a human can see it in a browser.
   See [playground.md](../playground.md).
6. **Drop what needs a new package**, and say so in the file, so the choice is
   deliberate and reversible.
7. **Check.** `pnpm typecheck`, `pnpm vitest run`, `pnpm lint`, `pnpm fmt`. The
   cross-cutting tests only see what they render, so add a render test for anything the
   chat does not yet mount.

`src/index.ts` exports the shell, not single elements, so a port needs no barrel
change; `src/components/index.ts` is the named export of every built-in.

## Deviations from upstream

Worth knowing before reading a ported file against its registry source.

- **No `asChild`.** `CollapsibleTrigger` is a real `<button>`, so `commit` splits its
  header into `CommitHeader` (a div) plus `CommitHeaderTrigger`, and `stack-trace`
  makes the root the `Collapsible` itself with a `role="button"` header. Exporting the
  collapsible's context would remove the need.
- **Data props on compound elements.** A transcript part carries plain data, never JSX,
  so `test-results` gained `suites?`, `environment-variables` gained `variables?`, and
  `transcription`'s segment render prop became optional — each extending the
  component's own `children ?? default` idiom. Everything else composes through a
  `playground/src/demo-*.tsx` wrapper, which keeps the demo shape out of the shipped
  component. **Prefer the wrapper.**
- **No model catalog.** `context` priced tokens with `tokenlens`. The catalog is not
  bundled, so the limits and the money arrive as props — `usedTokens`, `maxTokens`,
  `usage`, and a `costs` object in USD — and `modelId` is only a label.
- **No floating panels where a `Collapsible` does.** `context` hangs its breakdown off
  one, so the panel opens on click and sits in the flow. Its progress bar is a two-div
  meter.
- **No `dangerouslySetInnerHTML`.** `schema-display` splits on a captured
  `/(\{[^}]+\})/` and renders spans.
- **Own ANSI parser.** `src/lib/ansi.ts` splits `terminal` output on SGR sequences,
  tracks the running state, and returns spans: the 16 base colors as `--wa-ansi-*`
  tokens, plus `38;5;<n>` / `48;5;<n>` and truecolor as `rgb()`. Every other CSI
  sequence is stripped rather than printed, and a sequence a stream cut short is
  dropped, so a half-arrived escape never flickers into the text. Command output is
  untrusted, so it reaches the DOM as spans and never as markup.
- **No remote assets.** `model-selector` upstream fetches a provider logo per item from
  `models.dev`; a third-party request is not something a side panel or a host page
  should make, and the extension CSP blocks it. A caller passes its own inline icon.
- **No command dialog.** `model-selector` is a `Popover`, not a ⌘K dialog, so
  `ModelSelectorDialog` does not exist and `ModelSelectorValue` does — a popover trigger
  has to say what is chosen.
- **`accordion`** keeps `string[]` for both `type="single"` and `"multiple"`, where
  radix carries a bare string for `single`.
- **`environment-variables`** honours its controlled prop through
  `useControllableState`; upstream ignores it.

## Not ported

Each needs a new npm dependency. Restore deliberately, not by default.

| Component                                                              | Blocker                                                                                                    |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `canvas`, `connection`, `controls`, `edge`, `node`, `panel`, `toolbar` | `@xyflow/react` is react-only. Needs `preact/compat` aliasing, which `test/eject.test.ts` asserts against. |
| `persona`                                                              | `@rive-app/react-webgl2`, react-only                                                                       |
| `jsx-preview`                                                          | `react-jsx-parser`, react-only                                                                             |
| `audio-player`                                                         | `media-chrome` (web components, so framework-neutral) plus `button-group`                                  |

`attachments`, `voice-selector` and `mic-selector` need no dependency — `ui/hover-card`
and `ui/command` cover what blocked them, so only the port is left. `model-selector` is
the worked example for the last two.
