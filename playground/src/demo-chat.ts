import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ViewMessage, ViewPart } from "@/types";

/** Stands in for a screenshot, so no binary blob sits in the source. */
const shot = btoa(
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="150">` +
    `<rect width="320" height="150" rx="8" fill="#f8fafc"/>` +
    `<rect x="16" y="14" width="96" height="10" rx="5" fill="#0f172a"/>` +
    `<rect x="16" y="38" width="288" height="22" rx="6" fill="#e2e8f0"/>` +
    `<rect x="16" y="68" width="288" height="22" rx="6" fill="#e2e8f0"/>` +
    `<rect x="16" y="98" width="140" height="22" rx="6" fill="#e2e8f0"/>` +
    `<rect x="164" y="98" width="140" height="22" rx="6" fill="#e2e8f0"/>` +
    `<rect x="16" y="128" width="80" height="14" rx="7" fill="#6366f1"/></svg>`,
);

/** One scripted exchange: what the user sent, and the reply it gets. */
export interface DemoTurn {
  /** The user turn. A string is one text part; parts carry a dictated turn. */
  prompt: string | ViewPart[];
  /** The assistant turn, replayed part by part. */
  reply: (stamp: number) => ViewPart[];
}

/**
 * One conversation, start to end: a signup form breaks after a deploy, the
 * agent reads the page, traces the handler, patches it, tests it and commits.
 * Every renderer the chat can reach appears where that step would put it, so
 * the reel reads as a session rather than a component gallery.
 */
export const turns: DemoTurn[] = [
  // 1 — read the page, say what is there, plan the rest.
  {
    prompt: "Signup broke after this morning's deploy. The button does nothing. Can you look?",
    reply: (stamp) => [
      {
        kind: "thinking",
        text: "Read the page first. The markup says what the handler needs, and the console says what broke.",
      },
      {
        kind: "tool",
        toolCallId: `call-${stamp}-read`,
        name: "read_page",
        args: { maxChars: 8000 },
        status: "done",
        output: JSON.stringify(
          {
            title: document.title,
            url: location.href,
            forms: [{ id: "signup", action: "/api/v1/signup", method: "post", fields: 4 }],
          },
          null,
          2,
        ),
      },
      {
        kind: "text",
        text: [
          "The page holds one form, `form#signup`, that posts to `/api/v1/signup`. Four fields,",
          "one submit button, no inline script. So the markup is not the fault by itself — the",
          "handler or the request is.",
          "",
          "Here is what I want to do:",
        ].join("\n"),
      },
      {
        kind: "element",
        name: "plan",
        props: {
          title: "Find why signup fails",
          description: "Read only. Nothing on the page changes until you allow it.",
          steps: [
            "Read the console for the error",
            "Trace the handler in the repo",
            "Check the field names against the page",
            "Patch, test, commit",
          ],
        },
      },
      {
        kind: "element",
        name: "suggestion",
        props: {
          suggestions: [
            "Check the console for errors",
            "Show me the deploy diff",
            "Roll back instead",
          ],
        },
      },
    ],
  },

  // 2 — the console: one throw, one 404, and the pages that explain them.
  {
    prompt: "Check the console for errors",
    reply: (stamp) => [
      {
        kind: "thinking",
        text: "Two entries matter. The stylesheet 404 is cosmetic, the TypeError is the one that stops the submit.",
      },
      {
        kind: "tool",
        toolCallId: `call-${stamp}-console`,
        name: "read_console",
        args: { levels: ["warn", "error"] },
        status: "done",
        output: JSON.stringify(
          [
            {
              level: "error",
              text: "TypeError: Cannot read properties of null (reading 'value')",
              source: "signup.tsx:41",
            },
            { level: "error", text: "GET /assets/style.css 404" },
            { level: "warn", text: "form#signup submitted, no handler completed" },
          ],
          null,
          2,
        ),
      },
      // The 404 again, this time as a failed call — the tool card carries the error.
      {
        kind: "tool",
        toolCallId: `call-${stamp}-fetch`,
        name: "fetch",
        args: { url: "/assets/style.css" },
        status: "error",
        output: "404 Not Found — the file is not in this build.",
      },
      {
        kind: "element",
        name: "web-preview",
        props: {
          url: "about:blank",
          logs: [
            { level: "log", message: "hydrated in 412 ms", at: "2026-08-13T09:15:00Z" },
            {
              level: "error",
              message: "TypeError: Cannot read properties of null (reading 'value')",
              at: "2026-08-13T09:15:04Z",
            },
            { level: "error", message: "GET /assets/style.css 404", at: "2026-08-13T09:15:04Z" },
            {
              level: "warn",
              message: "form#signup submitted, no handler completed",
              at: "2026-08-13T09:15:05Z",
            },
          ],
        },
      },
      {
        kind: "text",
        text: [
          "The submit throws before it sends anything:",
          "",
          "> TypeError: Cannot read properties of null (reading 'value') — `signup.tsx:41`",
          "",
          "`null` means the handler looked an element up and did not find it. The 404 is a",
          "separate, smaller problem: the stylesheet is missing from the build, which is why",
          "the form looks unstyled.",
        ].join("\n"),
      },
      {
        kind: "element",
        name: "sources",
        props: {
          sources: [
            {
              href: "https://developer.mozilla.org/docs/Web/API/HTMLFormElement/submit_event",
              title: "submit event — MDN",
            },
            {
              href: "https://developer.mozilla.org/docs/Web/API/FormData",
              title: "FormData — MDN",
            },
          ],
        },
      },
    ],
  },

  // 3 — trace it to a file.
  {
    prompt: "Where does that come from in our code?",
    reply: (stamp) => [
      { kind: "thinking", text: "Line 41 reads a field by id. Find who renamed that id." },
      {
        kind: "element",
        name: "chain-of-thought",
        props: {
          title: "Tracing the handler",
          steps: [
            {
              label: "Searched the repo for the form id",
              description: "2 files",
              results: ["src/pages/signup.tsx", "src/api/signup.ts"],
              status: "complete",
            },
            {
              label: "Read the submit handler",
              description: "src/pages/signup.tsx:36-52",
              status: "complete",
            },
            {
              label: "Compared it with the deploy diff",
              results: ["#email → #email-address"],
              status: "complete",
            },
          ],
        },
      },
      {
        kind: "tool",
        toolCallId: `call-${stamp}-grep`,
        name: "run_command",
        args: { command: 'rg -n "getElementById" src' },
        status: "done",
        output: [
          'src/pages/signup.tsx:41:  const email = document.getElementById("email")!.value;',
          'src/pages/signup.tsx:42:  const password = document.getElementById("password")!.value;',
        ].join("\n"),
      },
      {
        kind: "element",
        name: "file-tree",
        props: {
          expanded: ["src", "src/pages"],
          selected: "src/pages/signup.tsx",
          nodes: [
            {
              name: "src",
              path: "src",
              children: [
                {
                  name: "pages",
                  path: "src/pages",
                  children: [
                    { name: "signup.tsx", path: "src/pages/signup.tsx" },
                    { name: "signup.test.tsx", path: "src/pages/signup.test.tsx" },
                  ],
                },
                {
                  name: "api",
                  path: "src/api",
                  children: [{ name: "signup.ts", path: "src/api/signup.ts" }],
                },
                { name: "validate.ts", path: "src/validate.ts" },
              ],
            },
            { name: "package.json", path: "package.json" },
          ],
        },
      },
      {
        kind: "text",
        text: [
          "Here is the handler as it stands:",
          "",
          "```tsx [src/pages/signup.tsx:38]",
          "function handleSubmit(event: SubmitEvent) {",
          "  event.preventDefault();",
          '  const email = document.getElementById("email")!.value;',
          '  const password = document.getElementById("password")!.value;',
          '  return post("/api/v1/signup", { email, password });',
          "}",
          "```",
          "",
          "1. The deploy renamed the field to `email-address`.",
          '2. `getElementById("email")` now returns `null`.',
          "3. The non-null assertion hides it at build time, so it throws at run time.",
        ].join("\n"),
      },
    ],
  },

  // 4 — the gate: this one touches the live page, so it waits.
  {
    prompt: "Read the field names off the page so we are sure.",
    reply: (stamp) => [
      {
        kind: "thinking",
        text: "The page is the ground truth. Reading the live DOM needs your word.",
      },
      {
        kind: "tool",
        toolCallId: `call-${stamp}`,
        name: "find_elements",
        args: { selector: "form#signup input" },
        status: "pending",
      },
      {
        kind: "text",
        text: "Allow that and I will match the four field names against the handler.",
      },
    ],
  },

  // 5 — the answer to the gate: ids, and a shot of the form.
  {
    prompt: "Allowed. Take a shot of the form too.",
    reply: (stamp) => [
      { kind: "thinking", text: "Reading the ids, then framing the form for the screenshot." },
      {
        kind: "tool",
        toolCallId: `call-${stamp}-shot`,
        name: "screenshot",
        args: { selector: "form#signup" },
        status: "done",
        output: JSON.stringify({ width: 320, height: 150, bytes: 18_244 }, null, 2),
      },
      {
        kind: "element",
        name: "image",
        props: {
          base64: shot,
          mediaType: "image/svg+xml",
          alt: "The signup form, unstyled",
        },
      },
      {
        kind: "text",
        text: [
          "| Field | id on the page | id in the handler |",
          "| --- | --- | --- |",
          "| Email | `email-address` | `email` |",
          "| Password | `password` | `password` |",
          "| First name | `given-name` | — |",
          "| Last name | `family-name` | — |",
          "",
          "One row is wrong, and it is the first one the handler reads. The shot also shows the",
          "missing stylesheet — the form renders, it is only unstyled.",
        ].join("\n"),
      },
    ],
  },

  // 6 — the edit: queue, ask, checkpoint, patch.
  {
    prompt: "Fix it. Keep the change small.",
    reply: (stamp) => [
      {
        kind: "thinking",
        text: "One line. Read the values off the form instead of by id, so a rename cannot break it again.",
      },
      {
        kind: "element",
        name: "queue",
        props: {
          label: "This session",
          items: [
            { id: "q1", title: "Read the console", completed: true },
            { id: "q2", title: "Trace the handler", completed: true },
            { id: "q3", title: "Patch the field lookup", description: "src/pages/signup.tsx:41" },
            { id: "q4", title: "Run the tests" },
            { id: "q5", title: "Commit" },
          ],
        },
      },
      {
        kind: "element",
        name: "confirmation",
        props: {
          title: "Write src/pages/signup.tsx? Two lines change.",
          state: "approval-requested",
          approval: { id: "approval-patch" },
        },
      },
      {
        kind: "element",
        name: "checkpoint",
        props: {
          label: "Checkpoint · before the patch",
          tooltip: "Restore the file to this point",
        },
      },
      {
        kind: "tool",
        toolCallId: `call-${stamp}-patch`,
        name: "apply_patch",
        args: { path: "src/pages/signup.tsx" },
        status: "done",
        output: "1 file changed, 2 insertions(+), 2 deletions(-)",
      },
      {
        kind: "text",
        text: [
          "```diff [src/pages/signup.tsx]",
          '-  const email = document.getElementById("email")!.value;',
          '-  const password = document.getElementById("password")!.value;',
          "+  const data = new FormData(event.currentTarget as HTMLFormElement);",
          "+  const { email, password } = Object.fromEntries(data) as Record<string, string>;",
          "```",
          "",
          "`FormData` reads the `name` attributes, which the deploy left alone. The ids can move",
          "again and the handler will not notice.",
        ].join("\n"),
      },
      {
        kind: "element",
        name: "task",
        props: {
          title: "Patched the submit handler",
          items: [
            { text: "Read", files: ["src/pages/signup.tsx"] },
            { text: "Replaced two id lookups with one FormData read" },
            { text: "Left the stylesheet 404 alone — different fault" },
          ],
        },
      },
    ],
  },

  // 7 — tests, and the one that fails.
  {
    prompt: "Run the tests.",
    reply: (stamp) => [
      {
        kind: "thinking",
        text: "Running the page tests only. The whole suite is slower than this turn.",
      },
      {
        kind: "tool",
        toolCallId: `call-${stamp}-test`,
        name: "run_command",
        args: { command: "pnpm vitest run src/pages" },
        status: "done",
        output: [
          " ❯ src/pages/signup.test.tsx (4 tests | 1 failed)",
          " ✓ src/pages/fields.test.tsx (5 tests)",
          "",
          " Tests  7 passed | 1 failed | 1 skipped (9)",
        ].join("\n"),
      },
      {
        kind: "element",
        name: "test-results",
        props: {
          summary: { passed: 7, failed: 1, skipped: 1, total: 9, duration: 1240 },
          suites: [
            {
              name: "src/pages/signup.test.tsx",
              status: "failed",
              tests: [
                { name: "submits the form values", status: "passed", duration: 18 },
                { name: "keeps working after an id rename", status: "passed", duration: 9 },
                {
                  name: "rejects an empty email",
                  status: "failed",
                  duration: 21,
                  error: {
                    message: "expected post() not to be called",
                    stack: "at handleSubmit (src/pages/signup.tsx:41:9)",
                  },
                },
                { name: "reports a server error", status: "skipped" },
              ],
            },
            {
              name: "src/pages/fields.test.tsx",
              status: "passed",
              tests: [
                { name: "labels every input", status: "passed", duration: 31 },
                { name: "marks the required fields", status: "passed", duration: 12 },
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
            "AssertionError: expected post() not to be called",
            "    at handleSubmit (/app/src/pages/signup.tsx:41:9)",
            "    at submit (/app/src/pages/signup.test.tsx:52:5)",
            "    at runTest (/app/node_modules/@vitest/runner/dist/index.js:781:15)",
          ].join("\n"),
        },
      },
      {
        kind: "text",
        text: [
          "The submit works again, but I dropped a guard with the old lookup: the empty check sat",
          "on the id read, so an empty email now posts.",
          "",
          "- [x] Submit sends the values",
          "- [x] A rename cannot break it",
          "- [ ] An empty email is refused",
        ].join("\n"),
      },
    ],
  },

  // 8 — the second fix, tried in the sandbox, then committed.
  {
    prompt: "Fix that one too, then commit both.",
    reply: (stamp) => [
      { kind: "thinking", text: "Trying the guard on its own before it goes into the file." },
      {
        kind: "element",
        name: "sandbox",
        props: {
          title: "validate.ts",
          state: "output-available",
          tabs: [
            {
              value: "code",
              label: "Code",
              language: "ts",
              code: [
                'import { validate } from "./src/validate.ts";',
                "",
                'console.log(validate({ email: "", password: "hunter2" }));',
                'console.log(validate({ email: "a@b.co", password: "hunter2" }));',
              ].join("\n"),
            },
            {
              value: "output",
              label: "Output",
              language: "bash",
              code: '{ ok: false, field: "email" }\n{ ok: true }',
            },
          ],
        },
      },
      {
        kind: "tool",
        toolCallId: `call-${stamp}-patch2`,
        name: "apply_patch",
        args: { path: "src/pages/signup.tsx" },
        status: "done",
        output: "1 file changed, 3 insertions(+)",
      },
      {
        kind: "tool",
        toolCallId: `call-${stamp}-retest`,
        name: "run_command",
        args: { command: "pnpm vitest run src/pages" },
        status: "done",
        output: " Tests  9 passed (9)",
      },
      {
        kind: "element",
        name: "test-results",
        props: {
          summary: { passed: 9, failed: 0, skipped: 0, total: 9, duration: 1180 },
          suites: [
            {
              name: "src/pages/signup.test.tsx",
              status: "passed",
              tests: [
                { name: "submits the form values", status: "passed", duration: 17 },
                { name: "keeps working after an id rename", status: "passed", duration: 8 },
                { name: "rejects an empty email", status: "passed", duration: 11 },
                { name: "reports a server error", status: "passed", duration: 14 },
              ],
            },
          ],
        },
      },
      {
        kind: "element",
        name: "commit",
        props: {
          hash: "a1b2c3d",
          message: "Read the signup fields from FormData, guard the empty email",
          author: "Pooya Parsa",
          initials: "PP",
          date: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
          files: [
            { path: "src/pages/signup.tsx", status: "modified", additions: 5, deletions: 2 },
            { path: "src/validate.ts", status: "modified", additions: 6, deletions: 0 },
            { path: "src/pages/signup.test.tsx", status: "modified", additions: 9, deletions: 1 },
          ],
        },
      },
      { kind: "text", text: "Green, and committed on the branch. Nothing is pushed." },
    ],
  },

  // 9 — what is left before it ships.
  {
    prompt: "What is left before I deploy?",
    reply: () => [
      {
        kind: "thinking",
        text: "The endpoint contract, the environment, and the package that renamed the ids.",
      },
      {
        kind: "element",
        name: "schema-display",
        props: {
          method: "POST",
          path: "/api/v1/signup",
          description: "Create an account and send the confirmation mail.",
          parameters: [
            { name: "locale", type: "string", location: "query", description: "Defaults to en." },
          ],
          requestBody: [
            { name: "email", type: "string", required: true },
            { name: "password", type: "string", required: true },
            {
              name: "options",
              type: "object",
              properties: [
                { name: "marketing", type: "boolean" },
                { name: "source", type: "string" },
              ],
            },
          ],
          responseBody: [
            { name: "userId", type: "string", required: true },
            { name: "confirmationSent", type: "boolean" },
          ],
        },
      },
      {
        kind: "text",
        text: "The handler now sends exactly those two fields. The environment it needs on the server:",
      },
      {
        kind: "element",
        name: "environment-variables",
        props: {
          variables: [
            { name: "SIGNUP_MAIL_KEY", value: "sk-mail-9f21c8", required: true },
            { name: "APP_ORIGIN", value: "https://northwind.app", required: true },
            { name: "NODE_ENV", value: "production" },
          ],
        },
      },
      {
        kind: "text",
        text: "And the rename itself came from a dependency, so pin it before the next build moves again:",
      },
      {
        kind: "element",
        name: "package-info",
        props: {
          name: "@northwind/forms",
          currentVersion: "1.4.2",
          newVersion: "1.5.0",
          changeType: "minor",
        },
      },
      {
        kind: "element",
        name: "snippet",
        props: { label: "$", code: "pnpm add @northwind/forms@1.5.0" },
      },
      {
        kind: "text",
        text: [
          "Three things, in order:",
          "",
          "1. Pin `@northwind/forms` and rebuild — that also restores `/assets/style.css`.",
          "2. Set `SIGNUP_MAIL_KEY` on the deploy target. It is the only missing one.",
          "3. Push the branch and let CI run the full suite.",
        ].join("\n"),
      },
    ],
  },

  // 10 — a dictated turn, and the hand-off it asks for.
  {
    prompt: [
      { kind: "element", name: "speech-input", props: {} },
      {
        kind: "element",
        name: "transcription",
        props: {
          currentTime: 3.4,
          segments: [
            { text: "Good. Write the pull request description,", startSecond: 0, endSecond: 2.1 },
            { text: "and hand the docs page to a sub agent.", startSecond: 2.1, endSecond: 4.6 },
          ],
        },
      },
    ],
    reply: () => [
      { kind: "thinking", text: "Drafting from the diff, then delegating the docs page." },
      {
        kind: "element",
        name: "agent",
        props: {
          name: "Docs writer",
          model: "claude-sonnet-4-5",
          instructions:
            "Update docs/signup.md to match the new field names. Change nothing outside that file.",
          tools: [
            {
              name: "read_file",
              description: "Read one file from the repo.",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
                required: ["path"],
              },
            },
            {
              name: "apply_patch",
              description: "Write one file, as a unified diff.",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" }, patch: { type: "string" } },
                required: ["path", "patch"],
              },
            },
          ],
          output: "type DocsEdit = {\n  path: string;\n  summary: string;\n};",
        },
      },
      {
        kind: "element",
        name: "artifact",
        props: {
          title: "PR — Fix the signup submit",
          description: "Draft · 1 commit · 3 files",
          body: [
            "The deploy renamed the signup field ids, and the submit handler still read them by",
            "id, so it threw before it sent anything.",
            "",
            "The handler now reads FormData, which uses the name attributes the rename left alone.",
            "The empty-email guard moved with it and has a test.",
          ].join("\n"),
        },
      },
      {
        kind: "text",
        text: "The docs agent is running. Say the word and I open the pull request.",
      },
    ],
  },
];

