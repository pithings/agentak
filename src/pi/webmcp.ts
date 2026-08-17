// Docs: @docs/4.agents/2.pi-agent/5.webmcp.md
/**
 * WebMCP — the tools the current page publishes.
 *
 * A site registers its own client-side actions on `document.modelContext`, and
 * an agent in the same document reads them and calls them. This file is the api
 * as TypeScript sees it, plus `documentTools()`, which is that api behind the
 * `PageTools` interface in `page-tools.ts`. Nothing here knows about pi.
 *
 * The spec is copied into `.agents/webmcp/`, and `.agents/webmcp.md` is the
 * reading of it. Two of its rules shape this file:
 *
 * - Arguments and results are JSON **strings**, in both directions.
 * - A `RegisteredTool` carries a live `Window`, so it crosses no boundary. The
 *   list is held here and matched by name and origin, and only `PageTool` — the
 *   half that is data — leaves.
 *
 * It ships in Chrome 149 and Edge 150 behind an origin trial, and nowhere else,
 * so `document.modelContext` is absent on most browsers. A page without it has
 * no tools rather than an error.
 */

import { type PageTool, type PageTools, toSchemaObject } from "./page-tools.ts";

/** Hints a site attaches to a tool. Both are false unless it says otherwise. */
export interface WebmcpAnnotations {
  /** The tool changes nothing, so running it costs the visitor nothing. */
  readOnlyHint?: boolean;
  /** The result carries text the site does not vouch for. */
  untrustedContentHint?: boolean;
}

/** One tool, as `getTools()` hands it over. */
export interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  /**
   * JSON Schema for the arguments. Absent where a tool takes none. The spec
   * made this an object on 2026-08-14; a browser older than that answers with
   * the JSON text it keeps internally, so both are read.
   */
  inputSchema?: object | string;
  annotations?: WebmcpAnnotations;
  /** The document that registered it — why this object cannot be serialised. */
  window: Window;
  origin: string;
}

export interface GetToolsOptions {
  /** Cross-origin frames to read as well. Same-origin only by default. */
  fromOrigins?: string[];
}

export interface ExecuteToolOptions {
  signal?: AbortSignal;
}

/** `document.modelContext`, narrowed to the half an agent uses. */
export interface ModelContext extends EventTarget {
  getTools(options?: GetToolsOptions): Promise<RegisteredTool[]>;
  executeTool(
    tool: RegisteredTool,
    inputArguments: string,
    options?: ExecuteToolOptions,
  ): Promise<string>;
}

/**
 * The model context of a document, where this browser has one.
 *
 * Read through a cast rather than a global declaration: `webmcp-types` declares
 * the same members, and a consumer that installs it must not collide with this.
 */
export const modelContext = (from?: Document): ModelContext | undefined => {
  const doc = from ?? (globalThis as { document?: Document }).document;
  return (doc as { modelContext?: ModelContext } | undefined)?.modelContext;
};

/** Whether this browser carries the api. Nothing else can be told from here. */
export const webmcpSupported = (from?: Document): boolean => Boolean(modelContext(from));

/** The data half of a registered tool — what may cross a boundary. */
export const toPageTool = (tool: RegisteredTool): PageTool => ({
  description: tool.description,
  // A browser shipping the api today answers with JSON text here: the field was
  // a `DOMString` until 2026-08-14. See `toSchemaObject()`.
  inputSchema: tool.inputSchema === undefined ? undefined : toSchemaObject(tool.inputSchema),
  name: tool.name,
  origin: tool.origin,
  readOnly: tool.annotations?.readOnlyHint ?? false,
  title: tool.title,
  untrusted: tool.annotations?.untrustedContentHint ?? false,
});

export interface DocumentToolsOptions {
  /** The document to read. Default: this one. */
  document?: Document;
  /** Cross-origin frames to read as well — the site must have exposed them. */
  fromOrigins?: string[];
}

/**
 * How long a source keeps looking for an api that is not there yet, and how
 * often. Five seconds is a script arriving late, not a browser that will never
 * carry the api: past that the answer is no, and nothing goes on running.
 */
const WAIT_EVERY = 500;
const WAIT_STEPS = 10;

/**
 * The tools of a document, as a `PageTools` source.
 *
 * This is the whole of what a page needs: the chat runs in the document the
 * tools were registered in, so `getTools()` answers directly and the live
 * objects never have to leave. An extension panel is the other case — its own
 * document is empty, and its bridge runs both calls in the tab.
 *
 * **The api is looked for more than once.** `document.modelContext` read at
 * construction is one moment of a page's life, and a host that mounts the chat
 * early — at module scope, or before a shim has run — would read `undefined`,
 * bind no `toolchange` listener, and stay deaf for the whole session. So the
 * listeners are held here and attached to the api whenever one first appears,
 * and a subscriber that finds none starts a short bounded wait for it.
 */
export function documentTools(options: DocumentToolsOptions = {}): PageTools {
  const { document: doc, fromOrigins } = options;
  /** The last list, so a call can find the object its `PageTool` came from. */
  let live: RegisteredTool[] = [];
  const listeners = new Set<() => void>();
  /** The api this source listens to, once there is one to listen to. */
  let bound: ModelContext | undefined;
  let waiting: ReturnType<typeof setTimeout> | undefined;
  let left = WAIT_STEPS;
  let done = false;

  const fire = () => {
    for (const listener of listeners) listener();
  };

  /** Attach to the api, if this browser has one yet. */
  const bind = (): boolean => {
    if (done) return false;
    if (bound) return true;
    const context = modelContext(doc);
    if (!context) return false;
    bound = context;
    context.addEventListener("toolchange", fire);
    return true;
  };

  /** Look again, a few times, for an api that was not there on arrival. */
  const wait = () => {
    if (waiting || bound || done || left <= 0) return;
    waiting = setTimeout(() => {
      waiting = undefined;
      left -= 1;
      // An api that turns up is news in itself: whatever it carries has never
      // been read, so the listeners are told as if its list had changed.
      if (bind()) fire();
      else wait();
    }, WAIT_EVERY);
  };

  return {
    async list() {
      // Reading the list is also a chance to attach, for a source nobody
      // subscribed to and for an api that arrived since the last read.
      bind();
      const context = bound ?? modelContext(doc);
      if (!context) return [];
      live = await context.getTools(fromOrigins ? { fromOrigins } : undefined);
      return live.map(toPageTool);
    },

    async call(tool, args, signal) {
      const context = bound ?? modelContext(doc);
      const found = live.find(
        (candidate) => candidate.name === tool.name && candidate.origin === tool.origin,
      );
      // The page unregistered it between the list and the call, which is a
      // thing a site does as its screen changes.
      if (!context || !found) throw new Error(`The page no longer offers "${tool.name}".`);
      return context.executeTool(found, args, signal ? { signal } : undefined);
    },

    subscribe(listener) {
      listeners.add(listener);
      if (!bind()) wait();
      return () => listeners.delete(listener);
    },

    dispose() {
      done = true;
      if (waiting) clearTimeout(waiting);
      waiting = undefined;
      bound?.removeEventListener("toolchange", fire);
      bound = undefined;
      listeners.clear();
    },
  };
}
