import { computed, nextTick, onBeforeUnmount, onMounted, type Ref, ref, watchEffect } from "vue";

/**
 * Everything the reader does to the chat: opening it, minimising it, and which
 * of the two layouts it is in.
 *
 * The stylesheet owns the state the page is served in, so this only says what
 * the READER changed — see `chat-widget.css`.
 */
export function useChatShell(options: {
  button: Ref<HTMLButtonElement | undefined>;
  /** Fetches the chat, called the first time the reader opens it. */
  load: () => Promise<void>;
  panel: Ref<HTMLElement | undefined>;
}) {
  const { button, load, panel } = options;

  const open = ref(false);
  const wide = ref(false);
  const mounted = ref(false);

  /**
   * What the reader has done with the chat, and nothing before that: no class of
   * ours may describe the state the page was served in. Hydration therefore
   * changes no attribute the first paint set.
   */
  const state = computed(() =>
    mounted.value ? (open.value ? "is-open" : "is-closed") : undefined,
  );

  /**
   * Focus something a class change is about to reveal.
   *
   * Both states are held by the stylesheet, and a folded-away panel is
   * `visibility: hidden` — which takes no focus at all. So the element is asked
   * one frame after the class lands, when the style it is placed by has been
   * applied.
   */
  function focusLater(pick: () => HTMLElement | null | undefined) {
    // `preventScroll` because the page may still be on its way to an anchor: the
    // panel is fixed and already in view, so it needs no scrolling to reach.
    void nextTick(() => requestAnimationFrame(() => pick()?.focus({ preventScroll: true })));
  }

  /** The composer, by the name the library's own code reads it under. */
  const input = () => panel.value?.querySelector<HTMLTextAreaElement>('textarea[name="message"]');

  /**
   * The composer takes the focus whenever the chat opens — with the page on a
   * desktop, and on the button everywhere else. It is where a reader starts.
   *
   * A touch screen is the one exception: the focus would raise the virtual
   * keyboard over the transcript that has just opened.
   */
  function focusComposer() {
    if (globalThis.matchMedia?.("(pointer: coarse)").matches) return;
    focusLater(input);
  }

  function close() {
    // The chat is about to become `inert`, so a focus inside it would be dropped
    // on the document. The button it folds into takes it instead — and a reader
    // whose focus is out on the page keeps it where it is.
    const inside = panel.value?.contains(document.activeElement);
    open.value = false;
    if (inside) focusLater(() => button.value);
  }

  /** Opening the chat is asking to say something, so the composer is ready for it. */
  async function toggle() {
    open.value = !open.value;
    if (!open.value) return;
    await load();
    focusComposer();
  }

  /**
   * The page holds still under the sheet.
   *
   * The sheet covers the screen, so the document behind it must not scroll: the
   * chat contains its own scroll chain, but a drag on any part of it that does
   * not scroll would otherwise move the page under a panel that hides it. The
   * rail takes room rather than covering the page, so it leaves the scroll alone.
   */
  watchEffect((onCleanup) => {
    if (!open.value || wide.value) return;
    const { style } = document.documentElement;
    const before = { overflow: style.overflow, overscroll: style.overscrollBehavior };
    style.overflow = "hidden";
    style.overscrollBehavior = "none";
    onCleanup(() => {
      style.overflow = before.overflow;
      style.overscrollBehavior = before.overscroll;
    });
  });

  // Escape minimises the chat, from the page and from inside it alike — a
  // keyboard event is composed. Unless the chat already used the key: one Escape
  // must not close both a picker and the panel under it.
  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.defaultPrevented) close();
  }

  const desktop = globalThis.matchMedia?.("(min-width: 64rem)");
  const measure = () => {
    wide.value = desktop?.matches ?? false;
  };

  onMounted(() => {
    measure();
    mounted.value = true;
    // The rail is already docked, and the page already carries its room: this
    // only agrees with the stylesheet, and fetches the chat that goes in it. The
    // composer takes the focus once it is there, so the page opens ready to be
    // asked something.
    if (wide.value) {
      open.value = true;
      void load().then(focusComposer);
    }
    desktop?.addEventListener("change", measure);
    globalThis.addEventListener("keydown", onKey);
  });

  onBeforeUnmount(() => {
    desktop?.removeEventListener("change", measure);
    globalThis.removeEventListener("keydown", onKey);
  });

  return { close, open, state, toggle, wide };
}
