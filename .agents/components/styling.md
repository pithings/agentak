# Styling

The library ships no component stylesheet. Use module-scope `Sx` objects and merge with
`sx()`. Direct component/`AgentChat` users install the exported `tokens` CSS;
`mountChat()` and wrappers inject it unless disabled. A missing custom property makes
`var()` invalid rather than falling back automatically.

```tsx
const S = { root: { minWidth: "0px" } } satisfies Record<string, Sx>;

function Item({ style, ...props }: WithSx<ComponentProps<"div">>) {
  return <div style={sx(reset.div, S.root, style)} {...props} />;
}
```

## Rules

- Use string values. Preact adds `px` to bare numbers.
- Destructure `style`; a later `{...props}` containing `style` silently replaces computed
  styles. Merge caller style last.
- Put reset presets first. `sx()` order is the cascade.
- Use tokens for spacing, color, and radius. Do not add component dark-mode branches.
- Inline `display` overrides the browser's `[hidden]` rule. When an element has both,
  explicitly set `display: "none"` from the same condition.
- Classes cannot override inline styles. Pass overrides through `style`.
- If a caller cannot render the primitive itself, reuse helpers such as `buttonSx()` or
  `controlSx()` rather than copying styles.
- Replace cross-element selectors and `:has()` with context plus `useInteraction` or a
  child-to-parent reporter.
- Use `useAnimation()`/Web Animations for keyframes. Keep frames and options referentially
  stable and honor reduced motion.
- Add `boxSizing: "border-box"` where fixed dimensions meet padding or borders; tests do
  not catch this.

Raw caller children receive no reset. Markdown children do. Stable host hooks are
`data-slot`, `data-variant`, `data-size`, and `data-state`, not classes.
