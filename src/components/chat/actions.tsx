// Docs: @docs/3.widget.md
import type { ChatAction, ChatIcon } from "./types.ts";
import { Button } from "../ui/button.tsx";
import { CHAT_ICONS, PathIcon } from "../../lib/icons.tsx";

/**
 * The picture on a host's button, from the name or the geometry it gave.
 *
 * A function the caller calls, and not a component it renders: `Button` sizes
 * the icons among its children by their type, so the child has to be the icon
 * itself. A wrapper around one is not an icon to it, and the glyph would draw at
 * its own 24px beside 16px buttons.
 */
function actionIcon(icon: ChatIcon) {
  if (typeof icon === "string") {
    const Glyph = CHAT_ICONS[icon];
    return Glyph ? <Glyph /> : null;
  }
  return <PathIcon paths={icon.paths} />;
}

/**
 * A host's own controls, drawn from definitions.
 *
 * The size is the chat's and not the host's: an icon alone is the icon button
 * the bar's other buttons are, and words make it the same short button the tool
 * gate is. A host says what its control is and does; how it is drawn is the
 * surface's, so host chrome does not read as something pasted onto it.
 */
export function ChatActions({ actions }: { actions?: ChatAction[] }) {
  if (!actions || actions.length === 0) return null;

  return (
    <>
      {actions.map((action) => (
        <Button
          aria-label={action.label}
          aria-pressed={action.pressed}
          disabled={action.disabled}
          key={action.id}
          onClick={action.onClick}
          size={action.icon && !action.text ? "icon-sm" : "xs"}
          title={action.label}
          // The bar sits in the composer's form: a bare button would submit it.
          type="button"
          variant={action.variant ?? "ghost"}
        >
          {action.icon ? actionIcon(action.icon) : null}
          {action.text ?? (action.icon ? null : action.label)}
        </Button>
      ))}
    </>
  );
}
