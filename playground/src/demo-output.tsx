import {
  FileTree,
  FileTreeFile,
  FileTreeFolder,
} from "@/components/_parked/ai-elements/file-tree.tsx";
import {
  Snippet,
  SnippetAddon,
  SnippetCopyButton,
  SnippetInput,
  SnippetText,
} from "@/components/_parked/ai-elements/snippet.tsx";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/_parked/ai-elements/sources.tsx";

/**
 * Data-driven wrappers for the tool-output elements, matching
 * `demo-progress.tsx`, `demo-panels.tsx` and `demo-interaction.tsx`. A
 * transcript part carries plain data, never JSX, so a compound element needs
 * one of these to build its children.
 */

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
}

const TreeNodes = ({ nodes }: { nodes: TreeNode[] }) => (
  <>
    {nodes.map((node) =>
      node.children ? (
        <FileTreeFolder key={node.path} name={node.name} path={node.path}>
          <TreeNodes nodes={node.children} />
        </FileTreeFolder>
      ) : (
        <FileTreeFile key={node.path} name={node.name} path={node.path} />
      ),
    )}
  </>
);

export const FileTreeDemo = ({
  nodes,
  expanded,
  selected,
}: {
  nodes: TreeNode[];
  expanded?: string[];
  selected?: string;
}) => (
  <FileTree defaultExpanded={new Set(expanded)} selectedPath={selected}>
    <TreeNodes nodes={nodes} />
  </FileTree>
);

export const SourcesDemo = ({ sources }: { sources: { href: string; title: string }[] }) => (
  <Sources defaultOpen>
    <SourcesTrigger count={sources.length} />
    <SourcesContent>
      {sources.map((source) => (
        <Source href={source.href} key={source.href} title={source.title} />
      ))}
    </SourcesContent>
  </Sources>
);

export const SnippetDemo = ({ code, label }: { code: string; label?: string }) => (
  <Snippet code={code}>
    {label && (
      <SnippetAddon>
        <SnippetText>{label}</SnippetText>
      </SnippetAddon>
    )}
    <SnippetInput />
    <SnippetAddon align="inline-end">
      <SnippetCopyButton />
    </SnippetAddon>
  </Snippet>
);
