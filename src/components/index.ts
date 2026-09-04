// Docs: @docs/3.widget.md
// Every built-in component, under the `agentak/components` subpath. A host
// that builds its own surface imports the pieces from here; the root export
// stays the assembled chat.
//
// The folders split by use, not by origin: `ui/` and `ai-elements/` hold what
// the chat renders, `_parked/` holds ports nothing reaches yet. Parking changes
// no export — every name below is still public — it only keeps the two sets
// apart on disk. Move a file back the day something renders it.

// shadcn primitives, rewritten in preact.
export * from "./ui/accordion.tsx";
export * from "./ui/alert.tsx";
export * from "./ui/badge.tsx";
export * from "./ui/button.tsx";
export * from "./ui/collapsible.tsx";
export * from "./ui/dropdown-menu.tsx";
export * from "./ui/input.tsx";
export * from "./ui/input-group.tsx";
export * from "./ui/popover.tsx";
export * from "./ui/progress.tsx";
export * from "./ui/scroll-area.tsx";
export * from "./ui/separator.tsx";
export * from "./ui/spinner.tsx";
export * from "./ui/textarea.tsx";

// AI SDK Elements, rewritten in preact.
export * from "./ai-elements/agent.tsx";
export * from "./ai-elements/checkpoint.tsx";
export * from "./ai-elements/code-block.tsx";
export * from "./ai-elements/confirmation.tsx";
export * from "./ai-elements/context.tsx";
export * from "./ai-elements/conversation.tsx";
export * from "./ai-elements/image.tsx";
export * from "./ai-elements/message.tsx";
export * from "./ai-elements/prompt-input.tsx";
export * from "./ai-elements/queue.tsx";
export * from "./ai-elements/reasoning.tsx";
export * from "./ai-elements/shimmer.tsx";
export * from "./ai-elements/suggestion.tsx";
export * from "./ai-elements/task.tsx";
export * from "./ai-elements/tool.tsx";

// Parked: ported, exported, and rendered by nothing the chat builds. Each waits
// on a source — a tool, a message role, a picker. See `.agents/components.md`.
export * from "./_parked/ui/avatar.tsx";
export * from "./_parked/ui/card.tsx";
export * from "./_parked/ui/carousel.tsx";
export * from "./_parked/ui/command.tsx";
export * from "./_parked/ui/hover-card.tsx";
export * from "./_parked/ui/switch.tsx";
export * from "./_parked/ui/tabs.tsx";
export * from "./_parked/ai-elements/artifact.tsx";
export * from "./_parked/ai-elements/chain-of-thought.tsx";
export * from "./_parked/ai-elements/commit.tsx";
export * from "./_parked/ai-elements/environment-variables.tsx";
export * from "./_parked/ai-elements/file-tree.tsx";
export * from "./_parked/ai-elements/inline-citation.tsx";
export * from "./_parked/ai-elements/model-selector.tsx";
export * from "./_parked/ai-elements/open-in-chat.tsx";
export * from "./_parked/ai-elements/package-info.tsx";
export * from "./_parked/ai-elements/plan.tsx";
export * from "./_parked/ai-elements/sandbox.tsx";
export * from "./_parked/ai-elements/schema-display.tsx";
export * from "./_parked/ai-elements/snippet.tsx";
export * from "./_parked/ai-elements/sources.tsx";
export * from "./_parked/ai-elements/speech-input.tsx";
export * from "./_parked/ai-elements/stack-trace.tsx";
export * from "./_parked/ai-elements/terminal.tsx";
export * from "./_parked/ai-elements/test-results.tsx";
export * from "./_parked/ai-elements/transcription.tsx";
export * from "./_parked/ai-elements/web-preview.tsx";

// The chat surface and its parts, the markdown renderer, and the element registry.
export * from "./chat.tsx";
export * from "./chat/actions.tsx";
export * from "./chat/bar.tsx";
export * from "./chat/composer.tsx";
export * from "./chat/empty.tsx";
export * from "./chat/header.tsx";
export * from "./chat/history.tsx";
export * from "./chat/message.tsx";
export * from "./chat/prompts.tsx";
export * from "./chat/queue.tsx";
export * from "./chat/settings.tsx";
export * from "./elements.tsx";
export * from "./markdown.tsx";
// The base `Markdown` resolves a relative link against, for a host that renders
// it outside `Chat` — which sets the same context from its `linkBase` prop.
export * from "../lib/links.ts";
