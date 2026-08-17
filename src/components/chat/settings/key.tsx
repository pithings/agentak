// Docs: @docs/3.widget.md
import { useEffect, useRef, useState } from "preact/hooks";

import type { ChatProvider } from "../types.ts";
import { noZoom, S, SettingsSection } from "./section.tsx";
import { Button } from "../../ui/button.tsx";
import { Input } from "../../ui/input.tsx";
import { ExternalLinkIcon, KeyIcon, TrashIcon, UnlockIcon } from "../../../lib/icons.tsx";
import { u } from "../../../styles/base.ts";
import type { Sx } from "../../../styles/sx.ts";

const K = {
  keyLink: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    gap: "0.25rem",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

export interface SettingsKeyProps {
  /** The keyed provider the page is about. */
  target: ChatProvider;
  /**
   * The field is open: a provider was picked that cannot run without a key, or
   * one already set up is having its key replaced.
   */
  editing?: boolean;
  /** The device lock is working — the unlock button waits on it. */
  busy?: boolean;
  /** Open the field over a key that is already stored. */
  onEdit: () => void;
  onSave: (key: string) => void;
  /** Without it a stored key can only be replaced, so no remove button is shown. */
  onForget?: () => void;
  onUnlock?: () => void;
}

/**
 * The one thing a keyed provider needs, in the state it is in: a field to type
 * one into, the two things to do with one already stored, or the unlock a
 * locked one asks for first.
 */
export function SettingsKey({
  busy,
  editing,
  onEdit,
  onForget,
  onSave,
  onUnlock,
  target,
}: SettingsKeyProps) {
  const [draft, setDraft] = useState("");

  // A key is already stored and nothing has asked to replace it: there is
  // nothing to type, so the section is one button rather than an empty field.
  const stored = Boolean(target.hasKey) && !editing;
  // The stored key is there and shut. Nothing can be done with it but unlock,
  // so that is what the section offers — with the field one click away, because
  // a passkey that is gone leaves typing another key as the only way back.
  const shut = stored && Boolean(target.locked);

  // A field that was asked for takes the focus, phone or not: it is reached by a
  // tap on a provider that needs a key, or on "Change key", and it is the only
  // thing this section is then for. A page that merely opens on one takes no
  // focus, since nothing was tapped to get here. Preact forwards no ref through
  // a component, so the field is read off the section.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (editing) ref.current?.querySelector("input")?.focus();
  }, [editing]);

  const save = () => {
    const key = draft.trim();
    if (!key) return;
    onSave(key);
    setDraft("");
  };

  return (
    <SettingsSection elementRef={ref} title={`${target.label} API key`}>
      {shut ? (
        <div style={S.buttons}>
          <Button disabled={busy} onClick={() => onUnlock?.()} size="sm" type="button">
            <UnlockIcon />
            Unlock
          </Button>
          <Button onClick={onEdit} size="sm" type="button" variant="ghost">
            <KeyIcon />
            Use another key
          </Button>
        </div>
      ) : stored ? (
        // The key itself is never shown — nothing reads one back out of storage
        // to fill a field with, and a row of dots says no more than the button
        // does. So the two things left to do with one are the whole of this row:
        // type another, or take it out.
        <div style={S.buttons}>
          <Button onClick={onEdit} size="sm" type="button" variant="outline">
            <KeyIcon />
            Change key
          </Button>
          {onForget && (
            <Button
              onClick={onForget}
              size="sm"
              title={`Remove the ${target.label} key`}
              type="button"
              variant="ghost"
            >
              <TrashIcon />
              Remove
            </Button>
          )}
        </div>
      ) : (
        <div style={S.buttons}>
          <Input
            autoComplete="off"
            onInput={(event) => setDraft((event.target as HTMLInputElement).value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              save();
            }}
            placeholder={target.keyPlaceholder}
            style={noZoom}
            type="password"
            value={draft}
          />
          <Button onClick={save} size="sm" type="button">
            Save
          </Button>
        </div>
      )}
      {shut && (
        <p style={S.note}>
          The saved key is locked to this device. Unlock it, or save another one.
        </p>
      )}
      {!stored && target.keyUrl && (
        <a href={target.keyUrl} rel="noreferrer noopener" style={K.keyLink} target="_blank">
          Get a key
          <ExternalLinkIcon style={u.icon} />
        </a>
      )}
      {!stored ? (
        <p style={S.note}>
          {target.hasKey
            ? "The new key replaces the one saved."
            : target.keyLost
              ? // A key is stored under this provider and nothing opens it — the
                // device lock it was sealed under is gone. An empty field with no
                // word for it reads as a key that was never saved.
                "The saved key was locked to a device this browser no longer has. Save another one."
              : "Kept in this browser, and sent only to the provider you pick."}
        </p>
      ) : shut ? null : onForget ? (
        // What removing it costs: a keyed provider answers nothing without one,
        // so it is a provider to set up again.
        <p style={S.note}>Removing the key stops {target.label} until another is saved.</p>
      ) : null}
    </SettingsSection>
  );
}
