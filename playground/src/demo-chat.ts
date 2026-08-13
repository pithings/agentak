import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ViewMessage, ViewPart } from "@/types";

/** Stands in for a model-generated image, so no binary blob sits in the source. */
const swatch = btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120">` +
    `<defs><linearGradient id="g"><stop offset="0" stop-color="#6366f1"/>` +
    `<stop offset="1" stop-color="#ec4899"/></linearGradient></defs>` +
    `<rect width="320" height="120" fill="url(#g)"/></svg>`,
);

/**
 * Canned assistant turns, cycled per send so every renderer is exercised.
 */
export const replies: ((stamp: number) => ViewPart[])[] = [
  (stamp) => [
    { kind: "thinking", text: "Demo mode — replaying a canned turn." },
    {
      kind: "tool",
      toolCallId: `call-${stamp}`,
      name: "read_page",
      args: { maxChars: 8000 },
      status: "done",
      output: JSON.stringify({ title: document.title, url: location.href }, null, 2),
    },
    {
      kind: "text",
      text: [
        "This is **demo mode** — `useDemoChat` replays canned turns so the chat surface",
        "stays testable on its own. The real loop is one hook away:",
        "",
        "```ts [src/agent-chat.tsx]",
        'import { Chat } from "@/components/chat";',
        'import { createAgent } from "@/agent/create-agent";',
        'import { useAgent } from "@/agent/use-agent";',
        "",
        "const [runtime] = useState(() => createAgent({ apiKey }));",
        "const chat = useAgent(runtime);",
        "```",
      ].join("\n"),
    },
  ],

  () => [
    { kind: "thinking", text: "Picking the snippet that shows a tool definition." },
    {
      kind: "text",
      text: [
        "Tools are plain objects with a schema and a handler:",
        "",
        "```ts [src/agent/tools.ts]",
        "export const findElements = {",
        '  name: "find_elements",',
        '  description: "Find elements on the page by CSS selector.",',
        "  parameters: {",
        '    type: "object",',
        '    properties: { selector: { type: "string" } },',
        '    required: ["selector"],',
        "  },",
        "  async run({ selector }: { selector: string }, page: PageBridge) {",
        "    const nodes = await page.query(selector);",
        "    return nodes.slice(0, 20);",
        "  },",
        "} satisfies ToolDefinition;",
        "```",
        "",
        "Register it with the agent, then run the playground:",
        "",
        "```bash",
        "pnpm dev        # http://localhost:4050",
        "pnpm vitest run",
        "```",
      ].join("\n"),
    },
  ],

  (stamp) => [
    {
      kind: "tool",
      toolCallId: `call-${stamp}`,
      name: "find_elements",
      args: { selector: "h1, h2" },
      status: "done",
      output: JSON.stringify(
        [
          { tag: "h1", text: "agentak", selector: "body > h1" },
          { tag: "h2", text: "Playground", selector: "main > h2" },
        ],
        null,
        2,
      ),
    },
    {
      kind: "text",
      text: [
        "Headings found. The patch below drops the stub:",
        "",
        "```diff [src/agent-chat.tsx]",
        '-import { useDemoChat } from "@/demo-chat";',
        '+import { useAgent } from "@/agent/use-agent";',
        "",
        "-  const chat = useDemoChat();",
        "+  const chat = useAgent(agent);",
        "```",
        "",
        "Other renderers this turn does not touch:",
        "",
        "- inline `code`, *emphasis* and [links](https://github.com/pi0/rangi)",
        "- tables, task lists, block quotes",
        "",
        "> Markdown goes through md4x; fences go through rangi.",
      ].join("\n"),
    },
  ],

  () => [
    { kind: "thinking", text: "Showing an image part, carried as base64." },
    {
      kind: "element",
      name: "image",
      props: { base64: swatch, mediaType: "image/svg+xml", alt: "A gradient swatch" },
    },
    {
      kind: "text",
      text: "A model-generated image arrives as base64, not a URL, so `Image` builds the data URL itself.",
    },
  ],

  // One reply per porting group, so every ported element has a fixture.
  // group:progress — chain-of-thought, task, plan, agent
  () => [
    { kind: "thinking", text: "Showing how a turn reports its own progress." },
    {
      kind: "element",
      name: "chain-of-thought",
      props: {
        title: "Reading the page",
        steps: [
          {
            label: "Collected the visible text",
            description: "8,000 characters, headings first",
            status: "complete",
          },
          {
            label: "Looked for a pricing table",
            results: ["table.pricing", "section#plans"],
            status: "complete",
          },
          { label: "Comparing the two plans", status: "active" },
          { label: "Writing the summary", status: "pending" },
        ],
      },
    },
    {
      kind: "element",
      name: "task",
      props: {
        title: "Searched the page for prices",
        items: [
          { text: "Read", files: ["section#plans"] },
          { text: "Found 2 plans: Pro and Team" },
          { text: "Skipped the footer" },
        ],
      },
    },
    {
      kind: "element",
      name: "plan",
      props: {
        title: "Summarise the pricing",
        description: "Three steps, no page changes.",
        steps: [
          "Read the plan names and prices",
          "Compare the included limits",
          "Answer in one short table",
        ],
      },
    },
    {
      kind: "element",
      name: "agent",
      props: {
        name: "Assistant",
        model: "claude-sonnet-4-5",
        instructions: "Answer only from the page. Say so when the page does not carry the answer.",
        tools: [
          {
            name: "read_page",
            description: "Read the visible text of the page.",
            inputSchema: {
              type: "object",
              properties: { maxChars: { type: "number" } },
            },
          },
          {
            name: "find_elements",
            description: "Find elements on the page by CSS selector.",
            inputSchema: {
              type: "object",
              properties: { selector: { type: "string" } },
              required: ["selector"],
            },
          },
        ],
        output: "type Answer = {\n  summary: string;\n  citations: string[];\n};",
      },
    },
    {
      kind: "text",
      text: "Progress elements are presentational — the agent loop feeds them later.",
    },
  ],

  // group:output — sources, snippet, file-tree, package-info
  () => [
    { kind: "thinking", text: "Citing what I read, then showing where the change lands." },
    {
      kind: "element",
      name: "sources",
      props: {
        sources: [
          {
            href: "https://developer.mozilla.org/docs/Web/API/Web_components",
            title: "Web components — MDN",
          },
          {
            href: "https://preactjs.com/guide/v10/web-components",
            title: "Web components — Preact",
          },
        ],
      },
    },
    {
      kind: "element",
      name: "file-tree",
      props: {
        expanded: ["src", "src/components"],
        selected: "src/components/markdown.tsx",
        nodes: [
          {
            name: "src",
            path: "src",
            children: [
              {
                name: "components",
                path: "src/components",
                children: [
                  { name: "chat.tsx", path: "src/components/chat.tsx" },
                  { name: "markdown.tsx", path: "src/components/markdown.tsx" },
                ],
              },
              { name: "element.tsx", path: "src/element.tsx" },
            ],
          },
          { name: "package.json", path: "package.json" },
        ],
      },
    },
    {
      kind: "element",
      name: "package-info",
      props: { name: "md4x", currentVersion: "0.2.1", newVersion: "0.3.0", changeType: "minor" },
    },
    {
      kind: "element",
      name: "snippet",
      props: { label: "$", code: "pnpm add md4x@0.3.0" },
    },
    {
      kind: "text",
      text: "`Sources` lists the pages read, `FileTree` marks the file to change, and the `Snippet` is the command to run.",
    },
  ],
  // group:diagnostics — test-results, stack-trace
  () => [
    { kind: "thinking", text: "Reading the vitest report, then the failing frame." },
    {
      kind: "element",
      name: "test-results",
      props: {
        summary: { passed: 7, failed: 1, skipped: 1, total: 9, duration: 1240 },
        suites: [
          {
            name: "src/markdown.test.tsx",
            status: "failed",
            tests: [
              { name: "renders a fence as a code block", status: "passed", duration: 14 },
              { name: "drops a javascript: link", status: "passed", duration: 3 },
              {
                name: "heals an unclosed bold",
                status: "failed",
                duration: 21,
                error: {
                  message: "expected '**bold' to be 'bold'",
                  stack: "at heal (src/lib/markdown.ts:48:11)",
                },
              },
              { name: "renders math", status: "skipped" },
            ],
          },
          {
            name: "src/render.test.tsx",
            status: "passed",
            tests: [
              { name: "renders a transcript", status: "passed", duration: 31 },
              { name: "declares every class the chat renders", status: "passed", duration: 12 },
            ],
          },
        ],
      },
    },
    {
      kind: "element",
      name: "stack-trace",
      props: {
        defaultOpen: true,
        trace: [
          "AssertionError: expected '**bold' to be 'bold'",
          "    at heal (/app/src/lib/markdown.ts:48:11)",
          "    at parseMarkdown (/app/src/lib/markdown.ts:72:18)",
          "    at Object.<anonymous> (/app/src/markdown.test.tsx:24:5)",
          "    at runTest (/app/node_modules/@vitest/runner/dist/index.js:781:15)",
        ].join("\n"),
      },
    },
    {
      kind: "text",
      text: "One test fails: `heal` leaves the delimiters in place when the bold never closes. The frames above the `node_modules` one are the ones to read.",
    },
  ],

  // group:interaction — confirmation, suggestion, queue, checkpoint, commit
  () => [
    { kind: "thinking", text: "Asking before I touch the page, then showing what landed." },
    {
      kind: "element",
      name: "confirmation",
      props: {
        title: "Run find_elements with the selector `form#signup input`?",
        state: "approval-requested",
        approval: { id: "approval-1" },
      },
    },
    {
      kind: "element",
      name: "queue",
      props: {
        label: "queued",
        items: [
          { id: "q1", title: "Read the pricing table", completed: true },
          { id: "q2", title: "Compare Pro and Team", description: "Limits and seats only" },
          { id: "q3", title: "Answer in one short table" },
        ],
      },
    },
    {
      kind: "element",
      name: "checkpoint",
      props: { label: "Checkpoint · before the edit", tooltip: "Restore the page to this point" },
    },
    {
      kind: "element",
      name: "commit",
      props: {
        hash: "a1b2c3d",
        message: "Adopt the sheet in the shadow root",
        author: "Pooya Parsa",
        initials: "PP",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        files: [
          { path: "src/element.tsx", status: "modified", additions: 12, deletions: 3 },
          { path: "src/styles/sheet.tsx", status: "modified", additions: 4, deletions: 1 },
          { path: "src/styles/adopt.ts", status: "deleted", deletions: 28 },
        ],
      },
    },
    {
      kind: "element",
      name: "suggestion",
      props: {
        suggestions: [
          "Summarise this page",
          "List every link",
          "Find the pricing table",
          "What does the form ask for?",
        ],
      },
    },
    {
      kind: "text",
      text: "`Confirmation` gates the tool call, `Queue` holds the rest of the turn, and `Suggestion` offers the next one. The buttons are static here — the agent loop wires them later.",
    },
  ],

  // group:panels — schema-display, sandbox, artifact, web-preview
  () => [
    { kind: "thinking", text: "Showing the endpoint, the run, the draft and the preview." },
    {
      kind: "element",
      name: "schema-display",
      props: {
        method: "POST",
        path: "/v1/pages/{pageId}/summary",
        description: "Summarise one page and return the citations used.",
        parameters: [
          { name: "pageId", type: "string", required: true, location: "path" },
          { name: "locale", type: "string", location: "query", description: "Defaults to en." },
        ],
        requestBody: [
          { name: "maxChars", type: "number", description: "Read at most this many characters." },
          {
            name: "options",
            type: "object",
            properties: [
              { name: "citations", type: "boolean", required: true },
              { name: "tone", type: "string" },
            ],
          },
        ],
        responseBody: [
          { name: "summary", type: "string", required: true },
          { name: "citations", type: "array", items: { name: "url", type: "string" } },
        ],
      },
    },
    {
      kind: "element",
      name: "sandbox",
      props: {
        title: "summary.ts",
        state: "output-available",
        tabs: [
          {
            value: "code",
            label: "Code",
            language: "ts",
            code: [
              "const page = await readPage({ maxChars: 8000 });",
              "const summary = await summarise(page);",
              "console.log(summary.citations.length);",
            ].join("\n"),
          },
          { value: "output", label: "Output", language: "bash", code: "2" },
        ],
      },
    },
    {
      kind: "element",
      name: "artifact",
      props: {
        title: "summary.md",
        description: "Draft, 2 citations",
        body: "The page compares two plans, Pro and Team. Team adds shared workspaces and SSO.",
      },
    },
    {
      kind: "element",
      name: "web-preview",
      props: {
        url: "about:blank",
        logs: [
          { level: "log", message: "summary rendered", at: "2026-01-01T09:15:00Z" },
          { level: "warn", message: "no favicon", at: "2026-01-01T09:15:01Z" },
          { level: "error", message: "GET /style.css 404", at: "2026-01-01T09:15:02Z" },
        ],
      },
    },
    {
      kind: "text",
      text: "Panels are presentational: the preview frame is sandboxed and points at `about:blank`.",
    },
  ],
  // group:input — transcription, speech-input, environment-variables
  () => [
    { kind: "thinking", text: "Showing the voice and secret surfaces, with canned data." },
    {
      kind: "element",
      name: "transcription",
      props: {
        currentTime: 3.4,
        segments: [
          { text: "Open the pricing page,", startSecond: 0, endSecond: 1.8 },
          { text: "read the plan names,", startSecond: 1.8, endSecond: 3.2 },
          { text: "then compare the two cheapest.", startSecond: 3.2, endSecond: 5.4 },
        ],
      },
    },
    { kind: "element", name: "speech-input", props: {} },
    {
      kind: "element",
      name: "environment-variables",
      props: {
        variables: [
          { name: "ANTHROPIC_API_KEY", value: "sk-ant-api03-7Qd1", required: true },
          { name: "ANTHROPIC_MODEL", value: "claude-sonnet-4-5" },
          { name: "WEB_AGENT_PORT", value: "4050" },
        ],
      },
    },
    {
      kind: "text",
      text: "Segments colour by playback time, the mic button is idle until clicked, and the switch unmasks the values.",
    },
  ],
];

