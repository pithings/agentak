import type { ComponentChildren, ComponentType } from "preact";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonSx } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselIndex,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemLink,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  type PopoverTriggerProps,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockHeader,
} from "@/components/ai-elements/code-block";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Context } from "@/components/ai-elements/context";
import { Terminal } from "@/components/ai-elements/terminal";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from "@/components/ai-elements/inline-citation";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorName,
  ModelSelectorShortcut,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  OpenIn,
  OpenInChatGPT,
  OpenInClaude,
  OpenInContent,
  OpenInCursor,
  OpenInLabel,
  OpenInScira,
  OpenInT3,
  OpenInTrigger,
  OpenInv0,
} from "@/components/ai-elements/open-in-chat";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Markdown } from "@/components/markdown";
import { Element } from "@/components/elements";
// Registers the demo renderers `Element` looks up. Side effect: import it.
import "./demo-elements";
import { turns } from "./demo-chat";
import { BotIcon, CopyIcon, RotateCcwIcon, SearchIcon } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { u } from "@/styles/base";
import type { Sx } from "@/styles/sx";

/**
 * The fixtures alone. Every entry is a preact island the vue page mounts
 * through `preact-host.vue` — the page chrome around them is tailwind, and
 * nothing in this file knows about it.
 */
const S = {
  pgRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
  },
  pgStack: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  pgBox: {
    height: "12rem",
  },
} satisfies Record<string, Sx>;

/**
 * A demo trigger that is not a `Button`. The dropdown, the hover card and the
 * popover each render their own trigger element, so it wears the button look
 * itself — `buttonSx` plus the states `Button` would have tracked.
 */
function DemoTrigger({
  as: Trigger,
  children,
}: {
  as: ComponentType<PopoverTriggerProps>;
  children: ComponentChildren;
}) {
  const { focusVisible, handlers, hovered } = useInteraction<HTMLButtonElement>();

  return (
    <Trigger
      style={buttonSx({ focusVisible, hovered, size: "sm", variant: "outline" })}
      {...handlers}
    >
      {children}
    </Trigger>
  );
}

export interface CatalogEntry {
  name: string;
  render: () => ComponentChildren;
  /** Source file, where it is not `<section dir>/<name>.tsx`. */
  path?: string;
}

export interface CatalogSection {
  /** Route and anchor id. */
  id: string;
  title: string;
  note: string;
  /** Where the source lives, for the header of a component page. */
  dir: string;
  entries: CatalogEntry[];
}

const SAMPLE_TS = [
  "const agent = createAgent({ apiKey });",
  'const reply = await agent.send("Summarise this page");',
].join("\n");

const SAMPLE_MD = [
  "### Markdown",
  "",
  "Text with `inline code`, *emphasis* and a [link](https://preactjs.com).",
  "",
  "- a list item",
  "- another one",
  "",
  "> A block quote, healed mid-stream.",
].join("\n");

