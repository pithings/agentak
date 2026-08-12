import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import { AgentChat } from "@/components/agent-chat";
import { ELEMENTS } from "@/components/elements";
import { replies } from "@/demo-chat";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Image } from "@/components/ai-elements/image";
import {
  Confirmation,
  ConfirmationActions,
  ConfirmationAction,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Queue,
  QueueItem,
  QueueItemContent,
  QueueList,
  QueueSection,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from "@/components/ai-elements/checkpoint";
import {
  Commit,
  CommitAuthorAvatar,
  CommitContent,
  CommitFile,
  CommitFileAdditions,
  CommitFilePath,
  CommitFileStatus,
  CommitFiles,
  CommitHash,
  CommitHeader,
  CommitHeaderTrigger,
  CommitInfo,
  CommitMessage,
} from "@/components/ai-elements/commit";
import { Transcription } from "@/components/ai-elements/transcription";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { EnvironmentVariables } from "@/components/ai-elements/environment-variables";
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentTool,
  AgentTools,
} from "@/components/ai-elements/agent";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import { Plan, PlanDescription, PlanHeader, PlanTitle } from "@/components/ai-elements/plan";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@/components/ai-elements/task";
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import {
  Sandbox,
  SandboxContent,
  SandboxHeader,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
} from "@/components/ai-elements/sandbox";
import { SchemaDisplay } from "@/components/ai-elements/schema-display";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewNavigation,
  WebPreviewUrl,
} from "@/components/ai-elements/web-preview";
import { CopyIcon } from "@/lib/icons";
import { FileTree, FileTreeFile, FileTreeFolder } from "@/components/ai-elements/file-tree";
import { PackageInfo } from "@/components/ai-elements/package-info";
import {
  Snippet,
  SnippetAddon,
  SnippetCopyButton,
  SnippetInput,
} from "@/components/ai-elements/snippet";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import {
  StackTrace,
  StackTraceContent,
  StackTraceError,
  StackTraceErrorMessage,
  StackTraceErrorType,
  StackTraceFrames,
  StackTraceHeader,
} from "@/components/ai-elements/stack-trace";
import {
  Test,
  TestResults,
  TestResultsContent,
  TestResultsDuration,
  TestResultsHeader,
  TestResultsSummary,
  TestSuite,
  TestSuiteContent,
  TestSuiteName,
} from "@/components/ai-elements/test-results";
import { Context } from "@/components/ai-elements/context";
import type { ViewMessage } from "@/types";

const messages: ViewMessage[] = [
  { id: "1", parts: [{ kind: "text", text: "hello" }], role: "user" },
  { id: "2", parts: [{ kind: "text", text: "hi there" }], role: "assistant" },
];

afterEach(cleanup);

