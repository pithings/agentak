// Docs: @docs/3.widget.md
// Docs: @docs/4.agents/2.pi/2.providers-and-models.md
import type { ChatKeyLock } from "../types.ts";
import { S, SettingsSection } from "./section.tsx";
import { Button } from "../../ui/button.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { LockIcon, UnlockIcon } from "../../../lib/icons.tsx";
import { sx } from "../../../styles/sx.ts";

/**
 * The device lock over the stored keys: one button, and a line saying what it
 * is doing. It reads next to the key because it is about that key and nothing
 * else on the page.
 */
export function SettingsLock({
  lock,
  onChange,
  onUnlock,
}: {
  lock: ChatKeyLock;
  /** Turn the lock on, or off again. Both open the device's own dialog. */
  onChange?: (on: boolean) => void;
  /** Ask the device for the key, for this visit. Pairs with a `locked` state. */
  onUnlock?: () => void;
}) {
  return (
    <SettingsSection title="Device lock">
      <div style={S.buttons}>
        {lock.state === "off" ? (
          <Button
            disabled={lock.busy}
            onClick={() => onChange?.(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <LockIcon />
            Lock keys to this device
          </Button>
        ) : lock.state === "locked" ? (
          <Button disabled={lock.busy} onClick={() => onUnlock?.()} size="sm" type="button">
            <UnlockIcon />
            Unlock
          </Button>
        ) : (
          <Button
            disabled={lock.busy}
            onClick={() => onChange?.(false)}
            size="sm"
            type="button"
            variant="outline"
          >
            <UnlockIcon />
            Turn the lock off
          </Button>
        )}
        {lock.busy && <Spinner />}
      </div>
      <p style={S.note}>
        {lock.state === "off"
          ? "Your keys are encrypted in this browser. Locking them keeps the key that opens them in this device’s own hardware, behind your fingerprint, face or PIN."
          : lock.state === "locked"
            ? "Your saved keys are locked. Unlocking them lasts until this page is closed; sending a message asks for them too."
            : "Unlocked until this page is closed. Turning the lock off puts the keys back behind this browser’s own key."}
      </p>
      {lock.error && <p style={sx(S.note, S.noteBad)}>{lock.error}</p>}
    </SettingsSection>
  );
}
