import { type ElementRenderer, registerElements } from "@/components/elements";

// Compound elements take children, and a transcript carries plain data, so the
// playground renders those through small data-driven wrappers — one file per
// porting group, none of them part of the library.
import { CommitDemo, ConfirmationDemo, QueueDemo, SuggestionsDemo } from "./demo-interaction";
import { FileTreeDemo, SnippetDemo, SourcesDemo } from "./demo-output";
import { ArtifactDemo, SandboxDemo, WebPreviewDemo } from "./demo-panels";
import { AgentDemo, ChainOfThoughtDemo, PlanDemo, TaskDemo } from "./demo-progress";

const as = (component: unknown) => component as ElementRenderer;

/**
 * The renderers the library does not ship, because nothing in the loop emits
 * them yet. Registering is a module side effect, so importing this file once —
 * `main.ts` and `catalog.tsx` do — is all a demo transcript needs.
 */
export const DEMO_ELEMENTS: Record<string, ElementRenderer> = {
  agent: as(AgentDemo),
  artifact: as(ArtifactDemo),
  "chain-of-thought": as(ChainOfThoughtDemo),
  commit: as(CommitDemo),
  confirmation: as(ConfirmationDemo),
  "file-tree": as(FileTreeDemo),
  plan: as(PlanDemo),
  queue: as(QueueDemo),
  sandbox: as(SandboxDemo),
  snippet: as(SnippetDemo),
  sources: as(SourcesDemo),
  suggestion: as(SuggestionsDemo),
  task: as(TaskDemo),
  "web-preview": as(WebPreviewDemo),
};

registerElements(DEMO_ELEMENTS);