/** shadcn primitives, rewritten in preact. */
const primitives: CatalogEntry[] = [
  {
    name: "accordion",
    render: () => (
      <Accordion defaultValue={["what"]} type="multiple">
        <AccordionItem value="what">
          <AccordionTrigger>What is agentak?</AccordionTrigger>
          <AccordionContent>A custom element that hosts the agent loop.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="how">
          <AccordionTrigger>How is it styled?</AccordionTrigger>
          <AccordionContent>One ordered stylesheet, written in typescript.</AccordionContent>
        </AccordionItem>
      </Accordion>
    ),
  },
  {
    name: "alert",
    render: () => (
      <div style={S.pgStack}>
        <Alert>
          <AlertTitle>Scaffold stage</AlertTitle>
          <AlertDescription>The agent loop is written but not connected.</AlertDescription>
        </Alert>
        <Alert variant="destructive">
          <AlertTitle>No API key</AlertTitle>
          <AlertDescription>Set one before sending a message.</AlertDescription>
        </Alert>
      </div>
    ),
  },
  {
    name: "avatar",
    render: () => (
      <div style={S.pgRow}>
        <Avatar size="sm">
          <AvatarFallback>PP</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>WA</AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </div>
    ),
  },
  {
    name: "badge",
    render: () => (
      <div style={S.pgRow}>
        <Badge>default</Badge>
        <Badge variant="secondary">secondary</Badge>
        <Badge variant="destructive">destructive</Badge>
        <Badge variant="outline">outline</Badge>
      </div>
    ),
  },
  {
    name: "button",
    render: () => (
      <div style={S.pgStack}>
        <div style={S.pgRow}>
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div style={S.pgRow}>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="icon-sm" title="Reset" variant="ghost">
            <RotateCcwIcon />
          </Button>
        </div>
      </div>
    ),
  },
  {
    name: "card",
    render: () => (
      <Card>
        <CardHeader>
          <CardTitle>Assistant</CardTitle>
          <CardDescription>Answers only from the current page.</CardDescription>
          <CardAction>
            <Badge variant="outline">idle</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>Two tools: read_page and find_elements.</CardContent>
        <CardFooter>
          <Button size="sm" variant="outline">
            Configure
          </Button>
        </CardFooter>
      </Card>
    ),
  },
  {
    name: "carousel",
    render: () => (
      <Carousel>
        <div style={S.pgRow}>
          <CarouselPrevious />
          <CarouselNext />
          <CarouselIndex />
        </div>
        <CarouselContent>
          {["Read the plan names", "Compare the limits", "Answer in one table"].map((step) => (
            <CarouselItem key={step}>{step}</CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    ),
  },
  {
    name: "collapsible",
    render: () => (
      <Collapsible defaultOpen>
        <CollapsibleTrigger>Toggle the details</CollapsibleTrigger>
        <CollapsibleContent>
          Hand-rolled from radix — it toggles `hidden` instead of animating out.
        </CollapsibleContent>
      </Collapsible>
    ),
  },
  {
    name: "command",
    render: () => (
      <Command>
        <CommandInput placeholder="Filter tools…" />
        <CommandList>
          <CommandEmpty />
          <CommandGroup heading="Page">
            <CommandItem value="read_page">
              read_page
              <CommandShortcut>text</CommandShortcut>
            </CommandItem>
            <CommandItem value="find_elements">
              find_elements
              <CommandShortcut>dom</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    ),
  },
  {
    name: "dropdown-menu",
    render: () => (
      <DropdownMenu>
        <DemoTrigger as={DropdownMenuTrigger}>Actions</DemoTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>This message</DropdownMenuLabel>
          <DropdownMenuItem>Copy</DropdownMenuItem>
          <DropdownMenuItem>Retry</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItemLink href="https://preactjs.com" rel="noopener" target="_blank">
            Open the docs
          </DropdownMenuItemLink>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
  {
    name: "hover-card",
    render: () => (
      <HoverCard>
        <DemoTrigger as={HoverCardTrigger}>developer.mozilla.org</DemoTrigger>
        <HoverCardContent>
          Opens on pointer and on focus after a delay. It never traps focus, so the caret stays
          where it was.
        </HoverCardContent>
      </HoverCard>
    ),
  },
  {
    name: "input",
    render: () => (
      <div style={S.pgStack}>
        <Input placeholder="sk-ant-…" />
        <Input disabled placeholder="Disabled" />
      </div>
    ),
  },
  {
    name: "input-group",
    render: () => (
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon style={u.icon} />
        </InputGroupAddon>
        <InputGroupInput placeholder="Find an element…" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>24</InputGroupText>
          <InputGroupButton title="Copy">
            <CopyIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    ),
  },
  {
    name: "popover",
    render: () => (
      <Popover>
        <DemoTrigger as={PopoverTrigger}>Open the panel</DemoTrigger>
        <PopoverContent>Positioned in CSS, dismissed on outside pointerdown.</PopoverContent>
      </Popover>
    ),
  },
  {
    name: "scroll-area",
    render: () => (
      <ScrollArea style={S.pgBox}>
        <div style={S.pgStack}>
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index}>Row {index + 1}</div>
          ))}
        </div>
      </ScrollArea>
    ),
  },
  {
    name: "separator",
    render: () => (
      <div style={S.pgStack}>
        <span>Above</span>
        <Separator />
        <div style={S.pgRow}>
          <span>Left</span>
          <Separator orientation="vertical" />
          <span>Right</span>
        </div>
      </div>
    ),
  },
  {
    name: "spinner",
    render: () => (
      <div style={S.pgRow}>
        <Spinner />
        <span style={u.muted}>Working…</span>
      </div>
    ),
  },
  {
    name: "switch",
    render: () => (
      <div style={S.pgRow}>
        <Switch defaultChecked />
        <Switch />
        <Switch disabled />
      </div>
    ),
  },
  {
    name: "tabs",
    render: () => (
      <Tabs defaultValue="code">
        <TabsList>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
        </TabsList>
        <TabsContent value="code">The source of the run.</TabsContent>
        <TabsContent value="output">Whatever it printed.</TabsContent>
      </Tabs>
    ),
  },
  {
    name: "textarea",
    render: () => <Textarea placeholder="Ask about this page…" rows={3} />,
  },
];

/** The AI Elements the chat shell itself renders. */
const surface: CatalogEntry[] = [
  {
    name: "code-block",
    render: () => (
      <CodeBlock code={SAMPLE_TS} language="ts" showLineNumbers>
        <CodeBlockHeader>
          <CodeBlockCopyButton />
        </CodeBlockHeader>
      </CodeBlock>
    ),
  },
  {
    name: "conversation",
    render: () => (
      <Conversation style={S.pgBox}>
        <ConversationContent>
          <ConversationEmptyState
            description="Ask about the current page, or anything else."
            icon={<BotIcon style={u.iconLg} />}
            title="agentak"
          />
        </ConversationContent>
      </Conversation>
    ),
  },
  {
    name: "markdown",
    path: "src/components/markdown.tsx",
    render: () => <Markdown>{SAMPLE_MD}</Markdown>,
  },
  {
    name: "message",
    render: () => (
      <div style={S.pgStack}>
        <Message from="user">
          <MessageContent>What does this page sell?</MessageContent>
        </Message>
        <Message from="assistant">
          <MessageContent>
            <MessageResponse>Two plans, **Pro** and **Team**.</MessageResponse>
            <MessageToolbar>
              <MessageActions>
                <MessageAction label="Copy">
                  <CopyIcon />
                </MessageAction>
              </MessageActions>
            </MessageToolbar>
          </MessageContent>
        </Message>
      </div>
    ),
  },
  {
    name: "prompt-input",
    render: () => (
      <PromptInput onSubmit={() => {}}>
        <PromptInputBody>
          <PromptInputTextarea placeholder="Ask about this page…" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit onStop={() => {}} />
        </PromptInputFooter>
      </PromptInput>
    ),
  },
  {
    name: "reasoning",
    render: () => (
      <Reasoning defaultOpen isStreaming={false}>
        <ReasoningTrigger />
        <ReasoningContent>
          The page has a pricing table, so read that before the footer.
        </ReasoningContent>
      </Reasoning>
    ),
  },
  {
    name: "shimmer",
    render: () => <Shimmer>Reading the page…</Shimmer>,
  },
  {
    name: "tool",
    render: () => (
      <Tool defaultOpen>
        <ToolHeader
          input={{ maxChars: 8000 }}
          state="output-available"
          toolName="read_page"
          type="dynamic-tool"
        />
        <ToolContent>
          <ToolInput input={{ maxChars: 8000 }} />
          <ToolOutput
            errorText={undefined}
            output={JSON.stringify({ title: "agentak", chars: 4821 }, null, 2)}
          />
        </ToolContent>
      </Tool>
    ),
  },
];

const SAMPLE_ANSI = [
  "[1m$[0m pnpm vitest run",
  "",
  "[32m ✓ [0msrc/lib/ansi.test.ts [2m(16 tests)[0m [2m 9ms[0m",
  "[31m ✗ [0msrc/markdown.test.tsx [2m(4 tests | [31m1 failed[2m)[0m",
  "",
  "[41;97;1m FAIL [0m heals an unclosed bold",
  "  [31mAssertionError[0m: expected [32m'**bold'[0m to be [32m'bold'[0m",
  "[38;5;208m⚠[0m one block is missing from the manifest",
  "",
  "[1;32mTest Files[0m  [32m9 passed[0m [2m|[0m [31m1 failed[0m",
  "[4mDuration[0m  [2m1.42s[0m [90m(transform 318ms)[0m",
].join("\n");

const CITED = [
  {
    title: "Using shadow DOM — MDN",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM",
    description: "A shadow root holds a scoped tree with its own stylesheet.",
    quote: "A shadow root is attached to an element and holds a separate DOM tree.",
  },
  {
    title: "Document.adoptedStyleSheets — MDN",
    url: "https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets",
    description: "Constructable stylesheets are shared between roots without copying the text.",
  },
];

const CATALOG_MODELS = [
  { id: "claude-opus-5", name: "Claude Opus 5", context: "1M" },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", context: "1M" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", context: "200K" },
];

