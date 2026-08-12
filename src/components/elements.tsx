import type { ComponentChildren } from "preact";

import { Checkpoint, CheckpointIcon, CheckpointTrigger } from "@/components/ai-elements/checkpoint";
import { EnvironmentVariables } from "@/components/ai-elements/environment-variables";
import { Image } from "@/components/ai-elements/image";
import { PackageInfo } from "@/components/ai-elements/package-info";
import { SchemaDisplay } from "@/components/ai-elements/schema-display";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { StackTrace } from "@/components/ai-elements/stack-trace";
import { TestResults } from "@/components/ai-elements/test-results";
import { Transcription } from "@/components/ai-elements/transcription";

/**
 * Renderers for `{ kind: "element" }` transcript parts, by name.
 *
 * Props are unchecked at the call site — a transcript carries plain data, so
 * the cast happens once, here. Every ported element registers one line.
 *
 * Registered here are the elements a transcript can reach today: `image` and
 * `checkpoint` from the loop, plus the ones whose props are already plain data.
 * A compound element needs a data-driven wrapper to pass its children; those
 * live with whoever emits them — the playground registers its own through
 * `registerElements()`.
 */
export type ElementRenderer = (props: Record<string, unknown>) => ComponentChildren;

const as = (component: unknown) => component as ElementRenderer;

/** Compound, and the loop emits it, so the wrapper ships. */
const CheckpointPart = ({ label, tooltip }: { label: string; tooltip?: string }) => (
  <Checkpoint>
    <CheckpointIcon />
    <CheckpointTrigger tooltip={tooltip}>{label}</CheckpointTrigger>
  </Checkpoint>
);

export const ELEMENTS: Record<string, ElementRenderer> = {
  checkpoint: as(CheckpointPart),
  "environment-variables": as(EnvironmentVariables),
  image: as(Image),
  "package-info": as(PackageInfo),
  "schema-display": as(SchemaDisplay),
  "speech-input": as(SpeechInput),
  "stack-trace": as(StackTrace),
  "test-results": as(TestResults),
  transcription: as(Transcription),
};

/** Add renderers for names this library does not emit itself. */
export function registerElements(renderers: Record<string, ElementRenderer>): void {
  Object.assign(ELEMENTS, renderers);
}

/** An unregistered name renders nothing rather than breaking the transcript. */
export function Element({ name, props }: { name: string; props: Record<string, unknown> }) {
  const Renderer = ELEMENTS[name];
  return Renderer ? <Renderer {...props} /> : null;
}
