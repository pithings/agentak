/**
 * Playground fixtures for the interaction elements (confirmation, suggestion,
 * queue, commit). Each is compound, so a transcript part — which carries plain
 * data, never a VNode — cannot pass the children itself. These wrappers do it,
 * with static props and no-op callbacks.
 *
 * Demo only. Nothing here is part of the library surface. `checkpoint` is the
 * exception and ships in `components/elements.tsx` — the loop emits it.
 */
import {
  Commit,
  CommitActions,
  CommitAuthor,
  CommitAuthorAvatar,
  CommitContent,
  CommitCopyButton,
  CommitFile,
  CommitFileAdditions,
  CommitFileChanges,
  CommitFileDeletions,
  CommitFileIcon,
  CommitFileInfo,
  CommitFilePath,
  CommitFileStatus,
  type CommitFileStatusValue,
  CommitFiles,
  CommitHash,
  CommitHeader,
  CommitHeaderTrigger,
  CommitInfo,
  CommitMessage,
  CommitMetadata,
  CommitSeparator,
  CommitTimestamp,
} from "@/components/ai-elements/commit";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Queue,
  QueueItem,
  QueueItemActions,
  QueueItemAction,
  QueueItemContent,
  QueueItemDescription,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { XIcon } from "@/lib/icons";
import type { ToolApproval, ToolState } from "@/types";

export interface ConfirmationDemoProps {
  title: string;
  state: ToolState;
  approval: ToolApproval;
}

export const ConfirmationDemo = ({ title, state, approval }: ConfirmationDemoProps) => (
  <Confirmation approval={approval} state={state}>
    <ConfirmationTitle>{title}</ConfirmationTitle>
    <ConfirmationRequest>
      <ConfirmationActions>
        <ConfirmationAction variant="outline">Deny</ConfirmationAction>
        <ConfirmationAction>Allow</ConfirmationAction>
      </ConfirmationActions>
    </ConfirmationRequest>
    <ConfirmationAccepted>Allowed once.</ConfirmationAccepted>
    <ConfirmationRejected>Denied.</ConfirmationRejected>
  </Confirmation>
);

export interface SuggestionsDemoProps {
  suggestions: string[];
}

export const SuggestionsDemo = ({ suggestions }: SuggestionsDemoProps) => (
  <Suggestions>
    {suggestions.map((suggestion) => (
      <Suggestion key={suggestion} suggestion={suggestion} />
    ))}
  </Suggestions>
);

export interface QueueDemoProps {
  label: string;
  items: { id: string; title: string; description?: string; completed?: boolean }[];
}

export const QueueDemo = ({ label, items }: QueueDemoProps) => (
  <Queue>
    <QueueSection>
      <QueueSectionTrigger>
        <QueueSectionLabel count={items.length} label={label} />
      </QueueSectionTrigger>
      <QueueSectionContent>
        <QueueList>
          {items.map((item) => (
            <QueueItem key={item.id}>
              <QueueItemIndicator completed={item.completed} />
              <QueueItemContent completed={item.completed}>{item.title}</QueueItemContent>
              {item.description && (
                <QueueItemDescription completed={item.completed}>
                  {item.description}
                </QueueItemDescription>
              )}
              <QueueItemActions>
                <QueueItemAction title="Remove">
                  <XIcon />
                </QueueItemAction>
              </QueueItemActions>
            </QueueItem>
          ))}
        </QueueList>
      </QueueSectionContent>
    </QueueSection>
  </Queue>
);

export interface CommitDemoProps {
  hash: string;
  message: string;
  author: string;
  initials: string;
  /** ISO string — a transcript carries plain data, so no `Date` crosses it. */
  date: string;
  files: {
    path: string;
    status: CommitFileStatusValue;
    additions?: number;
    deletions?: number;
  }[];
}

export const CommitDemo = ({ hash, message, author, initials, date, files }: CommitDemoProps) => (
  <Commit defaultOpen>
    <CommitHeader>
      <CommitHeaderTrigger>
        <CommitAuthor>
          <CommitAuthorAvatar initials={initials} />
        </CommitAuthor>
        <CommitInfo>
          <CommitMessage>{message}</CommitMessage>
          <CommitMetadata>
            <CommitHash>{hash}</CommitHash>
            <CommitSeparator />
            <span>{author}</span>
            <CommitSeparator />
            <CommitTimestamp date={new Date(date)} />
          </CommitMetadata>
        </CommitInfo>
      </CommitHeaderTrigger>
      <CommitActions>
        <CommitCopyButton hash={hash} title="Copy the hash" />
      </CommitActions>
    </CommitHeader>
    <CommitContent>
      <CommitFiles>
        {files.map((file) => (
          <CommitFile key={file.path}>
            <CommitFileInfo>
              <CommitFileStatus status={file.status} />
              <CommitFileIcon />
              <CommitFilePath>{file.path}</CommitFilePath>
            </CommitFileInfo>
            <CommitFileChanges>
              <CommitFileAdditions count={file.additions ?? 0} />
              <CommitFileDeletions count={file.deletions ?? 0} />
            </CommitFileChanges>
          </CommitFile>
        ))}
      </CommitFiles>
    </CommitContent>
  </Commit>
);
