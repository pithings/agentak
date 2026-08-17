# WebMCP

Agentak consumes tools exposed by a page through `document.modelContext`; it does not
register page tools. The current upstream proposal is at
<https://github.com/webmachinelearning/webmcp> and remains experimental.

## Compatibility traps

- The API requires a secure context and the `tools` permissions policy. It is absent in
  most browsers, so feature detection is mandatory.
- Follow the specification IDL, not old explainer examples: `executeTool` arguments and
  results are JSON strings. Chrome versions may return `inputSchema` as either JSON text
  or an object; keep `toSchemaObject()` tolerant of both.
- `RegisteredTool` contains a live `Window` and cannot cross an extension message boundary.
  Only serializable metadata travels; discovery and execution must occur in the owning
  document.
- Tool lists are dynamic. Subscribe to `toolchange` and rediscover; do not retain a list
  after the event.

## Agentak mapping and trust

`createPiSession({ page: true })` reads the current document. The panel supplies its own
`PageTools` implementation and executes inside the active tab's MAIN world.

- Normalize names to `[A-Za-z0-9_-]`, 64 characters, with deterministic suffixes for
  collisions.
- `readOnlyHint: true` runs without confirmation. Any other page tool asks on every call
  when the Ask gate is enabled. Bypass intentionally overrides the gate.
- `untrustedContentHint` must warn both the model and the person, including the origin.
- Catch discovery failure as an empty tool list. A page without WebMCP is normal.
- `documentTools()` retries briefly because a shim or origin-trial API may appear after
  the chat mounts; do not leave a permanent polling timer.

The extension cannot serialize tool handles. `extension/tab-tools.ts` injects both
`getTools()` and `executeTool()` and relays `toolchange` from MAIN world through the
isolated world. Keep this split when adding browser tools.

The integration has not yet been validated against a real `document.modelContext`.
Prioritize discovery, schema shape, MCP-shaped results, cancellation, and propagation of
page exceptions during browser testing.
