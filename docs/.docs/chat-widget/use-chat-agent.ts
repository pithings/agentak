import { type Component, onBeforeUnmount, shallowRef } from "vue";
import type { PiSession } from "../../../src/pi/index.ts";
import { docsPrompt } from "./docs-prompt.ts";

/** The two pieces of the library the site itself renders with, once loaded. */
export type ChatUi = { Button: unknown; h: typeof import("preact").h };

/**
 * The chat behind the widget: the panel component, the session it runs, and the
 * one call that fetches both.
 *
 * The docs are server rendered and the chat is a browser widget, so every
 * import here is dynamic — the server loads none of them. A small screen loads
 * nothing at all until the button is taken. Once mounted the panel is only
 * folded away, so minimising it keeps the transcript.
 */
export function useChatAgent() {
  const Panel = shallowRef<Component>();
  const session = shallowRef<PiSession>();
  const ui = shallowRef<ChatUi>();

  async function load() {
    if (session.value) return;
    const [{ ChatPanel }, { browserStorage, createPiSession }, { Button }, preact, systemPrompt] =
      await Promise.all([
        import("../../../src/vue/index.ts"),
        import("../../../src/pi/index.ts"),
        import("../../../src/components/index.ts"),
        import("preact"),
        // The docs instructions improve the library default but are not needed
        // to mount the chat, so a config read failure falls back to that default.
        docsPrompt().catch(() => undefined),
      ]);
    ui.value = { Button, h: preact.h };
    // `localStorage`, so the provider, model and key a reader picks are still
    // there on the next page of the documentation — and so are the conversations:
    // `history` keeps them in that same store, opens on the last one, and lists
    // the rest on the chat's own history page.
    //
    // `page: true` offers the model whatever this site publishes on
    // `document.modelContext` — the chat is in the document the tools are in, so
    // it reads them directly.
    session.value = createPiSession({
      history: true,
      page: true,
      storage: browserStorage(),
      systemPrompt,
    });
    Panel.value = ChatPanel;
  }

  // Whoever makes a session ends it.
  onBeforeUnmount(() => {
    session.value?.dispose();
    session.value = undefined;
  });

  return { load, Panel, session, ui };
}
