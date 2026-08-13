import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { createWebAgent, SYSTEM_PROMPT } from "@/agent/create-agent";
import { DEFAULT_PROVIDER_ID, findModel } from "@/agent/models";
import { findProvider, type Provider, PROVIDERS } from "@/agent/providers";
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
import { AgentChat } from "@/components/agent-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ExternalLinkIcon } from "@/lib/icons";
import { u } from "@/styles/base";
import { sx, type Sx } from "@/styles/sx";

const S = {
  gate: {
    boxSizing: "border-box",
    display: "flex",
    minHeight: "0",
    flexDirection: "column",
    justifyContent: "center",
    gap: "0.75rem",
    background: "var(--wa-background)",
    padding: "1.5rem",
    color: "var(--wa-foreground)",
    fontFamily: "var(--wa-font-sans)",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    overflowY: "auto",
  },
  gateTitle: {
    fontSize: "0.9375rem",
    fontWeight: "600",
  },
  gateLabel: {
    fontSize: "0.75rem",
    fontWeight: "500",
  },
  gateProviders: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.375rem",
  },
  gateRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  gateLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    color: "var(--wa-muted-foreground)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

export interface WebAgentProps {
  className?: string;
  /** Merged over the chat's own box — how a host sizes the element. */
  style?: Sx;
  /**
   * A key for the current provider, or one per provider id. Without one the
   * surface asks and keeps it in `localStorage`; the extension will pass one
   * from `chrome.storage` instead. A free provider asks for none.
   */
  apiKey?: string | Record<string, string>;
  /** Which provider to open on. Default: the stored one, or LLM7. */
  provider?: string;
}

/** Keys already in hand: what a host passed, over what the browser stored. */
function seedKeys(apiKey: WebAgentProps["apiKey"], providerId: string): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const provider of PROVIDERS) {
    const stored = storedApiKey(provider.id);
    if (stored) keys[provider.id] = stored;
  }
  if (typeof apiKey === "string") keys[providerId] = apiKey;
  else if (apiKey) Object.assign(keys, apiKey);
  return keys;
}

/**
 * Top-level container: the key gate, then the loop — pi's `Agent` over the page
 * tools — driving `AgentChat`.
 */
export function WebAgent({ className, style, apiKey, provider: openOn }: WebAgentProps) {
  const [providerId, setProviderId] = useState(
    () => openOn ?? storedProviderId() ?? DEFAULT_PROVIDER_ID,
  );
  const [keys, setKeys] = useState(() => seedKeys(apiKey, providerId));
  const [editing, setEditing] = useState(false);

  // Keys are read through a ref, so adding one does not rebuild the agent and
  // lose the transcript. pi asks per provider, which is the id it passes here.
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const [runtime] = useState(() =>
    createWebAgent({ apiKey: (provider) => keysRef.current[provider] }),
  );

  const chat = useAgent(runtime);
  const catalog = useCatalog(providerId);
  const provider = findProvider(providerId) ?? PROVIDERS[0];
  const { setModel } = chat;
  const modelProvider = chat.model.provider;

  // Follow the provider: the model last used with it, else the one it suggests.
  useEffect(() => {
    if (catalog.models.length === 0 || modelProvider === providerId) return;
    const next =
      findModel(catalog.models, storedModelId(providerId)) ??
      findModel(catalog.models, provider.defaultModelId) ??
      catalog.models[0];
    if (next) setModel(next);
  }, [catalog.models, modelProvider, provider, providerId, setModel]);

  const onModelChange = useCallback(
    (id: string) => {
      const next = findModel(catalog.models, id);
      if (!next) return;
      setModel(next);
      storeModelId(providerId, id);
    },
    [catalog.models, providerId, setModel],
  );

  const onSelectProvider = useCallback((id: string) => {
    setProviderId(id);
    storeProviderId(id);
  }, []);

  const agent = useMemo(
    () => ({
      name: runtime.name,
      model: chat.model.name,
      instructions: SYSTEM_PROMPT,
      tools: runtime.agent.state.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
      })),
    }),
    [chat.model, runtime],
  );

  // A catalog is a chunk: until it lands the agent still holds the last
  // provider's model, and a message sent now would go to the wrong place.
  if (modelProvider !== providerId && catalog.loading) {
    return (
      <div className={className} style={sx(S.gate, style)}>
        <div style={S.gateRow}>
          <Spinner />
          <span style={u.muted}>Loading the {provider.label} models…</span>
        </div>
      </div>
    );
  }

  if ((!keys[providerId] && !provider.free) || editing) {
    return (
      <Settings
        className={className}
        keys={keys}
        onSave={(key) => {
          setKeys({ ...keys, [providerId]: key });
          storeApiKey(providerId, key);
          setEditing(false);
        }}
        onSelectProvider={onSelectProvider}
        provider={provider}
        style={style}
      />
    );
  }

  return (
    <AgentChat
      agent={agent}
      className={className}
      error={chat.error ?? catalog.error}
      isStreaming={chat.isStreaming}
      messages={chat.messages}
      modelId={chat.model.id}
      models={catalog.models}
      onDequeue={chat.dequeue}
      onEditKey={() => setEditing(true)}
      onModelChange={onModelChange}
      onReset={chat.reset}
      onRespond={chat.respond}
      onSend={chat.send}
      onStop={chat.stop}
      providerLabel={provider.label}
      queued={chat.queued}
      style={style}
      usage={chat.usage}
    />
  );
}

interface SettingsProps {
  provider: Provider;
  keys: Record<string, string>;
  onSelectProvider: (id: string) => void;
  onSave: (key: string) => void;
  className?: string;
  style?: Sx;
}

/**
 * Provider and key.
 *
 * The key goes straight from this page to the provider — every one listed
 * allows that — and is kept in this browser. A provider already set up keeps
 * its key, so switching back asks nothing. A free provider asks for nothing at
 * all; there the form only says what the limit is.
 */
function Settings({ provider, keys, onSelectProvider, onSave, className, style }: SettingsProps) {
  const [draft, setDraft] = useState(keys[provider.id] ?? "");

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (provider.free) onSave("unused");
        else if (draft.trim()) onSave(draft.trim());
      }}
      style={sx(S.gate, style)}
    >
      <span style={S.gateTitle}>Provider</span>
      <div style={S.gateProviders}>
        {PROVIDERS.map((entry) => (
          <Button
            key={entry.id}
            onClick={() => {
              onSelectProvider(entry.id);
              setDraft(keys[entry.id] ?? "");
            }}
            size="sm"
            title={
              entry.free
                ? `Free — ${entry.note}`
                : entry.gateway
                  ? "Gateway — one key, many vendors"
                  : entry.label
            }
            type="button"
            variant={entry.id === provider.id ? "default" : "outline"}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      {provider.free ? (
        <>
          <span style={S.gateLabel}>{provider.label} needs no key</span>
          <div style={S.gateRow}>
            <Button type="submit">Start</Button>
          </div>
          <p style={u.muted}>Free, rate limited by IP address: {provider.note}</p>
        </>
      ) : (
        <>
          <span style={S.gateLabel}>{provider.label} API key</span>
          <div style={S.gateRow}>
            <Input
              autoComplete="off"
              onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
              placeholder={provider.keyPlaceholder}
              type="password"
              value={draft}
            />
            <Button type="submit">Save</Button>
          </div>
          <a href={provider.keyUrl} rel="noreferrer noopener" style={S.gateLink} target="_blank">
            Get a key
            <ExternalLinkIcon style={u.icon} />
          </a>
          <p style={u.muted}>Kept in this browser, and sent only to the provider you pick.</p>
        </>
      )}
    </form>
  );
}
