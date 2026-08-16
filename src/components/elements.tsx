import type { ComponentChildren } from "preact";

import { Checkpoint, CheckpointIcon, CheckpointTrigger } from "./ai-elements/checkpoint.tsx";
import { Image } from "./ai-elements/image.tsx";

/**
 * Renderers for `{ kind: "element" }` transcript parts, by name.
 *
 * Props are unchecked at the call site — a transcript carries plain data, so
 * the cast happens once, here.
 *
 * Only the two names `toViewMessages()` can produce are registered: `image` for
 * `ImageContent`, `checkpoint` for a compaction or branch summary. A renderer
 * reaches the chat bundle by being listed here, so registering an element no
 * source emits costs every host its bytes — the nine-name map cost 7.6 kB
 * gzipped for seven names nothing could reach. Register a renderer when the
 * tool that emits it lands, not before. A host adds its own through
 * `registerElements()`; the playground does that in `demo-elements.tsx`.
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
  image: as(Image),
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
