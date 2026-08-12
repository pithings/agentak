/**
 * `css` is a tagged template and nothing else — it returns the rule text.
 *
 * Nothing that ships uses it — the library injects no stylesheet, and
 * `test/eject.test.ts` fails if a component grows a `*Styles` block again. What
 * is left are the playground and the catalog (`pg-` rules and a `@media`
 * query), which render a `<style>` of their own. That is why it lives here.
 */
export function css(strings: TemplateStringsArray, ...values: unknown[]): string {
  return String.raw({ raw: strings }, ...values);
}