/** Playback pacing, ms. */
const FIRST_TOKEN = 400;
const TOKEN_STEP = 40;
const TOKENS_PER_STEP = 2;
const PART_GAP = 220;
const TOOL_RUN = 700;
const PROMPT_GAP = 500;
const TURN_GAP = 900;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Words with their trailing whitespace, so newlines survive the split. */
const tokenize = (text: string) => text.match(/\S+\s*/g) ?? [];

/** The user turn as parts, whether it was written as a string or as parts. */
export const promptParts = (prompt: DemoTurn["prompt"]): ViewPart[] =>
  typeof prompt === "string" ? [{ kind: "text", text: prompt }] : prompt;

/**
 * Answer the canned approval gate, so the card can be seen in both states. The
 * replayed chat and the static transcript both close it this way.
 */
export function answerApproval(
  messages: ViewMessage[],
  toolCallId: string,
  approved: boolean,
): ViewMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) =>
      part.kind === "tool" && part.toolCallId === toolCallId
        ? {
            ...part,
            status: approved ? ("done" as const) : ("denied" as const),
            approval: { id: toolCallId, approved },
            output: approved
              ? JSON.stringify(
                  [
                    { tag: "input", id: "email-address", name: "email", type: "email" },
                    { tag: "input", id: "password", name: "password", type: "password" },
                    { tag: "input", id: "given-name", name: "given_name", type: "text" },
                    { tag: "input", id: "family-name", name: "family_name", type: "text" },
                  ],
                  null,
                  2,
                )
              : "The user denied this call.",
          }
        : part,
    ),
  }));
}

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
      // A gate is asked, not run — it shows as pending from the start.
      if (part.status === "pending") {
        shown.push(part);
        emit([...shown]);
      } else {
        shown.push({ ...part, status: "running", output: undefined });
        emit([...shown]);
        await sleep(TOOL_RUN);
        if (signal.aborted) return;
        shown[shown.length - 1] = part;
        emit([...shown]);
      }
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
  /** Play the whole conversation on mount. The playground sets this; a host page does not. */
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
      // Whatever the visitor types, the next scripted turn answers it.
      const { reply } = turns[turn.current % turns.length];
      turn.current += 1;

      setMessages((current) => [
        ...current,
        { id: `user-${stamp}`, role: "user", parts: [{ kind: "text", text }] },
      ]);
      setIsStreaming(true);

      play(reply(stamp), emitter(`assistant-${stamp}`), controller.signal).finally(() => {
        if (run.current === controller) run.current = null;
        if (!controller.signal.aborted) setIsStreaming(false);
      });
    },
    [abort, emitter],
  );

  /**
   * Replay the whole conversation, prompts included — the playground opens on a
   * session in progress rather than an empty pane.
   */
  const showcase = useCallback(() => {
    abort();
    const controller = new AbortController();
    run.current = controller;
    setIsStreaming(true);

    void (async () => {
      for (const [index, scripted] of turns.entries()) {
        if (controller.signal.aborted) break;
        turn.current = index + 1;
        const stamp = Date.now();

        setMessages((current) => [
          ...current,
          { id: `demo-user-${index}`, role: "user", parts: promptParts(scripted.prompt) },
        ]);
        await sleep(PROMPT_GAP);
        if (controller.signal.aborted) break;

        await play(scripted.reply(stamp), emitter(`demo-${index}`), controller.signal);
        await sleep(TURN_GAP);
      }
      if (run.current === controller) run.current = null;
      if (!controller.signal.aborted) setIsStreaming(false);
    })();
  }, [abort, emitter]);

  useEffect(() => {
    if (autoStart) showcase();
  }, [autoStart, showcase]);

  const respond = useCallback(
    (toolCallId: string, approved: boolean) =>
      setMessages((current) => answerApproval(current, toolCallId, approved)),
    [],
  );

  return {
    messages,
    isStreaming,
    send,
    respond,
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
