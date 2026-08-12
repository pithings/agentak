// A preact `className` prop may arrive as a signal, which stringifies to its
// value — the same flattening clsx did before.
export type ClassValue = string | false | null | undefined | { toString: () => string };

/** Join class names. Falsy entries drop out; an empty result drops the attribute. */
export function cn(...inputs: ClassValue[]): string | undefined {
  return inputs.filter(Boolean).join(" ") || undefined;
}
