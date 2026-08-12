/**
 * `css` is a tagged template and nothing else — it returns the rule text.
 *
 * A module exports its block; `styles/sheet.tsx` lists every block in one
 * explicit order. Registering into a module-global array on import instead
 * would make the sheet depend on evaluation order, which differs between a
 * server bundle and a client bundle, and would make `sideEffects: false` in
 * package.json a lie.
 */
export function css(strings: TemplateStringsArray, ...values: unknown[]): string {
  return String.raw({ raw: strings }, ...values);
}
