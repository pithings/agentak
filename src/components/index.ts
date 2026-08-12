// Every built-in component, under the `web-agent/components` subpath. A host
// that builds its own surface imports the pieces from here; the root export
// stays the assembled chat.

// shadcn primitives, rewritten in preact.
export * from "@/components/ui/accordion";
export * from "@/components/ui/alert";
export * from "@/components/ui/avatar";
export * from "@/components/ui/badge";
export * from "@/components/ui/button";
export * from "@/components/ui/card";
export * from "@/components/ui/carousel";
export * from "@/components/ui/collapsible";
export * from "@/components/ui/command";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/hover-card";
export * from "@/components/ui/input";
export * from "@/components/ui/input-group";
export * from "@/components/ui/popover";
export * from "@/components/ui/scroll-area";
export * from "@/components/ui/separator";
export * from "@/components/ui/spinner";
export * from "@/components/ui/switch";
export * from "@/components/ui/tabs";
export * from "@/components/ui/textarea";

// AI SDK Elements, rewritten in preact.
export * from "@/components/ai-elements/agent";
export * from "@/components/ai-elements/artifact";
export * from "@/components/ai-elements/chain-of-thought";
export * from "@/components/ai-elements/checkpoint";
export * from "@/components/ai-elements/code-block";
export * from "@/components/ai-elements/commit";
export * from "@/components/ai-elements/confirmation";
export * from "@/components/ai-elements/context";
export * from "@/components/ai-elements/conversation";
export * from "@/components/ai-elements/environment-variables";
export * from "@/components/ai-elements/file-tree";
export * from "@/components/ai-elements/image";
export * from "@/components/ai-elements/inline-citation";
export * from "@/components/ai-elements/message";
export * from "@/components/ai-elements/model-selector";
export * from "@/components/ai-elements/open-in-chat";
export * from "@/components/ai-elements/package-info";
export * from "@/components/ai-elements/plan";
export * from "@/components/ai-elements/prompt-input";
export * from "@/components/ai-elements/queue";
export * from "@/components/ai-elements/reasoning";
export * from "@/components/ai-elements/sandbox";
export * from "@/components/ai-elements/schema-display";
export * from "@/components/ai-elements/shimmer";
export * from "@/components/ai-elements/snippet";
export * from "@/components/ai-elements/sources";
export * from "@/components/ai-elements/speech-input";
export * from "@/components/ai-elements/stack-trace";
export * from "@/components/ai-elements/suggestion";
export * from "@/components/ai-elements/task";
export * from "@/components/ai-elements/terminal";
export * from "@/components/ai-elements/test-results";
export * from "@/components/ai-elements/tool";
export * from "@/components/ai-elements/transcription";
export * from "@/components/ai-elements/web-preview";

// The chat surface, the markdown renderer, and the element registry.
export * from "@/components/agent-chat";
export * from "@/components/elements";
export * from "@/components/markdown";
