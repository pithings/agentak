// Docs: @docs/3.widget.md
import { useEffect, useId, useRef, useState } from "preact/hooks";

import {
  Context,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextCacheUsage,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "../ai-elements/context.tsx";
import { ChatSettingsTrigger, type ChatSettingsProps } from "./settings.tsx";
import type { ChatUsage } from "./types.ts";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input.tsx";
import { isTouch } from "../../lib/utils.ts";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx } from "../../styles/sx.ts";

const S = {
  // Tight, because the surface is a side panel or a corner box: every row the
  // chrome takes is a row the transcript does not get. The foot adds the safe
  // area, so a full-height surface on a phone clears the home bar and the
  // rounded corner; the inset is 0 everywhere else. `--chat-safe-bottom` is the
  // surface's override — a composer already lifted over a virtual keyboard is
  // nowhere near the home bar, and `Chat` zeroes it there.
  composer: {
    position: "relative", // The command list opens above it.
    borderTop: "1px solid var(--border)",
    padding: "0.5rem",
    paddingBottom: "calc(0.5rem + var(--chat-safe-bottom, env(safe-area-inset-bottom, 0px)))",
  },
  // Put away under the settings page. `display: none` takes it off the layout
  // and out of the accessibility tree, and the foot it sits in then measures
  // shorter — so the page above ends where the composer used to start.
  away: { display: "none" },
  textarea: {
    minHeight: "3rem",
  },
  // Takes the row the send button leaves, and pulls back over the footer's own
  // padding so the leading control lines up with the text above it.
  tools: {
    flex: "1",
    marginLeft: "-0.5rem",
  },
  // The anchor for the panel below, which the composer's last row cannot hold.
  usage: {
    position: "relative",
    flexShrink: "0",
  },
  // The composer sits at the foot of the surface, so the breakdown opens over
  // the transcript instead of pushing the composer taller.
  usagePanel: {
    position: "absolute",
    right: "0",
    bottom: "100%",
    zIndex: "50",
    marginTop: "0",
    marginBottom: "0.5rem",
  },
  // Over the transcript, like the usage panel — the composer is at the foot of
  // the surface, so a list under the field would be off the bottom of it.
  commands: {
    position: "absolute",
    right: "0.5rem",
    bottom: "100%",
    left: "0.5rem",
    zIndex: "50",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    background: "var(--background)",
    marginBottom: "0.25rem",
    boxShadow: "var(--shadow-xs)",
  },
  command: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    minHeight: "2.25rem",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.375rem 0.625rem",
    outline: "none",
    textAlign: "left",
    fontSize: "0.8125rem",
    transition: "background-color var(--transition), color var(--transition)",
  },
  commandHover: { background: "var(--hover)", color: "var(--hover-foreground)" },
  // Inset, because the row is flush with the frame around the list.
  commandFocus: { outline: "2px solid var(--ring)", outlineOffset: "-2px" },
  // Every row but the first: one seam per pair, and none against the frame.
  commandLine: { borderTop: "1px solid var(--border)" },
  commandName: { flexShrink: "0", fontFamily: "var(--font-mono)" },
  commandHint: {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
} satisfies Record<string, Sx>;

/** One word a message can be instead of a message. */
interface Command {
  name: string;
  hint: string;
  run: () => void;
}

export interface ChatComposerProps extends ChatSettingsProps {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /**
   * Start a conversation — what `/new` runs. Without it the composer offers no
   * such command. `Chat` passes its own, so the two ways of asking are one.
   */
  onReset?: () => void;
  /** The context meter, beside send. Omitted, the composer carries none. */
  usage?: ChatUsage;
  /**
   * Take the focus as the chat mounts. Off by default, because a chat inside a
   * page is one thing on it and would pull the caret off whatever the reader was
   * doing. A surface that is the whole document — a side panel, a chat window —
   * was opened to be typed in, so it sets this.
   */
  autoFocus?: boolean;
}

/**
 * A number the surface changes to hand the composer the focus — a new
 * conversation, say. Not part of `ChatComposerProps`, because it is `Chat`
 * talking to its own composer and not a prop a host sets.
 */
interface FocusProps {
  focusKey?: number;
  /**
   * A message to put in the field, over whatever is in it — what a fork hands
   * back. The key is what makes it a request rather than a value: the field is
   * uncontrolled, so the same text twice is two of them.
   */
  draft?: { text: string; key: number };
  /**
   * Out of the way, while a page stands where the transcript is — the settings
   * page takes the whole surface under the header, composer included. Hidden
   * rather than unmounted, because the textarea is uncontrolled: unmounting it
   * would throw away a half-typed message the page was opened in the middle of.
   */
  hidden?: boolean;
}

