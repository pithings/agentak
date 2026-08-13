import {
  type ComponentObjectPropsOptions,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";

import { AgentChat } from "@/agent-chat";
import { Chat } from "@/components/chat";
import { injectTokens } from "@/styles/inject";
import {
  type ChatHostProps,
  type ChatMount,
  type ChatPanelProps,
  type ChatViewProps,
  HOST,
  mountIsland,
  type Surface,
  type SurfaceProps,
  surfaceProps,
} from "@/wrap";

export type { ChatPanelProps, ChatViewProps } from "@/wrap";

/**
 * Every prop, declared: what is not declared here falls through to the div as
 * an attribute instead. `Required` is what says so at compile time — a prop
 * added to the interface and forgotten here does not build.
 *
 * `null` is "any type, no casting". The flags are `Boolean` so that
 * `<ChatPanel generate-title />` is `true` rather than `""`, and
 * `default: undefined` is what keeps an absent flag absent — vue would
 * otherwise cast a boolean prop nobody wrote to `false`, and `tokens` means
 * yes until a host says no.
 */
const FLAG = { type: Boolean, default: undefined } as const;
const REQUIRED = { type: null, required: true } as const;

const PANEL_PROPS: Required<ComponentObjectPropsOptions<ChatPanelProps>> = {
  actions: null,
  emptyActions: null,
  generateTitle: FLAG,
  session: REQUIRED,
  tokens: FLAG,
};

/** The controlled surface takes the whole of `Chat`, so the whole of it is here. */
const VIEW_PROPS: Required<ComponentObjectPropsOptions<ChatViewProps>> = {
  actions: null,
  agent: null,
  emptyActions: null,
  error: null,
  isStreaming: { type: Boolean, required: true },
  messages: REQUIRED,
  modelId: null,
  models: null,
  modelsLoading: FLAG,
  onDequeue: null,
  onDismissError: null,
  onModelChange: null,
  onPickerOpenChange: null,
  onProviderChange: null,
  onRespond: null,
  onReset: REQUIRED,
  onRetry: null,
  onSaveKey: null,
  onSend: REQUIRED,
  onStop: REQUIRED,
  onThinkingLevelChange: null,
  pickerOpen: FLAG,
  providerId: null,
  providerLabel: null,
  providers: null,
  queued: null,
  thinkingLevel: null,
  thinkingLevels: null,
  title: null,
  tokens: FLAG,
  usage: null,
};

/**
 * The div vue owns, with the preact island inside it.
 *
 * Vue never patches the children of that div, and preact never looks outside
 * it, so the two renderers never fight over the same nodes.
 */
function island<P extends ChatHostProps>(surface: Surface<P>, props: P) {
  const host = ref<HTMLDivElement>();
  let mounted: ChatMount<SurfaceProps<P>> | undefined;

  onMounted(() => {
    const target = host.value;
    if (!target) return;
    if (props.tokens !== false) injectTokens(target.ownerDocument);
    mounted = mountIsland(target, surface, surfaceProps(props));
  });

  // What the surface takes, watched by value: any changed prop redraws the
  // island, and nothing else here reaches into it.
  watch(
    () => Object.values(props),
    () => mounted?.update(surfaceProps(props)),
  );

  onBeforeUnmount(() => {
    mounted?.unmount();
    mounted = undefined;
  });

  return () => h("div", { ref: host, style: HOST });
}

/**
 * The chat, for a vue app: the surface in a box the page sizes, with the `--*`
 * tokens declared on mount.
 *
 * It carries no loop. `session` is what runs it, and the import that makes one
 * is the host's:
 *
 * ```vue
 * <script setup lang="ts">
 * import { ChatPanel } from "agentak/vue";
 * import { createPiSession } from "agentak/pi";
 *
 * const session = createPiSession();
 * onBeforeUnmount(() => session.dispose?.());
 * </script>
 *
 * <template>
 *   <ChatPanel :session="session" class="h-[600px]" />
 * </template>
 * ```
 *
 * Whoever made the session ends it — this component never does.
 *
 * `class` and `style` fall through to the one element this renders, which is the
 * box the surface fills — so the page sizes the chat the way it sizes any other
 * component.
 *
 * The surface itself is preact, so `actions` and `emptyActions` are preact
 * children rather than slots — build them with `h()` from preact, or leave them
 * out.
 */
export const ChatPanel = defineComponent((props: ChatPanelProps) => island(AgentChat, props), {
  name: "ChatPanel",
  props: PANEL_PROPS,
});

/**
 * The chat, for a vue app that runs the conversation itself: `Chat` in a box the
 * page sizes, with the `--*` tokens declared on mount.
 *
 * Nothing stands behind it. The transcript, the streaming flag and the
 * callbacks are the host's, so an app with its own store or its own transport
 * takes the surface and no session at all.
 *
 * The callbacks are props rather than emits, because the surface is preact and
 * takes them as props — bind them by name:
 *
 * ```vue
 * <template>
 *   <ChatView
 *     :is-streaming="streaming"
 *     :messages="messages"
 *     :on-reset="clear"
 *     :on-send="send"
 *     :on-stop="stop"
 *     class="h-[600px]"
 *   />
 * </template>
 * ```
 */
export const ChatView = defineComponent((props: ChatViewProps) => island(Chat, props), {
  name: "ChatView",
  props: VIEW_PROPS,
});