/** Playback pacing, ms. */
const FIRST_TOKEN = 400;
const TOKEN_STEP = 40;
const TOKENS_PER_STEP = 2;
const PART_GAP = 220;
const TOOL_RUN = 700;
const TURN_GAP = 600;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Words with their trailing whitespace, so newlines survive the split. */
const tokenize = (text: string) => text.match(/\S+\s*/g) ?? [];

/**
 * Replay one canned turn as a stream: text and thinking arrive token by token,
 * a tool call shows as running before its output lands.
 */
async function play(
  parts: ViewPart[],
  emit: (parts: ViewPart[]) => void,
  signal: AbortSignal,
): Promise<void> {
  const shown: ViewPart[] = [];
  await sleep(FIRST_TOKEN);

  for (const part of parts) {
    if (signal.aborted) return;

    if (part.kind === "tool") {
      shown.push({ ...part, status: "running", output: undefined });
      emit([...shown]);
      await sleep(TOOL_RUN);
      if (signal.aborted) return;
      shown[shown.length - 1] = part;
      emit([...shown]);
    } else if (part.kind === "element") {
      // A rendered element arrives whole — there is nothing to stream.
      shown.push(part);
      emit([...shown]);
    } else {
      const tokens = tokenize(part.text);
      let text = "";
      shown.push({ ...part, text });
      for (let i = 0; i < tokens.length; i += TOKENS_PER_STEP) {
        await sleep(TOKEN_STEP);
        if (signal.aborted) return;
        text += tokens.slice(i, i + TOKENS_PER_STEP).join("");
        shown[shown.length - 1] = { ...part, text };
        emit([...shown]);
      }
    }

    await sleep(PART_GAP);
  }
}

