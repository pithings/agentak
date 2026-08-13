import {
  type ComponentObjectPropsOptions,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import { injectTokens } from "@/styles/inject";
import { type AgentakChatProps, type ChatMount, chatProps, HOST, mountChat } from "@/wrap";

export type { AgentakChatProps } from "@/wrap";

/**
 * Every prop, declared: what is not declared here falls through to the div as
 * an attribute instead. `Required` is what says so at compile time — a prop
 * added to `AgentakChatProps` and forgotten here does not build.
 *
 * `null` is "any type, no casting". The two flags are `Boolean` so that
 * `<AgentakChat generate-title />` is `true` rather than `""`, and
 * `default: undefined` is what keeps an absent flag absent — vue would
 * otherwise cast a boolean prop nobody wrote to `false`, and `tokens` means
 * yes until a host says no.
 */
const PROPS: Required<ComponentObjectPropsOptions<AgentakChatProps>> = {
  actions: null,
  emptyActions: null,
  generateTitle: { type: Boolean, default: undefined },
  session: { type: null, required: true },
  tokens: { type: Boolean, default: undefined },
};

/**
 * The chat, for a vue app: the surface in a box the page sizes, with the `--*`
 * tokens declared on mount.
 *
 * It carries no loop. `session` is what runs it, and the import that makes one
 * is the host's:
 *
 * ```vue
 * <script setup lang="ts">
 * import { AgentakChat } from "agentak/vue";
 * import { createPiSession } from "agentak/pi";
 *
 * const session = createPiSession();
 * onBeforeUnmount(() => session.dispose?.());
 * </script>
 *
 * <template>
 *   <AgentakChat :session="session" class="h-[600px]" />
 * </template>
 * ```
 *
 * Whoever made the session ends it — this component never does.
 *
 * `class` and `style` fall through to the one element this renders, which is the
 * box the surface fills — so the page sizes the chat the way it sizes any other
 * component.
 *
 * The surface itself is preact, so that element is a div vue owns and preact
 * fills. Vue never patches its children, and preact never looks outside it.
 * `actions` and `emptyActions` are therefore preact children rather than slots —
 * build them with `h()` from preact, or leave them out.
 */
export const AgentakChat = defineComponent(
  (props: AgentakChatProps) => {
    const host = ref<HTMLDivElement>();
    let island: ChatMount | undefined;

    onMounted(() => {
      const target = host.value;
      if (!target) return;
      if (props.tokens !== false) injectTokens(target.ownerDocument);
      island = mountChat(target, chatProps(props));
    });

    // What the surface takes, watched by name: a new vnode, a changed flag or
    // another session redraws the island, and nothing else here reaches into it.
    watch(
      () => [props.session, props.actions, props.emptyActions, props.generateTitle],
      () => island?.update(chatProps(props)),
    );

    onBeforeUnmount(() => {
      island?.unmount();
      island = undefined;
    });

    return () => h("div", { ref: host, style: HOST });
  },
  { name: "AgentakChat", props: PROPS },
);
