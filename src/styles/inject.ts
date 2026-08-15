import { tokens } from "./base.ts";

const MARK = "data-agentak-tokens";

/**
 * Declare the `--*` tokens on the page, once.
 *
 * The library injects nothing on its own — a host mounting `AgentChat` puts
 * `tokens` in a `<style>` itself. The framework wrappers call this instead, so
 * that a drop-in component needs no setup line beside it.
 *
 * It goes FIRST in the head, not last. The names are shadcn's, unprefixed: a
 * page that already carries a shadcn or tailwind theme declares the same ones,
 * and a sheet appended after that theme would repoint the whole page. Prepended,
 * it loses every name the page defines for itself and holds only the rest —
 * which is what a page with no theme needs, and all the widget ever wanted.
 *
 * Idempotent, and never removed: a second chat on the page reads the same tokens
 * as the first, so the last one to unmount must not take them away.
 */
export function injectTokens(doc: Document = document): void {
  if (!doc.head || doc.querySelector(`style[${MARK}]`)) return;
  const style = doc.createElement("style");
  style.setAttribute(MARK, "");
  style.textContent = tokens;
  doc.head.prepend(style);
}
