// Every built-in component, under the `agentak/components` subpath. A host
// that builds its own surface imports the pieces from here; the root export
// stays the assembled chat.

// shadcn primitives, rewritten in preact.
export * from "./ui/accordion.tsx";
export * from "./ui/alert.tsx";
export * from "./ui/avatar.tsx";
export * from "./ui/badge.tsx";
export * from "./ui/button.tsx";
export * from "./ui/card.tsx";
export * from "./ui/carousel.tsx";
export * from "./ui/collapsible.tsx";
export * from "./ui/command.tsx";
export * from "./ui/dropdown-menu.tsx";
export * from "./ui/hover-card.tsx";
export * from "./ui/input.tsx";
export * from "./ui/input-group.tsx";
export * from "./ui/popover.tsx";
export * from "./ui/scroll-area.tsx";
export * from "./ui/separator.tsx";
export * from "./ui/spinner.tsx";
export * from "./ui/switch.tsx";
export * from "./ui/tabs.tsx";
export * from "./ui/textarea.tsx";

// AI SDK Elements, rewritten in preact.
export * from "./ai-elements/agent.tsx";
export * from "./ai-elements/artifact.tsx";
export * from "./ai-elements/chain-of-thought.tsx";
export * from "./ai-elements/checkpoint.tsx";
export * from "./ai-elements/code-block.tsx";
export * from "./ai-elements/commit.tsx";
export * from "./ai-elements/confirmation.tsx";
export * from "./ai-elements/context.tsx";
export * from "./ai-elements/conversation.tsx";
export * from "./ai-elements/environment-variables.tsx";
export * from "./ai-elements/file-tree.tsx";
export * from "./ai-elements/image.tsx";
export * from "./ai-elements/inline-citation.tsx";
export * from "./ai-elements/message.tsx";
export * from "./ai-elements/model-selector.tsx";
export * from "./ai-elements/open-in-chat.tsx";
export * from "./ai-elements/package-info.tsx";
export * from "./ai-elements/plan.tsx";
export * from "./ai-elements/prompt-input.tsx";
export * from "./ai-elements/queue.tsx";
export * from "./ai-elements/reasoning.tsx";
export * from "./ai-elements/sandbox.tsx";
export * from "./ai-elements/schema-display.tsx";
export * from "./ai-elements/shimmer.tsx";
export * from "./ai-elements/snippet.tsx";
export * from "./ai-elements/sources.tsx";
export * from "./ai-elements/speech-input.tsx";
export * from "./ai-elements/stack-trace.tsx";
export * from "./ai-elements/suggestion.tsx";
export * from "./ai-elements/task.tsx";
export * from "./ai-elements/terminal.tsx";
export * from "./ai-elements/test-results.tsx";
export * from "./ai-elements/tool.tsx";
export * from "./ai-elements/transcription.tsx";
export * from "./ai-elements/web-preview.tsx";

// The chat surface and its parts, the markdown renderer, and the element registry.
export * from "./chat.tsx";
export * from "./chat/composer.tsx";
export * from "./chat/empty.tsx";
export * from "./chat/header.tsx";
export * from "./chat/message.tsx";
export * from "./chat/queue.tsx";
export * from "./elements.tsx";
export * from "./markdown.tsx";
