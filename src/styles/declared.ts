/**
 * Does the sheet select this class?
 *
 * Test-only, and deliberately not imported by any component, so it never
 * reaches a bundle.
 *
 * A plain `sheet.includes(".wa-tool")` is wrong: `.wa-tool-content` contains it
 * as a substring, so a dead class looks alive as long as some longer rule shares
 * its prefix. That hid `wa-avatar`, `wa-model-selector` and `wa-sandbox` for
 * several rounds of this migration, and worse, it pushed one agent into writing
 * a rule for a class rather than deleting the class.
 *
 * A class name ends where `[\w-]` stops, so the check is the name followed by
 * anything that cannot continue it.
 */
export function declares(sheet: string, name: string): boolean {
  return new RegExp(`\\.${name}(?![\\w-])`).test(sheet);
}
