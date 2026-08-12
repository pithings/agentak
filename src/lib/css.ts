/**
 * `css` is a tagged template and nothing else — it returns the rule text.
 *
 * Nothing that ships uses it any more — the library injects no stylesheet, and
 * `render.test.tsx` fails if a component grows a `*Styles` block again. What is
 * left are the playground and the catalog (`pg-` rules and a `@media` query),
 * which are demo-only and render a `<style>` of their own.
 */
export function css(strings: TemplateStringsArray, ...values: unknown[]): string {
  return String.raw({ raw: strings }, ...values);
}