/**
 * Placeholder transcript store so the UI is runnable on its own. Swap for a real
 * agent hook that returns the same shape.
 */
export interface DemoChatOptions {
  /** Play every canned turn on mount. The playground sets this; a host page does not. */
  autoStart?: boolean;
}

export function useDemoChat({ autoStart = false }: DemoChatOptions = {}) {
  const [messages, setMessages] = useState<ViewMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const turn = useRef(0);
  const run = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    run.current?.abort();
    run.current = null;
  }, []);

  useEffect(() => abort, [abort]);

  // The assistant message appears with its first part, not before.
  const emitter = useCallback(
    (id: string) => (next: ViewPart[]) =>
      setMessages((current) => {
        const last = current.at(-1);
        return last?.id === id
          ? [...current.slice(0, -1), { ...last, parts: next }]
          : [...current, { id, role: "assistant", parts: next }];
      }),
    [],
  );

  const send = useCallback(
    (text: string) => {
      abort();
      const controller = new AbortController();
      run.current = controller;

      const stamp = Date.now();
      const parts = replies[turn.current % replies.length](stamp);
      turn.current += 1;

      setMessages((current) => [
        ...current,
        { id: `user-${stamp}`, role: "user", parts: [{ kind: "text", text }] },
      ]);
      setIsStreaming(true);

      play(parts, emitter(`assistant-${stamp}`), controller.signal).finally(() => {
        if (run.current === controller) run.current = null;
        if (!controller.signal.aborted) setIsStreaming(false);
      });
    },
    [abort, emitter],
  );

  /**
   * Stream every canned turn back to back, with no prompt in between — the
   * playground opens on a reel of each renderer rather than an empty pane.
   */
  const showcase = useCallback(() => {
    abort();
    const controller = new AbortController();
    run.current = controller;
    setIsStreaming(true);

    void (async () => {
      for (const [index, reply] of replies.entries()) {
        if (controller.signal.aborted) break;
        turn.current = index + 1;
        const stamp = Date.now();
        await play(reply(stamp), emitter(`showcase-${index}`), controller.signal);
        await sleep(TURN_GAP);
      }
      if (run.current === controller) run.current = null;
      if (!controller.signal.aborted) setIsStreaming(false);
    })();
  }, [abort, emitter]);

  useEffect(() => {
    if (autoStart) showcase();
  }, [autoStart, showcase]);

  return {
    messages,
    isStreaming,
    send,
    stop: useCallback(() => {
      abort();
      setIsStreaming(false);
    }, [abort]),
    reset: useCallback(() => {
      abort();
      turn.current = 0;
      setIsStreaming(false);
      setMessages([]);
    }, [abort]),
  };
}
