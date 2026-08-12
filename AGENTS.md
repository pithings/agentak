# web-agent

Standalone web component library (`<web-agent>`) + Chrome extension, bundling
[`@earendil-works/pi-agent-core`](https://www.npmjs.com/package/@earendil-works/pi-agent-core)
for the agent loop.

## stack

- vite
- preact (native — no react, no `preact/compat` aliasing)
- shadcn + ai-elements, ejected to preact
- styles written in typescript — inline style objects; no tailwind, no stylesheet at all
- pi-agent-core

## Conventions

- Use native typescript with explicit .ts imports
- Use Simplified Technical English
- Prefer simplicity and minimalist in design
- Comments ONLY for important notes, keep them short
- never e2e test. the human in loop will test in real browser.

## Status

The loop is connected. The chat runs against any of 12 providers — Anthropic direct,
or a gateway — with the page tools; nothing is verified in a real browser yet.

| Area                                      | State                                                                |
| ----------------------------------------- | -------------------------------------------------------------------- |
| Vite + Preact playground                  | working — `pnpm dev` on `:4050`, catalog left, chat right            |
| shadcn + AI SDK Elements components       | **ejected** — rewritten as native preact, see below                  |
| Chat UI (`src/components/agent-chat.tsx`) | working, presentational — every agent input is an optional prop      |
| Markdown (`src/components/markdown.tsx`)  | working — md4x wasm, AST to preact, unverified in browser            |
| Transcript store                          | `src/agent/use-agent.ts` over pi; `demo-chat.ts` still drives `demo` |
| AI Elements                               | all 30 dependency-free registry components ported, see COMPONENTS.md |
| pi-agent-core wiring                      | **done** — see "The agent loop"                                      |
| Providers                                 | 12, including the OpenRouter and Vercel gateways — see below         |
| API key                                   | one per provider, kept in `localStorage`, or passed as `apiKey`      |
| Styling                                   | inline style objects; no sheet — the host declares the tokens        |
| `<web-agent>` custom element              | written, shadow DOM, injects nothing, unverified in browser          |
| Chrome MV3 extension                      | **WIP stub** — side panel hosts the element, no tab bridge yet       |
| Build / tests                             | `pnpm build`, `pnpm vitest run` pass — UI render tests included      |
| `pnpm typecheck`                          | clean                                                                |

## Commands

```sh
pnpm dev               # playground on http://localhost:4050
pnpm build             # dist/playground + dist/lib
pnpm build:extension   # dist/extension (load unpacked)
pnpm typecheck         # tsc --noEmit
pnpm vitest run
pnpm lint              # oxlint
pnpm fmt               # oxfmt
```

## Layout

```
src/
  components/ui/           shadcn primitives, rewritten in preact
  components/ai-elements/  AI SDK Elements, rewritten in preact
  components/agent-chat.tsx  chat surface — takes a transcript + callbacks
  components/markdown.tsx  md4x AST -> preact, see below
  components/elements.tsx  name -> renderer registry for `{ kind: "element" }` parts
  components/demo-*.tsx    data-driven wrappers so the demo can drive compound
                           elements from plain props — demo only, not exported
  styles/base.ts           the `tokens` text, the `reset` presets, `u`,
                           and the keyframe/option pairs `useAnimation()` takes
  styles/sx.ts             the Sx type, WithSx, and sx() — merges caller-last
  lib/
    css.ts                 css`` tagged template -> a rule string
    icons.tsx              inlined SVG icons (geometry from lucide, ISC)
    markdown.ts            md4x wasm loader + useMarkdown()
    use-stick-to-bottom.ts scroll-follow hook
    use-controllable-state.ts controlled-or-uncontrolled state
    use-interaction.ts     hover / focus-visible / press, as JS state
    use-animation.ts       WAAPI ref callback — @keyframes has no inline form
    utils.ts               cn()
  agent/                   the pi-agent-core loop
    create-agent.ts        Agent + the stream function + the system prompt
    approvals.ts           the confirmation gate behind `beforeToolCall`
    models.ts              catalog filtering, and the default model
    providers.ts           the provider list, the api modules, and streamFor()
    use-catalog.ts         one provider's models, fetched once per page
    page-bridge.ts         how tools reach the page; document-backed today, chrome.scripting later
    storage.ts             localStorage for the keys, the provider and the model
    tools.ts               read_page, find_elements
    transcript.ts          AgentMessage[] -> renderable parts, and the usage panel
    use-agent.ts           Preact state over Agent events
  demo-chat.ts             canned turns for `<WebAgent demo/>`, and the catalog
                           fixtures. `autoStart` streams every turn on mount
  playground.tsx           the dev page: catalog left, chat right — demo only
  catalog.tsx              every component, rendered with fixture data — demo only
  types.ts                 UI types inlined from the `ai` package
  element.tsx              <web-agent> custom element
  web-agent.tsx            the container: key gate, storage, agent -> AgentChat
test/                      every *.test.ts(x) — imports the source through `@/`
  agent/                   the loop: agent, transcript, providers
  components/              one component each: markdown, terminal, popover, …
  lib/                     ansi
  render.test.tsx          every element, from the demo fixtures — cross-cutting
  styles.test.tsx          box-sizing over the whole catalog — cross-cutting
extension/                 WIP MV3 side panel
```

## Next steps

1. Extension `PageBridge` over `chrome.scripting.executeScript` against the active tab.
   `documentBridge()` reads the side panel's own document today, which is empty.
2. Extension key storage: `chrome.storage` instead of `localStorage`, passed as `apiKey`
   — it takes a record of keys by provider id.
3. Verify `<web-agent>` in a host page, and the loop against a real key. Nothing is
   written to the host document, but the host has to declare the `--wa-*` tokens —
   export `tokens` is that text.
4. Compaction. pi exports `compact()`, but it needs a `Models` store — the whole
   catalog — so a long conversation still runs into the window.

## The agent loop

`createWebAgent()` builds a pi `Agent`; `useAgent()` turns its events into the props
`AgentChat` takes. Neither the chat nor any element knows pi exists.

```
prompt -> Agent -> streamFor(model.api) -> streamSimple -> AgentEvent
                -> beforeToolCall -> ApprovalGate -> AgentTool -> PageBridge
useAgent: every event -> toViewMessages(agent.state) -> AgentChat
```

pi-ai's index imports every provider's catalog and every sdk, so nothing here imports
it for a value. Everything comes from a subpath, and all of it is dynamic:

- `providers/<id>.models` — one json per provider, fetched when that provider is
  picked. OpenRouter's is 136 KB and Vercel's 66 KB; the rest are a few KB each.
- `api/<name>` — `streamSimple`, fetched with the first turn that needs it.
  `anthropic-messages` and `openai-completions`/`openai-responses` are the two sdks,
  ~100 KB each, and each is a chunk of its own.

Only the Anthropic catalog (5 KB) is imported statically, so an agent exists before any
chunk lands. The playground's first chunk is 429 KB (128 KB gzipped) and carries no sdk.

The package root is browser-safe: `node:` imports live under the `./node` export, which
nothing here touches. Every api module sets `dangerouslyAllowBrowser` — the key goes
straight from the page to the provider.

### Providers

`agent/providers.ts` is the whole list. A provider is an id, a label, where its key
comes from, a default model, and a `load()` for its catalog. The model carries its own
api, so `streamFor()` picks the module per turn and a gateway model costs no extra code.

| Provider                                                | Api                                     |
| ------------------------------------------------------- | --------------------------------------- |
| Anthropic (default)                                     | anthropic-messages                      |
| **OpenRouter**, **Vercel AI Gateway**, **Hugging Face** | openai-completions / anthropic-messages |
| OpenAI                                                  | openai-responses                        |
| Groq, Cerebras, Together, DeepSeek, xAI, Z.ai, Moonshot | openai-completions                      |

Adding one is an entry plus its `defaultModelId`. `test/agent/providers.test.ts` loads
every catalog and fails if a default no longer exists, or if a listed model needs an api
this build does not carry.

Left out on purpose: Cloudflare AI Gateway and Workers AI (an account id inside the
url), GitHub Copilot and OpenAI Codex (OAuth), Bedrock and Vertex (signed requests),
Google and Mistral (another sdk each, for one provider each).

A key is stored per provider, so switching back to one already set up asks nothing.
`getApiKey(provider)` is how pi asks for the right one.

### What feeds each element

| Element                             | Source                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `conversation`, `message`, markdown | `user` / `assistant` text content                                       |
| `reasoning`                         | `thinking` blocks; `redacted` renders a note instead                    |
| `tool`                              | `toolCall` + `tool_execution_*` + the `toolResult` that answers it      |
| `code-block`                        | tool output, and markdown fences                                        |
| `confirmation`                      | `beforeToolCall`, parked on a promise the buttons resolve               |
| `queue`                             | `agent.steer()` — a message typed mid-turn                              |
| `context`                           | `usage` of the last turn, cost summed over all of them                  |
| `model-selector`                    | the current provider's catalog; picking one assigns `agent.state.model` |
| `agent`                             | the system prompt and `agent.state.tools`, in the empty state           |
| `image`                             | `ImageContent` in a user message or a tool result                       |
| `shimmer`                           | streaming, before the first block of the turn arrives                   |
| `checkpoint`                        | `compactionSummary` / `branchSummary` messages                          |

The rest of the ported elements have no source in pi: `plan`, `task` and
`chain-of-thought` need a todo tool, `sources` and `inline-citation` a search tool,
`file-tree` a listing tool, and `commit`, `test-results`, `stack-trace`,
`package-info` and `environment-variables` a shell. `schema-display` is shaped like an
HTTP endpoint — method and path — so a tool schema is a costume on it, and `AgentTool`
already prints the schema. Write the tool first; the element is waiting.

### Notes

- **The view is rebuilt, never accumulated.** Every pi event carries the whole message,
  so `toViewMessages()` reads `agent.state` from the start each time. Ids come from the
  index, so a growing message keeps its identity. `streamingMessage` is separate from
  `messages` until `message_end`, so it is appended, not merged.
- **A run is still streaming inside its own `agent_end` listener.** It settles after
  every listener returns, so `use-agent.ts` waits on `waitForIdle()` for the last redraw.
  Without it the composer keeps its stop button forever.
- **The gate is a promise, not a flag.** `beforeToolCall` parks the call until the UI
  answers; a denial returns `{ block: true }` and pi writes an error tool result, which
  the transcript shows as `denied` rather than `error`. The default policy asks once per
  tool and remembers an allow for the session.
- **A queued message cannot be removed one at a time.** pi drains its steering queue as a
  whole, so `dequeue()` clears it and re-queues the rest. It leaves the list when the
  matching user message appears in the transcript.
- **Usage names differ.** pi counts `input`/`output`/`cacheRead`/`cacheWrite`; the panel
  wants `inputTokens`/`cachedInputTokens`. Cache writes fold into the cache row, and
  reasoning tokens carry no cost of their own because pi prices them as output.
- **Build the runtime once.** `createWebAgent()` inside a render makes a new, empty agent
  every time. `web-agent.tsx` holds it in `useState(() => …)`.

## The preact eject

The registry components arrived written against react. They are now native preact,
and every react-only package is gone from the tree. They came from shadcn (`new-york`,
`neutral`) and from the AI SDK Elements registry,
`https://elements.ai-sdk.dev/api/registry/{name}.json`. `components.json` is gone with
tailwind — the CLI has nothing left to write into, so a new element is a manual port.

- Source imports `preact`, `preact/hooks`, and `preact/compat` (only for `memo` —
  that is preact's own module, not a react shim).
- `reactAliasesEnabled: false` in all four vite/vitest configs. There is no
  react→preact/compat alias any more, so a stray `react` import fails the build
  instead of silently resolving. `test/render.test.tsx` asserts this.
- `tsconfig.json` uses `jsxImportSource: "preact"` and no `react` path mappings.

Replaced packages:

| Was                                      | Now                                      |
| ---------------------------------------- | ---------------------------------------- |
| `lucide-react`                           | `src/lib/icons.tsx`                      |
| `radix-ui` Collapsible                   | `src/components/ui/collapsible.tsx`      |
| `@radix-ui/react-use-controllable-state` | `src/lib/use-controllable-state.ts`      |
| `use-stick-to-bottom`                    | `src/lib/use-stick-to-bottom.ts`         |
| `motion`                                 | `@keyframes wa-shimmer` in `shimmer.tsx` |
| `streamdown` + `@streamdown/*`           | `md4x` — see "Markdown"                  |
| `cmdk`, `nanoid`                         | dropped with their components            |
| `ai` (types only)                        | `src/types.ts`                           |
| `tailwindcss`, `cva`, `clsx`, `twMerge`  | `src/styles/` — see "Styling"            |

Dropped on the way through, restore deliberately if wanted:

- **Math and mermaid.** Markdown came back through md4x (see below), but neither of
  those did.
- **`prompt-input.tsx`** went from 1307 lines to the composer only. Attachments,
  screenshot capture, the model/action menus and the slash-command palette are gone —
  they existed only to feed radix `Select`/`DropdownMenu`/`HoverCard` and `cmdk`.
  `PromptInputMessage` therefore lost its `files` field.
- **Deleted components** with no remaining users, all pure radix or cmdk wrappers:
  `ui/{command,dialog,dropdown-menu,hover-card,select,tooltip,separator,button-group}.tsx`
  and `ai-elements/task.tsx`.
- **`asChild` / `Slot`** on `Button` and `Badge`. Nothing used it.
- **Tooltips.** `MessageAction` and `PromptInputButton` fall back to the native
  `title` attribute.
- **Collapsible exit animations.** The hand-rolled collapsible toggles `hidden`
  rather than running radix's presence machinery, so `data-[state=closed]:animate-out`
  no longer has anything to animate.

## Styling

Tailwind is gone, and so is the stylesheet — the library injects nothing, into a
document or a shadow root. A component's styles are **inline style objects**.

### The split

An inline style outranks every rule, so a property goes inline unless nothing on the
element can carry it. Everything that could not be carried is gone:

- **tokens** — the one thing left in CSS, and **the host declares it**, not this
  library. `styles/base.ts` exports the text as `tokens`, re-exported from the package
  root. A custom property inherits and inheritance crosses a shadow boundary, so a host
  page's `:root` reaches every component inside `<web-agent>`, and `.dark` re-points the
  same names with no per-component branch. Style objects read them with `var()`. **A
  `var()` with no token behind it resolves to nothing, not to a default** — a host that
  skips the snippet gets an unpainted tree.
- **`box-sizing`** — was one rule over every element. It is inline now, but only in the
  ~56 style objects where a size meets a padding or a border, which is the only place it
  changes a pixel; on all ~355 elements it would be dead weight. `test/styles.test.tsx`
  renders the catalog and the chat and fails on any element that pairs the two without
  it — three of the first misses were found that way, where the size and the inset came
  from different objects merged by `sx()`.
- **pseudo-elements** — dropped. `::placeholder` and `::selection` were the last two
  rules in the project; a pseudo-element is a box of its own, so no inline style was ever
  in the running. The placeholder is `color-scheme` now, which inherits from the host
  alongside the tokens and is in the `tokens` text. It paints the UA's grey rather than
  `--wa-muted-foreground`; the selection highlight is the UA's, which follows the OS.
- **`@keyframes`** — `useAnimation()`, see below.

Everything else — layout, spacing, colour, typography, and every interaction state — is
a `Sx` object. That includes the cases a selector used to own: a sibling gap or a
last-child border is a `style` cloned onto the children (`ui/accordion.tsx`,
`components/markdown.tsx`), and a descendant another component stretches is a `style`
passed down (`<Separator style={S.separator}/>` in `ai-elements/checkpoint.tsx`).

### Writing a component

```tsx
import { reset } from "@/styles/base";
import { useInteraction } from "@/lib/use-interaction";
import { sx, type Sx, type WithSx } from "@/styles/sx";

const S = {
  body: { overflowX: "auto", borderRadius: "var(--wa-radius-md)" },
  bodyHover: { background: "var(--wa-hover)" },
} satisfies Record<string, Sx>;

function ToolBody({ className, style, ...props }: WithSx<ComponentProps<"button">>) {
  const { hovered, handlers } = useInteraction<HTMLButtonElement>(props);

  return (
    <button
      className={className}
      style={sx(reset.button, S.body, hovered && S.bodyHover, style)}
      {...props}
      {...handlers}
    />
  );
}
```

- Values are **strings**. A bare number would get `px` appended by preact.
- `WithSx<T>` narrows `style` to an object so `sx()` can fold a caller's style over the
  component's own. Always destructure `style` out — `{...props}` would otherwise
  overwrite the computed one. **A component that declares `WithSx` and then spreads
  `style` silently drops its own styles**; two primitives had this bug.
- `sx(base, variant, state, style)` merges left to right, caller last. **Argument order
  does what cascade order used to.**
- `S` sits at module scope so it is not rebuilt per render.

### The five rules that cost the most to learn

**1. Specificity first, source order second.** Reproducing a merge from "which rule came
later" is wrong. `.wa-tree-item:hover` (0,2,0) beats `.wa-tree-item--selected` (0,1,0)
however they are ordered. Only compare source order when specificity ties.

**2. An inline `display` breaks the `hidden` attribute.** `CollapsibleContent` and
`CommandItem` hide themselves with `hidden`, and an inline `display` outranks the UA
`[hidden] { display: none }` rule, so the element never hides. Keep `hidden` for
accessibility and drive display from the same expression:

```tsx
style={sx(S.content, !open && { display: "none" }, style)}
```

**3. A component's styles can only go inline if every user goes through the component.**
Several files used to hand-copy `class="wa-btn wa-btn--outline"` onto their own elements.
An inline style lives on the element the component renders; a copied class gets nothing.
`ui/button.tsx` therefore exports `buttonSx()` and `ui/input.tsx` exports `controlSx()`,
so a trigger that cannot itself be a `<Button>` still gets the exact values.

**4. A reset preset must be the FIRST `sx()` argument.** The reset was written with
`:where()` — zero specificity, so everything beat it. As an inline style it beats
everything. `reset.*` in `styles/base.ts` reproduces the old order only when it is
merged first. This is not a neutral conversion: in `markdown.tsx` a naive
`reset.text` kills the sibling gap, which is why `withGap()` clones the gap on last.

**5. Cross-element state needs a context, and the direction matters.** `:hover` on a
parent styling a child (`queue.tsx`, `inline-citation.tsx`) means the parent owns
`useInteraction` and publishes down. `:has()` on a parent reacting to a child
(`input-group.tsx`) is the mirror: the group passes a _reporter_ down and the descendant
calls it, counting reporters per flag so two controls cannot clear each other.

### Overriding another component

A wrapper used to override a primitive with a class. That cannot work — the primitive's
value is inline, and a class never beats inline. Pass the override as `style`:

```tsx
<Badge style={S.result} />
```

There is **no sheet to write a selector into**. If you find yourself reaching for one,
the property it targets is already inline and the selector would match nothing.

### Animation

`@keyframes` has no inline form, so animations run through `useAnimation()` in
`lib/use-animation.ts` — a ref callback over the Web Animations API, cancelled on
unmount. `spinKeyframes`/`pulseKeyframes` and their options are exported from
`styles/base.ts`. It honours `prefers-reduced-motion`, which the CSS version never did,
and degrades to a static element where `element.animate` is missing (jsdom).

Frames and options must be referentially stable — use a module constant, not an object
built in render — and a hook cannot run inside a `.map()`, so animated list items need a
subcomponent each.

### What the checks catch, and what they do not

- **`test/styles.test.tsx`** renders the whole catalog and the chat and fails on any
  element that carries a real size and a real padding or border without
  `box-sizing: border-box`. A third case renders a bare `<div>` that pairs the two, so
  the check cannot pass by finding nothing. What it cannot see is a size a **caller**
  passes as `style` onto a padded primitive — the catalog renders defaults.
- **`ships no stylesheet`**, in `test/render.test.tsx`, globs the components for a `*Styles`
  export and fails if one comes back. There is no manifest to add a block to any more,
  so a new block would simply be dead text.
- **Nothing catches an inverted `sx()` argument.** A state object merged before the
  resting value it should override produces no failure, only a wrong pixel. Verify
  precedence by reading.
- **There are no `wa-` classes left.** `data-slot`, `data-variant`, `data-size` and
  `data-state` are the stable hooks. A class carries nothing now — do not add one to
  style something, and do not expect a host to be able to target it.

### The trade

Components render identically wherever they are embedded, and a host page cannot break
them, and nothing has to be injected anywhere. In exchange: a host page cannot restyle
them either (only the `--wa-*` tokens are open), styles re-emit per element per render
instead of being parsed once, hover and focus cost a render, and **a caller's own
children get no reset** — they are outside every component's reach. A raw `<p>` under
`AlertDescription` and a raw `<table>` in a tool body lose their line-height and their
width; both are covered when the child comes through `<Markdown>`, which sets the same
values inline, and that is every real caller today.

The one thing a host must do:

```html
<style>
  /* the `tokens` export, verbatim */
</style>
```

`tokens` is a string — put it in a `<style>`, adopt it into a root of your own, or copy
the values. The playground does the first (`playground.tsx`), the extension side panel
too (`extension/panel.ts`), and both are honest about it: those documents are ours, not
a host's. `<web-agent>` itself declares only `display: block`, set on the element in
`connectedCallback` because there is no `:host` rule to carry it.

The style objects and the tokens still need modern CSS: `color-mix()` and
`field-sizing` are used as tailwind used them. `:has()` is gone from everything that
ships — it survives only in the playground's own `<style>` (`catalog.tsx`), which is
demo-only.

## Markdown

[`md4x`](https://github.com/unjs/md4x) (wasm) parses; `components/markdown.tsx` renders.

`lib/markdown.ts` instantiates the wasm once, off `md4x/standalone`'s own `init()`.
`useMarkdown()` reports when that finishes; until then, and if it fails, text renders
verbatim as before. So a first paint is never blank and never lost.

`<Markdown>` walks the AST from `parseAST(text, { heal: true })` into preact elements.
Two reasons for the AST rather than `renderToHtml`:

- **No `dangerouslySetInnerHTML`.** Markdown carries raw HTML through, and this text comes
  from a model reading an untrusted page. In the AST, inline HTML is already a text node;
  `html_block` is rendered as text too, and `javascript:`/`data:` URLs are dropped from
  links and images.
- Fences become the shared `CodeBlock`, so markdown and tool output are highlighted and
  copyable by the same component.

`heal` closes delimiters left open mid-stream, so a half-typed `**bold` does not flicker
between literal asterisks and bold text.

`CLASSES` in that file is the tag allowlist — a tag missing from it renders its children,
so a new md4x tag degrades to text instead of reaching the DOM unstyled.

Every import is `md4x/standalone`, which carries the wasm inline as deflated base64 and
inflates it through `DecompressionStream` at `init()`. One entry, one branch, the same in
node and in the browser — no export conditions, no build plugin, no emitted asset for a
host page or an extension to fetch. `md4x/wasm`, the alternative, resolves per condition:
a node-fs branch, a `?url` branch, and the `unwasm` one, and the library build inlines
assets, so the binary landed in the bundle twice.

`lib/markdown.ts` imports it dynamically, so the base64 stays a lazy chunk — fetched on
the first markdown render, not at start. `parseAST` therefore lives behind that module's
`parseMarkdown()` rather than being imported directly.

## Syntax highlighting

`shiki` is gone. `code-block.tsx` uses [`rangi`](https://github.com/pi0/rangi) through its
`rangi/core` entry, which bundles no grammar of its own: `LANGUAGES` in that file lists
what is registered (`bash`, `diff`, `json`, `ts`, `tsx` today — tool input/output plus the
fences that reach a code block through markdown).
An unregistered language is returned as one untyped token, so it renders verbatim.

rangi is synchronous, so the highlighter cache, the token cache, the subscriber map and
the raw-token placeholder pass are all gone — tokenizing happens in a `useMemo` and the
first render is already coloured.

Colors come from `--shj-<token>` in `styles/base.ts`, github-light on `:root`/`:host` and
github-dark on `.dark`/`:host(.dark)`. This is rangi's `cssVariables` theme written out by
hand, because rangi's own light/dark pairs inline `light-dark()`, which follows
`color-scheme` rather than this project's class-based `dark` variant.
