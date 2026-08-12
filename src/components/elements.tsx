import type { ComponentChildren } from "preact";

import { EnvironmentVariables } from "@/components/ai-elements/environment-variables";
import { Image } from "@/components/ai-elements/image";
import { PackageInfo } from "@/components/ai-elements/package-info";
import { SchemaDisplay } from "@/components/ai-elements/schema-display";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { StackTrace } from "@/components/ai-elements/stack-trace";
import { TestResults } from "@/components/ai-elements/test-results";
import { Transcription } from "@/components/ai-elements/transcription";

// Compound elements take children, and a transcript carries plain data, so the
// playground renders those through small data-driven wrappers — one file per
// porting group, none of them shipped by `src/index.ts`.
import {
  CheckpointDemo,
  CommitDemo,
  ConfirmationDemo,
  QueueDemo,
  SuggestionsDemo,
} from "@/components/demo-interaction";
import { FileTreeDemo, SnippetDemo, SourcesDemo } from "@/components/demo-output";
import { ArtifactDemo, SandboxDemo, WebPreviewDemo } from "@/components/demo-panels";
import { AgentDemo, ChainOfThoughtDemo, PlanDemo, TaskDemo } from "@/components/demo-progress";

/**
 * Renderers for `{ kind: "element" }` transcript parts, by name.
 *
 * Props are unchecked at the call site — a transcript carries plain data, so
 * the cast happens once, here. Every ported element registers one line.
 */
export type ElementRenderer = (props: Record<string, unknown>) => ComponentChildren;

const as = (component: unknown) => component as ElementRenderer;

export const ELEMENTS: Record<string, ElementRenderer> = {
  agent: as(AgentDemo),
  artifact: as(ArtifactDemo),
  "chain-of-thought": as(ChainOfThoughtDemo),
  checkpoint: as(CheckpointDemo),
  commit: as(CommitDemo),
  confirmation: as(ConfirmationDemo),
  "environment-variables": as(EnvironmentVariables),
  "file-tree": as(FileTreeDemo),
  image: as(Image),
  "package-info": as(PackageInfo),
  plan: as(PlanDemo),
  queue: as(QueueDemo),
  sandbox: as(SandboxDemo),
  "schema-display": as(SchemaDisplay),
  snippet: as(SnippetDemo),
  sources: as(SourcesDemo),
  "speech-input": as(SpeechInput),
  "stack-trace": as(StackTrace),
  suggestion: as(SuggestionsDemo),
  task: as(TaskDemo),
  "test-results": as(TestResults),
  transcription: as(Transcription),
  "web-preview": as(WebPreviewDemo),
};

/** An unregistered name renders nothing rather than breaking the transcript. */
export function Element({ name, props }: { name: string; props: Record<string, unknown> }) {
  const Renderer = ELEMENTS[name];
  return Renderer ? <Renderer {...props} /> : null;
}