/** The last row of the surface: what to say, which model says it, and send. */
export function ChatComposer({
  autoFocus,
  draft,
  focusKey,
  hidden,
  isStreaming,
  onReset,
  onSend,
  onStop,
  usage,
  ...settings
}: ChatComposerProps & FocusProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The textarea is uncontrolled and preact forwards no ref through a component,
  // so it is read from the DOM by the name the form submits it under.
  const input = () => ref.current?.querySelector<HTMLTextAreaElement>('textarea[name="message"]');

  // Leaving the settings page hands the focus here: the reason to open it was to
  // choose a model, and the reason to choose one is to then say something. Not
  // on a phone, where the focus is a keyboard over half the surface and the
  // field is one tap away anyway.
  const wasOpen = useRef(false);
  const settingsOpen = settings.pickerOpen === true;
  useEffect(() => {
    if (wasOpen.current && !settingsOpen && !isTouch()) input()?.focus();
    wasOpen.current = settingsOpen;
  }, [settingsOpen]);

  // The same for a new conversation: the transcript is empty and the only thing
  // left to do is say something. The first render is not a request — the chat
  // would take the focus off the page the moment it mounted.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current && !isTouch()) input()?.focus();
    mounted.current = true;
  }, [focusKey]);

  // Where the host says its surface is the whole document, the mount is a
  // request after all — the side panel was opened to be typed in.
  //
  // It is the one focus here that has to be asked for more than once. The panel
  // is its own document and the browser gives it the focus when it is ready to,
  // which is after this mounts: a field focused before that holds the document's
  // own focus and no keys, and chrome then hands the document to its body and
  // takes even that away. So the request stands, frame by frame, until the
  // document holds the focus and the field holds it too — or until the second is
  // up, because a person who has clicked back into the page is answering it.
  useEffect(() => {
    if (!autoFocus || isTouch()) return;
    const doc = ref.current?.ownerDocument;
    if (!doc) return;

    let frame = 0;
    let left = 60;
    const take = () => {
      const field = input();
      if (field) {
        if (doc.hasFocus() && doc.activeElement === field) return;
        field.focus();
      }
      if (--left > 0) frame = requestAnimationFrame(take);
    };

    take();
    return () => cancelAnimationFrame(frame);
  }, []);

  // The chat's own two verbs. Each is offered only where the surface can answer
  // it: a session with a fixed model chooses nothing, and a host that keeps the
  // reset button to itself passes no `onReset`.
  const commands: Command[] = [];
  if (settings.providers?.length || settings.models?.length) {
    commands.push({
      hint: "Provider, model and thinking level",
      name: "/model",
      run: () => settings.onPickerOpenChange?.(true),
    });
  }
  if (onReset) {
    commands.push({ hint: "Start a new conversation", name: "/new", run: onReset });
  }

  // The word being typed, while the field holds one slash word and nothing
  // else. Null for every other field, so an ordinary message renders nothing as
  // it is typed — the same reading `Chat` keeps the composer's height out of
  // state for.
  const [typed, setTyped] = useState<string | null>(null);
  const matches = typed === null ? [] : commands.filter((entry) => entry.name.startsWith(typed));

  // Which row the keys are on. Clamped rather than reset by an effect: a
  // keystroke that shortens the list is one render, and the row it leaves the
  // cursor past is the last one.
  const [active, setActive] = useState(0);
  const index = matches.length === 0 ? -1 : Math.min(active, matches.length - 1);
  const listId = useId();
  const optionId = (row: number) => `${listId}-${row}`;

  // The command takes the field with it: what was typed was the button, not
  // something to say. On a phone the keyboard goes too — a page is what every
  // command opens, and the keyboard would be over half of it.
  const run = (command: Command) => {
    const field = input();
    if (field) field.value = "";
    if (isTouch()) field?.blur();
    setTyped(null);
    command.run();
  };

  // A message handed back — the fork button. It replaces the field rather than
  // adding to it, because it is the message being said again, and the caret
  // lands after it where the next word goes. On a phone the field is filled and
  // left alone: the keyboard would be over the transcript it was rewound from.
  const draftKey = draft?.key;
  useEffect(() => {
    const field = input();
    if (draftKey === undefined || !field) return;
    const text = draft?.text ?? "";
    field.value = text;
    // The list reads the field, and a message put back is not a command.
    setTyped(null);
    setActive(0);
    if (isTouch()) return;
    field.focus();
    field.setSelectionRange(text.length, text.length);
  }, [draftKey]);

  // Tab writes the rest of the name and stops there, so the row is read once
  // more before it runs. Enter is what runs it.
  const complete = (command: Command) => {
    const field = input();
    if (field) field.value = command.name;
    setTyped(command.name);
    setActive(0);
  };

  const handleSubmit = (text: string) => {
    const word = text.trim();
    if (!word) return;
    // A leading slash is a command where it names one — an exact name, or the
    // one command a half-typed name leaves. Anything else is a message that
    // happens to start with a slash, and is sent as it was written.
    if (word.startsWith("/")) {
      const named = commands.filter((entry) => entry.name.startsWith(word));
      const command =
        named.find((entry) => entry.name === word) ?? (named.length === 1 ? named[0] : undefined);
      if (command) {
        run(command);
        return;
      }
    }
    // A sent message is the end of typing, so the keyboard has no more to do —
    // and on a phone it covers the answer it was asked for. Blur drops it. A
    // hardware keyboard keeps the focus, where the next message costs no click.
    if (isTouch()) input()?.blur();
    setTyped(null);
    onSend(text);
  };

  return (
    <div ref={ref} style={sx(S.composer, hidden && S.away)}>
      {matches.length > 0 && (
        <div aria-label="Commands" id={listId} role="listbox" style={S.commands}>
          {matches.map((command, row) => (
            <CommandRow
              command={command}
              first={row === 0}
              id={optionId(row)}
              key={command.name}
              onActivate={() => setActive(row)}
              onRun={run}
              selected={row === index}
            />
          ))}
        </div>
      )}

      <PromptInput onSubmit={(message) => handleSubmit(message.text)}>
        <PromptInputBody>
          <PromptInputTextarea
            // The field is a command picker while the list is open, and a
            // message field the rest of the time — so the role, and what a
            // reader is owed with it, come and go with the list rather than
            // being claimed over a chat's plain textarea.
            aria-activedescendant={index < 0 ? undefined : optionId(index)}
            aria-autocomplete={matches.length > 0 ? "list" : undefined}
            aria-controls={matches.length > 0 ? listId : undefined}
            aria-expanded={matches.length > 0 ? true : undefined}
            onInput={(event) => {
              const value = (event.target as HTMLTextAreaElement).value;
              // One slash word, nothing typed after it. Preact skips the render
              // where the reading has not changed, which is most keystrokes.
              setTyped(/^\/\S*$/.test(value) ? value : null);
              // The list is new, so the cursor starts at its head again.
              setActive(0);
            }}
            onKeyDown={(event) => {
              // The list is a hint over the transcript, so Escape puts it away
              // and leaves what was typed.
              if (event.key === "Escape" && typed !== null) {
                event.preventDefault();
                setTyped(null);
                return;
              }
              // Every key below belongs to the field again once the list is
              // shut — Enter sends, Tab leaves, the arrows move the caret.
              // IME candidate selection also fires Enter.
              if (index < 0 || event.isComposing) return;
              const last = matches.length - 1;

              switch (event.key) {
                case "ArrowDown":
                  event.preventDefault();
                  setActive(index === last ? 0 : index + 1);
                  break;
                case "ArrowUp":
                  event.preventDefault();
                  setActive(index === 0 ? last : index - 1);
                  break;
                case "Tab":
                  event.preventDefault();
                  complete(matches[index]);
                  break;
                case "Enter":
                  // Shift-Enter is a new line, here as everywhere else.
                  if (event.shiftKey) break;
                  // The submit the composer would otherwise make of it: the row
                  // under the cursor is the answer, not what the field spells.
                  event.preventDefault();
                  run(matches[index]);
                  break;
                default:
                  break;
              }
            }}
            placeholder={isStreaming ? "Queue a message…" : "Ask about this page…"}
            role={matches.length > 0 ? "combobox" : undefined}
            style={sx(S.textarea, isTouch() && u.noZoom)}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools style={S.tools}>
            {Boolean(settings.providers?.length || settings.models?.length) && (
              <ChatSettingsTrigger {...settings} />
            )}
          </PromptInputTools>
          {usage && (
            <Context
              costs={usage.costs}
              maxTokens={usage.maxTokens}
              modelId={usage.modelId}
              nearLimit={usage.nearLimit}
              style={S.usage}
              usage={usage.usage}
              usedTokens={usage.usedTokens}
            >
              <ContextTrigger />
              <ContextContent style={S.usagePanel}>
                <ContextContentHeader />
                {usage.usage && (
                  <ContextContentBody>
                    <ContextInputUsage />
                    <ContextOutputUsage />
                    <ContextReasoningUsage />
                    <ContextCacheUsage />
                  </ContextContentBody>
                )}
                {usage.costs && <ContextContentFooter />}
              </ContextContent>
            </Context>
          )}
          <PromptInputSubmit onStop={onStop} status={isStreaming ? "streaming" : undefined} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

/**
 * One command in the list. A component of its own, because a hook cannot run
 * inside `.map()` — the same reason the settings page has `SettingsRow`.
 */
function CommandRow({
  command,
  first,
  id,
  onActivate,
  onRun,
  selected,
}: {
  command: Command;
  /** The first row carries no seam — the list's own frame is the line above it. */
  first?: boolean;
  id: string;
  /** The pointer moves the cursor the arrow keys move, so only one row is lit. */
  onActivate: () => void;
  onRun: (command: Command) => void;
  selected: boolean;
}) {
  const { focusVisible, handlers } = useInteraction<HTMLButtonElement>({
    onPointerEnter: onActivate,
  });

  return (
    <button
      aria-selected={selected}
      data-slot="chat-command"
      id={id}
      onClick={() => onRun(command)}
      role="option"
      style={sx(
        reset.button,
        S.command,
        !first && S.commandLine,
        selected && S.commandHover,
        focusVisible && S.commandFocus,
      )}
      // The composer is a form: a bare button would submit it.
      type="button"
      {...handlers}
    >
      <span style={S.commandName}>{command.name}</span>
      <span style={S.commandHint}>{command.hint}</span>
    </button>
  );
}
