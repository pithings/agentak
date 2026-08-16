/**
 * Playground fixtures for the panel elements (sandbox, artifact, web-preview).
 * Each is compound, so a transcript part — which carries plain data, never a
 * VNode — cannot pass the children itself. These wrappers do it.
 *
 * Demo only. Nothing here is part of the library surface.
 */
import { u } from "@/styles/base.ts";
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/_parked/ai-elements/artifact.tsx";
import { CodeBlock, type CodeLanguage } from "@/components/ai-elements/code-block.tsx";
import {
  Sandbox,
  SandboxContent,
  SandboxHeader,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
} from "@/components/_parked/ai-elements/sandbox.tsx";
import {
  WebPreview,
  WebPreviewBody,
  WebPreviewConsole,
  WebPreviewNavigation,
  WebPreviewNavigationButton,
  WebPreviewUrl,
} from "@/components/_parked/ai-elements/web-preview.tsx";
import { CopyIcon, DownloadIcon, RotateCcwIcon } from "@/lib/icons.tsx";
import type { ToolState } from "@/types.ts";

export interface SandboxDemoProps {
  title: string;
  state: ToolState;
  tabs: { value: string; label: string; code: string; language: CodeLanguage }[];
}

export const SandboxDemo = ({ title, state, tabs }: SandboxDemoProps) => (
  <Sandbox>
    <SandboxHeader state={state} title={title} />
    <SandboxContent>
      <SandboxTabs defaultValue={tabs[0]?.value}>
        <SandboxTabsBar>
          <SandboxTabsList>
            {tabs.map((tab) => (
              <SandboxTabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </SandboxTabsTrigger>
            ))}
          </SandboxTabsList>
        </SandboxTabsBar>
        {tabs.map((tab) => (
          <SandboxTabContent key={tab.value} value={tab.value}>
            <CodeBlock code={tab.code} language={tab.language} />
          </SandboxTabContent>
        ))}
      </SandboxTabs>
    </SandboxContent>
  </Sandbox>
);

export interface ArtifactDemoProps {
  title: string;
  description?: string;
  body: string;
}

export const ArtifactDemo = ({ title, description, body }: ArtifactDemoProps) => (
  <Artifact>
    <ArtifactHeader>
      <div>
        <ArtifactTitle>{title}</ArtifactTitle>
        {description && <ArtifactDescription>{description}</ArtifactDescription>}
      </div>
      <ArtifactActions>
        <ArtifactAction icon={CopyIcon} tooltip="Copy" />
        <ArtifactAction icon={DownloadIcon} tooltip="Download" />
      </ArtifactActions>
    </ArtifactHeader>
    <ArtifactContent>{body}</ArtifactContent>
  </Artifact>
);

export interface WebPreviewDemoProps {
  url: string;
  /** ISO strings, because a transcript carries no `Date`. */
  logs?: { level: "log" | "warn" | "error"; message: string; at: string }[];
}

export const WebPreviewDemo = ({ url, logs = [] }: WebPreviewDemoProps) => (
  // The preview fills its parent, so the demo gives it a height.
  <WebPreview defaultUrl={url} style={{ height: "22rem" }}>
    <WebPreviewNavigation>
      {/* The address is read-only here — the transcript has no history to go back to. */}
      <WebPreviewUrl>
        <WebPreviewNavigationButton size="icon-xs" tooltip="Reload">
          <RotateCcwIcon style={u.icon} />
        </WebPreviewNavigationButton>
      </WebPreviewUrl>
    </WebPreviewNavigation>
    <WebPreviewBody />
    <WebPreviewConsole
      logs={logs.map((log) => ({
        level: log.level,
        message: log.message,
        timestamp: new Date(log.at),
      }))}
    />
  </WebPreview>
);