describe("AgentChat", () => {
  it("renders a transcript", () => {
    render(
      <AgentChat
        isStreaming={false}
        messages={messages}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
      />,
    );

    expect(screen.getByText("hello")).toBeTruthy();
    expect(screen.getByText("hi there")).toBeTruthy();
  });

  it("renders the empty state", () => {
    render(
      <AgentChat
        isStreaming={false}
        messages={[]}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
      />,
    );

    expect(screen.getByPlaceholderText("Ask about this page…")).toBeTruthy();
  });

  it("renders what the wired agent adds: model, usage, tools, queue", () => {
    render(
      <AgentChat
        agent={{
          instructions: "Answer from the page.",
          name: "Page reader",
          tools: [{ name: "read_page", description: "Read the page." }],
        }}
        isStreaming
        messages={[]}
        modelId="claude-sonnet-5"
        models={[{ contextWindow: 1_000_000, id: "claude-sonnet-5", name: "Claude Sonnet 5" }]}
        onReset={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        queued={[{ id: "q1", text: "and the prices" }]}
        usage={{ maxTokens: 1_000_000, usedTokens: 250_000 }}
      />,
    );

    expect(screen.getByText("Claude Sonnet 5")).toBeTruthy();
    // The ring and the panel both report it.
    expect(screen.getAllByText("25%")).toHaveLength(2);
    expect(screen.getByText("Page reader")).toBeTruthy();
    expect(screen.getByText("Read the page.")).toBeTruthy();
    expect(screen.getByText("and the prices")).toBeTruthy();
    // Nothing has come back yet, so the turn shows as working.
    expect(screen.getByText("Working…")).toBeTruthy();
    expect(screen.getByPlaceholderText("Queue a message…")).toBeTruthy();
  });

  it("asks before a gated tool call, and answers with the tool call id", () => {
    const answered: [string, boolean][] = [];
    render(
      <AgentChat
        isStreaming
        messages={[
          {
            id: "1",
            parts: [
              {
                args: {},
                kind: "tool",
                name: "read_page",
                status: "pending",
                toolCallId: "call-1",
              },
            ],
            role: "assistant",
          },
        ]}
        onReset={() => {}}
        onRespond={(id, approved) => answered.push([id, approved])}
        onSend={() => {}}
        onStop={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Allow"));
    expect(answered).toEqual([["call-1", true]]);
  });
});

describe("CodeBlock", () => {
  it("highlights json on the first render", () => {
    const { container } = render(<CodeBlock code={'{\n  "a": 1\n}'} language="json" />);

    // rangi is synchronous, so the tokens are coloured without a second pass.
    expect(screen.getByText('"a"').getAttribute("style")).toContain("--shj-var");
    expect(screen.getByText("1").getAttribute("style")).toContain("--shj-num");
    expect(container.querySelectorAll("code > span")).toHaveLength(3);
  });

  it("renders an unknown language verbatim", () => {
    render(<CodeBlock code="never mind" language="klingon" />);

    expect(screen.getByText("never mind")).toBeTruthy();
  });
});

describe("Image", () => {
  it("renders base64 as a data URL", () => {
    render(<Image alt="a dot" base64="AAAA" mediaType="image/png" />);

    expect(screen.getByAltText("a dot").getAttribute("src")).toBe("data:image/png;base64,AAAA");
  });
});

describe("Sources", () => {
  it("renders a citation link", () => {
    render(
      <Sources defaultOpen>
        <SourcesTrigger count={1} />
        <SourcesContent>
          <Source href="https://example.com" title="Example" />
        </SourcesContent>
      </Sources>,
    );

    expect(screen.getByText("Example").closest("a")?.getAttribute("href")).toBe(
      "https://example.com",
    );
  });
});

describe("Snippet", () => {
  it("puts the code in a read-only input", () => {
    render(
      <Snippet code="pnpm add web-agent">
        <SnippetInput />
        <SnippetAddon align="inline-end">
          <SnippetCopyButton />
        </SnippetAddon>
      </Snippet>,
    );

    const input = screen.getByDisplayValue("pnpm add web-agent") as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });
});

describe("FileTree", () => {
  it("hides the children of a closed folder", () => {
    render(
      <FileTree defaultExpanded={new Set(["src"])}>
        <FileTreeFolder name="src" path="src">
          <FileTreeFile name="index.ts" path="src/index.ts" />
        </FileTreeFolder>
        <FileTreeFolder name="test" path="test">
          <FileTreeFile name="hidden.ts" path="test/hidden.ts" />
        </FileTreeFolder>
      </FileTree>,
    );

    expect(screen.getByText("index.ts").closest("[hidden]")).toBeNull();
    expect(screen.getByText("hidden.ts").closest("[hidden]")).toBeTruthy();
  });
});

describe("PackageInfo", () => {
  it("renders the version change", () => {
    render(
      <PackageInfo changeType="minor" currentVersion="1.0.0" name="preact" newVersion="1.1.0" />,
    );

    expect(screen.getByText("preact")).toBeTruthy();
    expect(screen.getByText("1.1.0")).toBeTruthy();
    expect(screen.getByText("minor")).toBeTruthy();
  });
});

describe("TestResults", () => {
  it("renders the summary and a failed test", () => {
    render(
      <TestResults summary={{ failed: 1, passed: 2, skipped: 0, total: 3, duration: 1240 }}>
        <TestResultsHeader>
          <TestResultsSummary />
          <TestResultsDuration />
        </TestResultsHeader>
        <TestResultsContent>
          <TestSuite defaultOpen name="parser.test.ts" status="failed">
            <TestSuiteName />
            <TestSuiteContent>
              <Test duration={12} name="parses a fence" status="failed" />
            </TestSuiteContent>
          </TestSuite>
        </TestResultsContent>
      </TestResults>,
    );

    expect(screen.getByText("2 passed")).toBeTruthy();
    expect(screen.getByText("1.24s")).toBeTruthy();
    expect(screen.getByText("parses a fence")).toBeTruthy();
  });
});

describe("StackTrace", () => {
  const trace = [
    "TypeError: Cannot read properties of undefined (reading 'id')",
    "    at getId (/app/src/user.ts:12:20)",
    "    at /app/node_modules/lib/index.js:4:1",
  ].join("\n");

  it("splits the error from its frames", () => {
    render(
      <StackTrace defaultOpen trace={trace}>
        <StackTraceHeader>
          <StackTraceError>
            <StackTraceErrorType />
            <StackTraceErrorMessage />
          </StackTraceError>
        </StackTraceHeader>
        <StackTraceContent>
          <StackTraceFrames />
        </StackTraceContent>
      </StackTrace>,
    );

    expect(screen.getByText("TypeError")).toBeTruthy();
    expect(screen.getByText("Cannot read properties of undefined (reading 'id')")).toBeTruthy();
    expect(screen.getByText("/app/src/user.ts:12:20")).toBeTruthy();
  });
});

describe("SchemaDisplay", () => {
  it("highlights a path parameter without raw HTML", () => {
    const { container } = render(
      <SchemaDisplay
        method="POST"
        parameters={[{ name: "id", required: true, type: "string" }]}
        path="/users/{id}/posts"
      />,
    );

    expect(screen.getByText("POST")).toBeTruthy();
    expect(container.querySelector('[data-slot="schema-path-param"]')?.textContent).toBe("{id}");
  });
});

describe("Sandbox", () => {
  it("shows only the active tab panel", () => {
    render(
      <Sandbox>
        <SandboxHeader state="output-available" title="build" />
        <SandboxContent>
          <SandboxTabs defaultValue="code">
            <SandboxTabsBar>
              <SandboxTabsList>
                <SandboxTabsTrigger value="code">Code</SandboxTabsTrigger>
                <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
              </SandboxTabsList>
            </SandboxTabsBar>
            <SandboxTabContent value="code">source</SandboxTabContent>
            <SandboxTabContent value="output">result</SandboxTabContent>
          </SandboxTabs>
        </SandboxContent>
      </Sandbox>,
    );

    expect(screen.getByRole("tab", { name: "Code" }).getAttribute("data-state")).toBe("active");
    expect(screen.getByText("result").hasAttribute("hidden")).toBe(true);
  });
});

describe("Artifact", () => {
  it("uses the title attribute instead of a tooltip", () => {
    render(
      <Artifact>
        <ArtifactHeader>
          <ArtifactTitle>report.md</ArtifactTitle>
          <ArtifactActions>
            <ArtifactAction icon={CopyIcon} tooltip="Copy" />
          </ArtifactActions>
        </ArtifactHeader>
        <ArtifactContent>body</ArtifactContent>
      </Artifact>,
    );

    expect(screen.getByTitle("Copy")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });
});

describe("WebPreview", () => {
  it("sandboxes the frame and shows the url", () => {
    const { container } = render(
      <WebPreview defaultUrl="about:blank">
        <WebPreviewNavigation>
          <WebPreviewUrl />
        </WebPreviewNavigation>
        <WebPreviewBody />
        <WebPreviewConsole />
      </WebPreview>,
    );

    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("about:blank");
    expect(frame?.getAttribute("sandbox")).toContain("allow-scripts");
    expect((screen.getByPlaceholderText("Enter URL...") as HTMLInputElement).value).toBe(
      "about:blank",
    );
  });
});

describe("ChainOfThought", () => {
  it("renders its steps when open", () => {
    render(
      <ChainOfThought defaultOpen>
        <ChainOfThoughtHeader>Reading the page</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <ChainOfThoughtStep label="Collected the text" status="complete" />
        </ChainOfThoughtContent>
      </ChainOfThought>,
    );

    expect(screen.getByText("Reading the page")).toBeTruthy();
    expect(screen.getByText("Collected the text")).toBeTruthy();
  });
});

describe("Task", () => {
  it("renders its items and a file chip", () => {
    render(
      <Task>
        <TaskTrigger title="Searched the page" />
        <TaskContent>
          <TaskItem>
            Read <TaskItemFile>section#plans</TaskItemFile>
          </TaskItem>
        </TaskContent>
      </Task>,
    );

    expect(screen.getByText("Searched the page")).toBeTruthy();
    expect(screen.getByText("section#plans")).toBeTruthy();
  });
});

describe("Plan", () => {
  it("shimmers the title while streaming", () => {
    const { container } = render(
      <Plan isStreaming>
        <PlanHeader>
          <PlanTitle>Summarise the pricing</PlanTitle>
          <PlanDescription>Three steps.</PlanDescription>
        </PlanHeader>
      </Plan>,
    );

    expect(container.querySelector('[data-slot="shimmer"]')).toBeTruthy();
    expect(screen.getByText("Summarise the pricing")).toBeTruthy();
  });
});

describe("Agent", () => {
  it("opens the tool named by defaultValue", () => {
    render(
      <Agent>
        <AgentHeader model="claude-sonnet-4-5" name="Page reader" />
        <AgentContent>
          <AgentTools defaultValue={["read_page"]}>
            <AgentTool
              tool={{ description: "Read the visible text.", inputSchema: { type: "object" } }}
              value="read_page"
            />
          </AgentTools>
        </AgentContent>
      </Agent>,
    );

    expect(screen.getByText("Page reader")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Read the visible text/ }).getAttribute("aria-expanded"),
    ).toBe("true");
  });
});

describe("Transcription", () => {
  it("marks the segment the playhead is inside", () => {
    render(
      <Transcription
        currentTime={2}
        segments={[
          { text: "first", startSecond: 0, endSecond: 1 },
          { text: "second", startSecond: 1, endSecond: 3 },
        ]}
      />,
    );

    expect(screen.getByText("second").dataset.active).toBe("true");
  });
});

describe("SpeechInput", () => {
  it("disables the button with no speech API", () => {
    // jsdom has neither SpeechRecognition nor MediaRecorder, so mode is "none".
    render(<SpeechInput />);

    expect(screen.getByLabelText("Start recording").hasAttribute("disabled")).toBe(true);
  });
});

describe("EnvironmentVariables", () => {
  it("masks a value until the switch is on", () => {
    render(<EnvironmentVariables variables={[{ name: "API_KEY", value: "secret" }]} />);

    expect(screen.getByText("API_KEY")).toBeTruthy();
    expect(screen.getByText("••••••")).toBeTruthy();
    expect(screen.getByLabelText("Toggle value visibility").getAttribute("aria-checked")).toBe(
      "false",
    );
  });
});

describe("Confirmation", () => {
  it("shows the actions only while the answer is pending", () => {
    render(
      <Confirmation approval={{ id: "a1" }} state="approval-requested">
        <ConfirmationTitle>Run read_page on example.com?</ConfirmationTitle>
        <ConfirmationActions>
          <ConfirmationAction>Allow</ConfirmationAction>
        </ConfirmationActions>
      </Confirmation>,
    );

    expect(screen.getByText("Run read_page on example.com?")).toBeTruthy();
    expect(screen.getByText("Allow")).toBeTruthy();
  });

  it("renders nothing without an approval", () => {
    const { container } = render(<Confirmation state="approval-requested" />);

    expect(container.innerHTML).toBe("");
  });
});

describe("Suggestion", () => {
  it("reports the suggestion it was clicked with", () => {
    let clicked = "";
    render(
      <Suggestions>
        <Suggestion onClick={(value) => (clicked = value)} suggestion="Summarise this page" />
      </Suggestions>,
    );

    screen.getByText("Summarise this page").click();
    expect(clicked).toBe("Summarise this page");
  });
});

describe("Queue", () => {
  it("renders a queued item under its section", () => {
    render(
      <Queue>
        <QueueSection>
          <QueueSectionTrigger>
            <QueueSectionLabel count={1} label="queued" />
          </QueueSectionTrigger>
          <QueueList>
            <QueueItem>
              <QueueItemContent>Check the pricing table</QueueItemContent>
            </QueueItem>
          </QueueList>
        </QueueSection>
      </Queue>,
    );

    expect(screen.getByText(/1 queued/)).toBeTruthy();
    expect(screen.getByText("Check the pricing table")).toBeTruthy();
  });
});

describe("Checkpoint", () => {
  it("uses the native title in place of a tooltip", () => {
    render(
      <Checkpoint>
        <CheckpointIcon />
        <CheckpointTrigger tooltip="Restore this checkpoint">Checkpoint</CheckpointTrigger>
      </Checkpoint>,
    );

    expect(screen.getByText("Checkpoint").getAttribute("title")).toBe("Restore this checkpoint");
  });
});

describe("Commit", () => {
  it("renders the header and the changed files", () => {
    render(
      <Commit defaultOpen>
        <CommitHeader>
          <CommitAuthorAvatar initials="PP" />
          <CommitHeaderTrigger>
            <CommitInfo>
              <CommitMessage>Adopt the shadow root stylesheet</CommitMessage>
              <CommitHash>a1b2c3d</CommitHash>
            </CommitInfo>
          </CommitHeaderTrigger>
        </CommitHeader>
        <CommitContent>
          <CommitFiles>
            <CommitFile>
              <CommitFileStatus status="modified" />
              <CommitFilePath>src/element.tsx</CommitFilePath>
              <CommitFileAdditions count={12} />
            </CommitFile>
          </CommitFiles>
        </CommitContent>
      </Commit>,
    );

    expect(screen.getByText("PP")).toBeTruthy();
    expect(screen.getByText("Adopt the shadow root stylesheet")).toBeTruthy();
    expect(screen.getByText("src/element.tsx")).toBeTruthy();
    expect(screen.getByText("M")).toBeTruthy();
  });
});

describe("Context", () => {
  // The chat does not mount this one, so it carries its own class check.
  const props = {
    defaultOpen: true,
    modelId: "claude-sonnet-4-5",
    usedTokens: 118_400,
    maxTokens: 200_000,
    usage: { inputTokens: 112_300, outputTokens: 4_120, cachedInputTokens: 96_000 },
    costs: { input: 0.0489, output: 0.0618, cache: 0.0288 },
  };

  it("renders the ring, the meter and the breakdown", () => {
    const { container } = render(<Context {...props} />);

    // 118.4k / 200k, formatted by Intl.
    expect(screen.getAllByText("59.2%").length).toBe(2);
    expect(screen.getByText("118K / 200K")).toBeTruthy();
    expect(screen.getByText("claude-sonnet-4-5")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="context-meter-fill"]')?.getAttribute("style"),
    ).toContain("59.2%");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("59");
    expect(screen.getByText("Cache")).toBeTruthy();
    expect(screen.getByText("$0.1395")).toBeTruthy(); // input + output + cache
  });

  it("hides a row the model reported no tokens for", () => {
    render(<Context {...props} />);

    expect(screen.queryByText("Reasoning")).toBeNull();
  });
});

describe("the demo transcript", () => {
  // Every ported element, driven by its own fixture. This is the only check
  // that covers all of them together — the two tests below see just the parts
  // the chat happens to render.
  const parts = replies.flatMap((reply) => reply(0));

  it("resolves every element name in the registry", () => {
    const names = parts.filter((part) => part.kind === "element").map((part) => part.name);

    expect(names.length).toBeGreaterThan(20);
    expect(names.filter((name) => !ELEMENTS[name])).toEqual([]);
  });
});

describe("styles", () => {
  it("ships no stylesheet", () => {
    // There is no sheet to adopt any more, and nothing injects one. A component
    // that grows a `*Styles` block has nowhere to put it, so it would render
    // dead text — this is what catches that, since the old manifest that used
    // to is gone. Tokens are the exception and live in `styles/base.ts`, which
    // this glob does not reach.
    const modules = import.meta.glob<Record<string, unknown>>("./components/**/*.tsx", {
      eager: true,
    });

    const blocks = Object.values(modules)
      .flatMap((module) => Object.entries(module))
      .filter(([name, value]) => name.endsWith("Styles") && typeof value === "string")
      .map(([name]) => name);

    expect(blocks).toEqual([]);
  });
});

describe("runtime", () => {
  it("has no react package to resolve", async () => {
    // The eject is only real if nothing can pull a second renderer in.
    // Indirected through a variable so tsc does not try to resolve it.
    const react = "react";
    await expect(import(/* @vite-ignore */ react)).rejects.toThrow();
  });
});