/**
 * Ported elements the transcript cannot carry: each is compound and takes JSX,
 * where a `{ kind: "element" }` part carries plain data. Composed by hand here.
 */
const composed: CatalogEntry[] = [
  {
    name: "context",
    render: () => (
      <Context
        costs={{ input: 0.0489, output: 0.0618, reasoning: 0.0297, cache: 0.0288, total: 0.1692 }}
        defaultOpen
        maxTokens={200_000}
        modelId="claude-sonnet-5"
        usage={{
          inputTokens: 112_300,
          outputTokens: 4120,
          reasoningTokens: 1980,
          cachedInputTokens: 96_000,
          totalTokens: 118_400,
        }}
        usedTokens={118_400}
      />
    ),
  },
  {
    name: "inline-citation",
    render: () => (
      <InlineCitation>
        <InlineCitationText>
          Styles adopted by a shadow root do not reach the page.
        </InlineCitationText>
        <InlineCitationCard>
          <InlineCitationCardTrigger sources={CITED.map((source) => source.url)} />
          <InlineCitationCardBody>
            <InlineCitationCarousel>
              <InlineCitationCarouselHeader>
                <InlineCitationCarouselPrev />
                <InlineCitationCarouselNext />
                <InlineCitationCarouselIndex />
              </InlineCitationCarouselHeader>
              <InlineCitationCarouselContent>
                {CITED.map((source) => (
                  <InlineCitationCarouselItem key={source.url}>
                    <InlineCitationSource
                      description={source.description}
                      title={source.title}
                      url={source.url}
                    />
                    {source.quote ? (
                      <InlineCitationQuote>{source.quote}</InlineCitationQuote>
                    ) : undefined}
                  </InlineCitationCarouselItem>
                ))}
              </InlineCitationCarouselContent>
            </InlineCitationCarousel>
          </InlineCitationCardBody>
        </InlineCitationCard>
      </InlineCitation>
    ),
  },
  {
    name: "model-selector",
    render: () => (
      <ModelSelector defaultValue="claude-opus-5">
        <ModelSelectorTrigger>Claude Opus 5</ModelSelectorTrigger>
        <ModelSelectorContent>
          <ModelSelectorInput />
          <ModelSelectorList>
            <ModelSelectorEmpty />
            <ModelSelectorGroup heading="Anthropic">
              {CATALOG_MODELS.map((model) => (
                <ModelSelectorItem key={model.id} textValue={model.name} value={model.id}>
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                  <ModelSelectorShortcut>{model.context}</ModelSelectorShortcut>
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          </ModelSelectorList>
        </ModelSelectorContent>
      </ModelSelector>
    ),
  },
  {
    name: "open-in-chat",
    render: () => (
      <OpenIn query="How does a shadow root adopt a stylesheet?">
        <OpenInTrigger />
        <OpenInContent>
          <OpenInLabel>Open this prompt in</OpenInLabel>
          <OpenInClaude />
          <OpenInChatGPT />
          <OpenInT3 />
          <OpenInScira />
          <OpenInv0 />
          <OpenInCursor />
        </OpenInContent>
      </OpenIn>
    ),
  },
  {
    name: "terminal",
    render: () => <Terminal output={SAMPLE_ANSI} />,
  },
];

/**
 * The registered `{ kind: "element" }` renderers, driven by the same fixtures
 * the chat replays — a new element with a demo reply lands here on its own.
 */
const elements: CatalogEntry[] = [
  ...new Map(
    turns
      // The dictated prompt carries elements too, so both sides count.
      .flatMap((turn) => [
        ...(typeof turn.prompt === "string" ? [] : turn.prompt),
        ...turn.reply(0),
      ])
      .flatMap((part) =>
        part.kind === "element"
          ? [
              [
                part.name,
                { name: part.name, render: () => <Element name={part.name} props={part.props} /> },
              ] as const,
            ]
          : [],
      ),
  ).values(),
  ...composed,
].sort((a, b) => a.name.localeCompare(b.name));

export const CATALOG: CatalogSection[] = [
  {
    id: "primitives",
    title: "Primitives",
    note: "shadcn, rewritten in preact",
    dir: "src/components/ui",
    entries: primitives,
  },
  {
    id: "surface",
    title: "Chat surface",
    note: "what the chat surface renders",
    dir: "src/components/ai-elements",
    entries: surface,
  },
  {
    id: "elements",
    title: "Elements",
    note: "transcript parts, plus the compound ones composed by hand",
    dir: "src/components/ai-elements",
    entries: elements,
  },
];

export interface CatalogHit extends CatalogEntry {
  section: CatalogSection;
}

/** Every entry, flat, in catalog order — what the sidebar and the routes read. */
export const ENTRIES: CatalogHit[] = CATALOG.flatMap((section) =>
  section.entries.map((entry) => ({ ...entry, section })),
);

export function findEntry(name: string): CatalogHit | undefined {
  return ENTRIES.find((entry) => entry.name === name);
}

/** Previous and next in catalog order, for the pager on a component page. */
export function neighbours(name: string): { prev?: CatalogHit; next?: CatalogHit } {
  const index = ENTRIES.findIndex((entry) => entry.name === name);
  if (index < 0) return {};
  return { next: ENTRIES[index + 1], prev: ENTRIES[index - 1] };
}

/** Where the source sits. Most entries follow the section, a few say so. */
export function sourcePath(hit: CatalogHit): string {
  return hit.path ?? `${hit.section.dir}/${hit.name}.tsx`;
}

/** Case-insensitive name match — the one filter the sidebar and the grid share. */
export function matches(entry: CatalogEntry, query: string): boolean {
  return entry.name.toLowerCase().includes(query.trim().toLowerCase());
}
