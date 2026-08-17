# WebMCP — the tools a page offers

A page registers tools on `document.modelContext`, and an agent in the same document
reads them and calls them. It is the page's own client-side code, described for a model:
the site keeps its UI, its session and its state, and the agent acts through the site
rather than around it.

The spec is copied into [`webmcp/`](webmcp/) — see [`webmcp/SOURCE.md`](webmcp/SOURCE.md)
for the commit. This file is our reading of it, and what it asks of `src/pi/`.

## The surface

One interface on the document, three methods and one event. `SecureContext`, and gated by
the `tools` permissions policy, which is `self` by default.

```webidl
[Exposed=Window, SecureContext]
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool, optional ModelContextRegisterToolOptions options = {});
  Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options = {});
  Promise<DOMString> executeTool(RegisteredTool tool, DOMString inputArguments, optional ModelContextExecuteToolOptions options = {});
  attribute EventHandler ontoolchange;
};

partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};
```

A `RegisteredTool` is what the reading half gets: `name`, `title`, `description`,
`inputSchema` (a JSON Schema object), `annotations`, and the `window` and `origin` it
came from.

```js
const tools = await document.modelContext.getTools();
const result = await document.modelContext.executeTool(tool, JSON.stringify(args), { signal });
```

`annotations` is two hints, both false by default. `readOnlyHint` says the tool changes
nothing, so a gate may run it without asking. `untrustedContentHint` says the result
carries text the site does not vouch for — a review, a comment, another user's message —
which is a prompt injection waiting to be read as an instruction.

We only ever call the reading half. `registerTool()` is for the site; the chat is the
agent.

### Three things to know

- **Arguments and results are strings.** `executeTool` takes a JSON string and resolves
  with one, so both ends parse. The explainer passes an object and reads a value — it is
  behind `index.bs`, which is the one to follow.
- **So is the schema, on a browser shipping this today.** `RegisteredTool.inputSchema`
  became an `object` on 2026-08-14, in the very commit copied here, and the spec still
  keeps the schema stringified inside. Chrome 149 predates the change and answers with
  JSON text. `toSchemaObject()` reads both: a string reaching a provider as a schema
  throws `Cannot use 'in' operator to search for 'type'` and takes the whole turn with it.
- **A `RegisteredTool` cannot be serialised.** It carries a live `Window`, so it never
  crosses a worker, a port or a message. Whoever calls `executeTool()` must hold the same
  object `getTools()` gave it, in the document that gave it — a name and a schema are all
  that can travel.
- **The list changes while the page is open.** A site registers tools per screen, so
  `toolchange` fires and the answer to `getTools()` is different. Read it again and
  reassign; do not cache it past the event.

### Beyond the document

Tools reach same-origin documents in the tree, and the browser's own agent. Anything else
is opt-in at both ends: the site registers with `exposedTo: ["https://ours.example"]`, the
frame is allowed the feature with `allow="tools"`, and the agent asks with
`getTools({ fromOrigins: [...] })`. Without all three, a chat in a cross-origin iframe
sees nothing, and `registerTool()` from a frame that is not allowed rejects with
`NotAllowedError`.

A `<form>` can become a tool without script — see
[`webmcp/declarative-api-explainer.md`](webmcp/declarative-api-explainer.md). Those are
ordinary registered tools by the time we read them, so nothing here changes.

### Where it runs today

Chrome 149 and Edge 150, both behind an origin trial; Brave has it in Leo. Firefox and
Safari have positions and no build. So `document.modelContext` is absent on most
browsers, and a check is not optional. `webmcp-types` on npm carries the type
definitions, which are otherwise ours to write.

## What the agent does with them

`page: true` on `createPiSession()` reads this document; a `PageTools` of your own reads
somewhere else, which is what the panel passes. Off by default. `src/pi/webmcp.ts` is the
api and `documentTools()`, `src/pi/page-tools.ts` is the pi side, and
[`pi.md`](pi.md#the-pages-tools) is the note that goes with them.

The mapping is close to one for one. pi's `AgentTool` wants `name`, `description`,
`parameters`, a `label` for the UI, and an `execute` that resolves an `AgentToolResult`:

| WebMCP                          | pi `AgentTool`                                      |
| ------------------------------- | --------------------------------------------------- |
| `name`                          | `name`                                              |
| `title`                         | `label`, falling back to `name`                     |
| `description`                   | `description`                                       |
| `inputSchema`                   | `parameters` — JSON Schema, where typebox wants one |
| `executeTool(tool, json, opts)` | `execute(id, params, signal)`                       |
| the resolved string             | `content: [{ type: "text", text }]`                 |
| `annotations.readOnlyHint`      | the approval gate — `approvals.ts`                  |
| `toolchange`                    | reassign `agent.state.tools`                        |

Four things the wiring had to answer, and how each one is answered:

1. **The name.** Cut to `[A-Za-z0-9_-]` and 64 characters, so `cart.add` reaches the model
   as `cart_add`. A name a host tool holds, or the same tool in a second frame, gets a
   `_2`. No prefix: the site named the tool for a model to read.
2. **The gate.** `readOnlyHint` decides it, both ways: a tool that only reads runs
   unasked, and anything else is confirmed on every call. `createApprovalGate()` takes an
   `approvalFor` policy per tool, and `createPiSession()` hands it the toolset.
   `approvals: "never"` outranks it.
3. **Untrusted output.** Both readers are told. The model gets a line ahead of the result
   naming the origin and saying to treat it as data; the person gets a note above the
   output, from `untrustedFrom` on the tool part. `details` carries the origin and the
   flag from the tool to the transcript.
4. **The extension.** `extension/tab-tools.ts` runs both calls in the tab through
   `chrome.scripting.executeScript`, in the `MAIN` world, so it is certainly the model
   context the page registered on. Names and JSON cross; the tool objects never do. That
   world has no `chrome.runtime`, so `toolchange` is relayed out in two steps — the page
   posts a message to itself and a listener in the isolated world forwards it. The same
   file lists `read_page` in front of whatever the page published, which is why a tab that
   publishes nothing still leaves the model something to call — see
   [`playground.md`](playground.md).

A page is the easy half: the chat is in the document the tools are in, so `getTools()`
answers directly. That asymmetry is why the source is an option on `createPiSession()`
rather than something the loop reaches for on its own.

### Not yet checked in a browser

Nothing here has run against a real `document.modelContext`. Three things to look at
first:

- Whether the tools of the tab come back at all. The manifest now asks for every http
  origin, so any tab in front should answer — `activeTab` would have answered for one tab
  only, and a side panel outlives the tab it was opened from.
- Whether a site's result is MCP shaped. `toToolContent()` reads `{ content: [...] }` and
  hands anything else over as it stands, which is a guess about what sites will return.
- Whether `executeScript` reports a page's own throw. The injected halves answer
  `{ ok: false, message }` rather than throwing, so this should not matter — but it is the
  kind of thing that only shows up in the browser.
