import type { RefCallback } from "preact";
import { useMemo } from "preact/hooks";

/**
 * `@keyframes` has no inline form — see `styles/base.ts` — so this is its
 * pure-JS replacement: `element.animate()` instead of a class naming a rule
 * in the sheet. A caller gets back a ref to attach to the element that should
 * play the animation:
 *
 * ```tsx
 * const spin = useAnimation(spinKeyframes, spinOptions);
 * return <LoaderIcon ref={spin} style={sx(u.icon, style)} />;
 * ```
 *
 * `frames` and `options` are only read again when their own identity changes,
 * so pass values stable across renders — a module-scope constant for a fixed
 * animation (`spinKeyframes`/`spinOptions` in `styles/base.ts`), or a
 * `useMemo` keyed on the primitives that actually vary (a per-instance delay,
 * a duration prop). A new object literal written inline in JSX would restart
 * the animation on every render.
 *
 * SSR-safe: a ref callback never runs on the server — Preact only invokes it
 * once a real element mounts in a browser (or jsdom). So the element must
 * already look right unanimated: keep the animation's resting frame (e.g.
 * `opacity: 1`, no `transform`) as the element's own static style, the same
 * way an implicit `0%`/`100%` keyframe used to fall back to the underlying
 * CSS.
 *
 * Cancellation rides Preact's ref-cleanup convention: returning a function
 * from the ref callback runs it before the next call and on unmount, so
 * there is no separate effect or `Animation` ref to manage by hand.
 *
 * Skips the animation, leaving the static resting style, when:
 * - the element has no `animate()` — jsdom does not implement it, and this
 *   keeps an unsupporting engine from crashing instead of degrading;
 * - `prefers-reduced-motion: reduce` is set. The CSS this replaces never
 *   checked this either, so this is new — an infinite WAAPI animation with
 *   no way to turn it off would be a fresh accessibility regression, not a
 *   preserved behaviour.
 */
export function useAnimation<T extends Element = HTMLElement>(
  frames: Keyframe[],
  options: number | KeyframeAnimationOptions,
): RefCallback<T> {
  return useMemo<RefCallback<T>>(() => animateOnMount<T>(frames, options), [frames, options]);
}

/**
 * The same ref callback, built outside a component. A renderer that emits an
 * unknown number of animated elements — `components/markdown.tsx` fading in
 * each word as it streams — cannot call a hook per element, so it holds one
 * module-scope callback made here instead. Every rule in `useAnimation()`
 * above applies unchanged.
 */
export function animateOnMount<T extends Element = HTMLElement>(
  frames: Keyframe[],
  options: number | KeyframeAnimationOptions,
): RefCallback<T> {
  return (node) => {
    if (!node) return;
    if (typeof node.animate !== "function") return; // jsdom, or an engine without WAAPI
    if (prefersReducedMotion()) return; // static is the accessible resting state

    const animation = node.animate(frames, options);
    return () => animation.cancel();
  };
}

/** Mirrors the `globalThis.matchMedia?.(...).matches ?? false` idiom already used in `catalog.tsx`. */
function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
