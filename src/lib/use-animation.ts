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
export function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * A device that should not pay for an animation of many elements at once —
 * the per-word fade in `components/markdown.tsx`, whose cost is the spans it
 * needs as much as the animation itself. A caller checks this *before* it
 * builds those elements; one animated element is cheap everywhere, and does
 * not ask.
 *
 * The hints are what the browser gives away for free — no benchmark, no probe:
 * `deviceMemory` (chromium only, in GB, and capped at 8) and
 * `hardwareConcurrency`. Neither is reported by every engine, so a coarse
 * pointer on a narrow screen answers for the rest: a phone is treated as low
 * power whatever it claims, since its GPU is also driving the tallest DPI.
 *
 * Deliberately not cached. Hardware does not change mid-session, but the two
 * property reads cost nothing next to a render, and a test can then stub them.
 */
export function isLowPowerDevice(): boolean {
  const agent = globalThis.navigator as (Navigator & { deviceMemory?: number }) | undefined;
  if (!agent) return true; // no DOM — a server render animates nothing anyway

  if (agent.deviceMemory !== undefined && agent.deviceMemory <= 4) return true;
  if (agent.hardwareConcurrency !== undefined && agent.hardwareConcurrency <= 4) return true;
  return globalThis.matchMedia?.("(pointer: coarse) and (max-width: 820px)").matches ?? false;
}
