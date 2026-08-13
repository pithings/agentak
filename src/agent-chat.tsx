import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { createAgent, SYSTEM_PROMPT } from "@/agent/create-agent";
import { findModel } from "@/agent/models";
import { findProvider, PROVIDERS } from "@/agent/providers";
import {
  storeApiKey,
  storedApiKey,
  storedModelId,
  storedProviderId,
  storeModelId,
  storeProviderId,
} from "@/agent/storage";
import { useAgent } from "@/agent/use-agent";
import { useCatalog } from "@/agent/use-catalog";
import { Chat } from "@/components/chat";
import type { Sx } from "@/styles/sx";

export interface AgentChatProps {
  className?: string;
  /** Merged over the chat's own box — how a host sizes the element. */
  style?: Sx;
  /**
   * A key for the provider named by `provider`, or one per provider id. Without
   * one the picker asks, and keeps what it is given in `localStorage`; the
   * extension will pass one from `chrome.storage` instead. A free provider asks
   * for none.
   */
  apiKey?: string | Record<string, string>;
  /**
   * Which provider to open on. Default: the one this browser stored, or none —
   * a fresh surface chooses nothing, and the picker asks with the first message.
   */
  provider?: string;
  /**
   * Host buttons for the end of the header. `<agent-chat>` fills this with a
   * `<slot name="actions">`, so a page can put its own chrome — minimise, and
   * whatever else it owns — on the agent's one title bar.
   */
  actions?: ComponentChildren;
  /**
   * Host content for the chat's empty state — a suggestion, a launcher.
   * `<agent-chat>` fills this with a `<slot name="empty">`. It shows only before
   * the first message.
   */
  emptyActions?: ComponentChildren;
}

/** Keys already in hand: what a host passed, over what the browser stored. */
function seedKeys(apiKey: AgentChatProps["apiKey"], providerId?: string): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const provider of PROVIDERS) {
    const stored = storedApiKey(provider.id);
    if (stored) keys[provider.id] = stored;
  }
  if (typeof apiKey === "string" && providerId) keys[providerId] = apiKey;
  else if (apiKey) Object.assign(keys, apiKey);
  return keys;
}

/**
 * Top-level container: the loop — pi's `Agent` over the page tools — driving
 * `Chat`. There is no key screen in front of it. Provider, model and key
 * are all the composer's picker, so the chat is the only view the surface has.
 */
export function AgentChat({
  className,
  style,
  apiKey,
  provider: openOn,
  actions,
  emptyActions,
}: AgentChatProps) {
  const wanted = openOn ?? storedProviderId();
  const [keys, setKeys] = useState(() => seedKeys(apiKey, wanted));
  // Nothing is chosen on a fresh surface: no provider, and so no model. One
  // that cannot answer counts as none — a stored key may have been dropped, or
  // a host may name a provider it passed no key for.
  const [providerId, setProviderId] = useState(() =>
    wanted && (findProvider(wanted)?.free || keys[wanted]) ? wanted : undefined,
  );
  // Typed before a provider was chosen. It goes as soon as one can answer.
  const [pending, setPending] = useState("");
  const [asking, setAsking] = useState(false);

  // Keys are read through a ref, so adding one does not rebuild the agent and
  // lose the transcript. pi asks per provider, which is the id it passes here.
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const [runtime] = useState(() =>
    createAgent({ apiKey: (provider) => keysRef.current[provider] }),
  );

  const chat = useAgent(runtime);
  const catalog = useCatalog(providerId);
  const provider = findProvider(providerId);
  const { send, setModel } = chat;
  const modelProvider = chat.model.provider;
  // The loop is built on a model of its own, so "chosen" is the provider's own
  // model in hand — not whatever the agent happens to hold.
  const ready = Boolean(providerId) && modelProvider === providerId;

  // Follow the provider, but only as far as this browser has been: the model
  // it last used with it. A provider chosen for the first time ends on its
  // model list, because nothing here picks a model for anyone.
  useEffect(() => {
    if (!provider || catalog.models.length === 0 || modelProvider === providerId) return;
    const next = findModel(catalog.models, storedModelId(provider.id));
    if (next) setModel(next);
  }, [catalog.models, modelProvider, provider, providerId, setModel]);

  // The question is the menu itself: a first message with nothing chosen opens
  // it and waits, rather than answering from a provider nobody picked.
  const onSend = useCallback(
    (text: string) => {
      if (ready) {
        send(text);
        return;
      }
      setPending(text);
      setAsking(true);
    },
    [ready, send],
  );

  useEffect(() => {
    if (!pending || !ready) return;
    send(pending);
    setPending("");
  }, [pending, ready, send]);

  const onModelChange = useCallback(
    (id: string) => {
      const next = findModel(catalog.models, id);
      if (!next || !providerId) return;
      setModel(next);
      storeModelId(providerId, id);
    },
    [catalog.models, providerId, setModel],
  );

  const onSelectProvider = useCallback((id: string) => {
    setProviderId(id);
    storeProviderId(id);
  }, []);

  const onSaveKey = useCallback((id: string, key: string) => {
    setKeys((current) => ({ ...current, [id]: key }));
    storeApiKey(id, key);
  }, []);

  // Provider, model and key are all one picker in the composer, so this is the
  // whole of what the surface knows about a provider. The picker asks for a key
  // before it hands a keyed provider back, so `providerId` can always answer.
  const providers = useMemo(
    () =>
      PROVIDERS.map((entry) => ({
        hasKey: Boolean(keys[entry.id]),
        id: entry.id,
        keyed: !entry.free,
        keyPlaceholder: entry.keyPlaceholder,
        keyUrl: entry.keyUrl,
        label: entry.label,
        note: entry.free
          ? `Free — ${entry.note}`
          : entry.gateway
            ? "Gateway — one key, many vendors"
            : undefined,
      })),
    [keys],
  );

  const agent = useMemo(
    () => ({
      name: runtime.name,
      model: ready ? chat.model.name : undefined,
      instructions: SYSTEM_PROMPT,
      tools: runtime.agent.state.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
      })),
    }),
    [chat.model, ready, runtime],
  );

  return (
    <Chat
      actions={actions}
      agent={agent}
      className={className}
      emptyActions={emptyActions}
      error={chat.error ?? catalog.error}
      isStreaming={chat.isStreaming}
      messages={chat.messages}
      modelId={ready ? chat.model.id : undefined}
      models={catalog.models}
      modelsLoading={catalog.loading}
      onDequeue={chat.dequeue}
      onModelChange={onModelChange}
      onPickerOpenChange={setAsking}
      onProviderChange={onSelectProvider}
      onReset={chat.reset}
      onRespond={chat.respond}
      onSaveKey={onSaveKey}
      onSend={onSend}
      onStop={chat.stop}
      pickerOpen={asking}
      providerId={providerId}
      providers={providers}
      queued={chat.queued}
      style={style}
      usage={ready ? chat.usage : undefined}
    />
  );
}
