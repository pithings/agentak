// Docs: @docs/3.widget.md
import {
  Queue,
  QueueItem,
  QueueItemAction,
  QueueItemActions,
  QueueItemContent,
  QueueItemIndicator,
  QueueList,
  QueueSection,
  QueueSectionContent,
  QueueSectionLabel,
  QueueSectionTrigger,
} from "../ai-elements/queue.tsx";
import type { ChatQueueItem } from "./types.ts";
import { XIcon } from "../../lib/icons.tsx";
import type { Sx } from "../../styles/sx.ts";

const S = {
  queue: {
    padding: "0.75rem 0.75rem 0",
  },
} satisfies Record<string, Sx>;

export interface ChatQueueProps {
  /** Messages waiting behind the current turn. Empty, this renders nothing. */
  items: ChatQueueItem[];
  onDequeue?: (id: string) => void;
}

/** The messages typed while the agent was working, above the composer. */
export function ChatQueue({ items, onDequeue }: ChatQueueProps) {
  if (items.length === 0) return null;

  return (
    <div style={S.queue}>
      <Queue>
        <QueueSection>
          <QueueSectionTrigger>
            <QueueSectionLabel count={items.length} label="Queued" />
          </QueueSectionTrigger>
          <QueueSectionContent>
            <QueueList>
              {items.map((item) => (
                <QueueItem key={item.id}>
                  <QueueItemIndicator />
                  <QueueItemContent>{item.text}</QueueItemContent>
                  <QueueItemActions>
                    <QueueItemAction onClick={() => onDequeue?.(item.id)} title="Remove">
                      <XIcon />
                    </QueueItemAction>
                  </QueueItemActions>
                </QueueItem>
              ))}
            </QueueList>
          </QueueSectionContent>
        </QueueSection>
      </Queue>
    </div>
  );
}
