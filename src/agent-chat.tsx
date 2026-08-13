import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { createAgent, SYSTEM_PROMPT } from "@/agent/create-agent";
import { findModel } from "@/agent/models";
import { availableProviders, findProvider, type Provider } from "@/agent/providers";
import {
  storeApiKey,
  storedApiKey,
  storedModelId,
  storedProviderId,
  storeModelId,
  storeProviderId,
} from "@/agent/storage";
import { useTitle } from "@/agent/title";
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
   * Name the conversation with the model, instead of with the first message.
   * Off by default: it is one extra request, once, after the first answer.
   * `<agent-chat>` takes it as the `generate-title` attribute.
   */
  generateTitle?: boolean;
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
function seedKeys(
  providers: Provider[],
  apiKey: AgentChatProps["apiKey"],
  providerId?: string,
): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const provider of providers) {
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
  generateTitle,
  actions,
  emptyActions,
}: AgentChatProps) {
  const wanted = openOn ?? storedProviderId();
  // Where the surface runs decides the list: a page drops the providers that
  // answer no preflight. Fixed for the life of the surface.
  const [available] = useState(availableProviders);
  const [keys, setKeys] = useState(() => seedKeys(available, apiKey, wanted));
  // Nothing is chosen on a fresh surface: no provider, and so no model. One
  // that cannot answer counts as none — a stored key may have been dropped, a
  // host may name a provider it passed no key for, and one stored in the panel
  // is out of reach on a page.
  const [providerId, setProviderId] = useState(() => {
    const entry = available.find((provider) => provider.id === wanted);
    return entry && (entry.free || keys[entry.id]) ? entry.id : undefined;
  });
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

  // The header names the conversation from the first message; with
  // `generateTitle` the model names it instead, once the first answer lands.
  // The key follows the loop's rule — a free provider needs none, but the
  // openai client wants a string.
  const title = useTitle({
    apiKey: providerId ? (keys[providerId] ?? (provider?.free ? "unused" : undefined)) : undefined,
    generate: generateTitle,
    isStreaming: chat.isStreaming,
    messages: chat.messages,
    model: ready ? chat.model : undefined,
  });

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
      available.map((entry) => ({
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
    [available, keys],
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
      title={title}
      usage={ready ? chat.usage : undefined}
    />
  );
}
