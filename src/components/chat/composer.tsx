// Docs: @docs/3.widget.md
import { useEffect, useId, useRef, useState } from "preact/hooks";

import type { ChatSettingsProps } from "./settings.tsx";
import type { ChatAgent } from "./types.ts";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "../ai-elements/prompt-input.tsx";
import { isTouch } from "../../lib/utils.ts";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset, u } from "../../styles/base.ts";
import { sx, type Sx } from "../../styles/sx.ts";

const S = {
  // Tight, because the surface is a side panel or a corner box: every row the
  // chrome takes is a row the transcript does not get. The status bar under it
  // carries the safe area a phone leaves at the foot of the screen — this row
  // is no longer the last one.
  //
  // No line over it either: the box below draws its own frame, and a rule the
  // width of the surface above a rounded one is a second edge saying the same
  // thing. The foot is opaque, so the transcript still ends where it starts.
  composer: {
    position: "relative", // The command list opens above it.
    padding: "0.5rem 0.5rem 0.375rem",
  },
  // Put away under the settings page. `display: none` takes it off the layout
  // and out of the accessibility tree, and the foot it sits in then measures
  // shorter — so the page above ends where the composer used to start.
  away: { display: "none" },
  // One line is a pill: the field and its send button share the row, and the
  // radius is half the height of it, so the box is a line of text and the
  // button at the end of it and nothing more. `999px` and not the number,
  // because the browser clamps it to half the height whatever that height is.
  box: { borderRadius: "999px" },
  // More than one line is a box again — a pill around three lines is a lozenge
  // with a hole at each corner. Rounded to the corner the pill turns and not a
  // round number near it: the box is 42px tall on one line — a 1px border, 2px
  // of padding, the 36px field, and the same back — so the pill turns 21px and
  // so does this. A corner that changed as the field grew would be a second
  // shape rather than the same box holding more.
  boxTall: { borderRadius: "1.3125rem" },
  // The row inside it. `PromptInputBody` adds no box of its own, so this is
  // where the field and the button are laid out; the padding is what holds the
  // button off the round edge.
  row: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    minWidth: "0",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.125rem",
  },
  // One line tall to start with, so an empty composer is a pill and not a box.
  textarea: {
    minHeight: "2.25rem",
    paddingBlock: "0.5rem",
    paddingLeft: "0.75rem",
    paddingRight: "0.25rem",
  },
  // The room the button leaves the row when it goes below: the button, the gap
  // beside it and the padding it had — 2.25rem, 0.25rem and 0.25rem. A line ends
  // where the field is wide, so the field must be as wide either way — otherwise
  // the text that wrapped fits again the moment the button moves, the box
  // unwraps, the button comes back, and it wraps again.
  textareaTall: { paddingRight: "2.75rem" },
  // Send is the only thing in the row it moves to, so it sits at the trailing
  // edge — what used to share it says what is running, and says it in the bar
  // below. The padding is the row's own, so the button is inset by the same 3px
  // it is inset by on one line, and sits in the box's corner the way it sits in
  // the pill's end.
  send: {
    justifyContent: "flex-end",
    paddingTop: "0",
    paddingBottom: "0.125rem",
    paddingInline: "0.125rem",
  },
  // Round, and concentric with the box it sits in: the button is inset 3px — the
  // row's 2px of padding over the box's 1px border — so its radius is the box's
  // less that inset, 21px − 3px = 18px, which is half of the 2.25rem it is tall.
  // Anything else leaves the two curves running apart along the corner, which is
  // the one thing the eye reads as unfinished.
  sendButton: { borderRadius: "999px" },
  // Over the transcript, like the usage panel — the composer is at the foot of
  // the surface, so a list under the field would be off the bottom of it.
  //
  // It scrolls, because the tools are in it and a page can publish as many as
  // it likes: two commands are a list that fits anywhere, twenty tools are not.
  // The scroll ends here rather than carrying on into the transcript behind it.
  commands: {
    position: "absolute",
    right: "0.5rem",
    bottom: "100%",
    left: "0.5rem",
    zIndex: "50",
    display: "flex",
    maxHeight: "min(50vh, 15rem)",
    flexDirection: "column",
    overflow: "hidden",
    overflowY: "auto",
    overscrollBehavior: "contain",
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

/**
 * Whether the field is drawing more than one line of text.
 *
 * Read off the box and not off the text, because a line is only as long as the
 * surface is wide: a side panel wraps a sentence a page would keep on one line.
 * `scrollHeight` is the content and not the box, so a field already grown by
 * `field-sizing: content` answers the same as one that has not. Every reading
 * is `NaN` where there is no layout at all — jsdom — and every comparison with
 * one is false, which is the single-line box a test then sees.
 */
function isWrapped(field: HTMLTextAreaElement) {
  const style = getComputedStyle(field);
  const line = parseFloat(style.lineHeight);
  const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return field.scrollHeight > line + padding + 1;
}

/**
 * One row of the slash list — a word the field can be instead of a message.
 *
 * A row with a `run` is a button: the field is cleared and something happens.
 * The two commands always have one, and a tool has one wherever the session can
 * run it. Where it cannot, the row is the name alone: picking it writes the name
 * into the message, which is the most a surface can do about a tool nothing here
 * calls.
 */
interface Command {
  name: string;
  hint: string;
  run?: () => void;
}

export interface ChatComposerProps extends ChatSettingsProps {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /**
   * The agent behind the chat. Only its tools are read here, and only for the
   * slash list: what the model can do is a list of names, and a name is hard to
   * remember and easy to misspell. Without it the list is the commands alone.
   */
  agent?: ChatAgent;
  /**
   * Run one of those tools, by name — what a tool row does when Enter is on it.
   * The harness runs it and the model reads the result, so the row is a whole
   * turn from one keystroke.
   *
   * Without it a tool row writes its name into the message instead: the surface
   * knows the tool exists and has no way to call it.
   */
  onCallTool?: (name: string) => void;
  /**
   * Start a conversation — what `/new` runs. Without it the composer offers no
   * such command. `Chat` passes its own, so the two ways of asking are one.
   */
  onReset?: () => void;
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

/**
 * What to say, and send. Nothing else: which model answers, how much of its
 * window is spent and every button the surface owns are one row further down,
 * in `bar.tsx`. The settings props are still read here — they say whether
 * `/model` is a command this surface can run, and whether a page is up.
 */
export function ChatComposer({
  agent,
  autoFocus,
  draft,
  focusKey,
  hidden,
  isStreaming,
  onCallTool,
  onReset,
  onSend,
  onStop,
  ...settings
}: ChatComposerProps & FocusProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The textarea is uncontrolled and preact forwards no ref through a component,
  // so it is read from the DOM by the name the form submits it under.
  const input = () => ref.current?.querySelector<HTMLTextAreaElement>('textarea[name="message"]');

  // Which of the two boxes is drawn: a pill around one line, or a box with the
  // send button under the field. A newline is one without measuring anything,
  // which is also the reading a browser without layout can still answer.
  const [multiline, setMultiline] = useState(false);
  const measure = () => {
    const field = input();
    setMultiline(field ? field.value.includes("\n") || isWrapped(field) : false);
  };

  // The field grows and shrinks for more reasons than a keystroke: a surface
  // that narrows wraps a message nothing was typed into, and a message put back
  // by a fork arrives whole. The box is what changes in each case, so the box is
  // what is watched.
  useEffect(() => {
    const field = input();
    if (!field || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

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

  // Then what the agent can do, under the two verbs. Enter on one of these runs
  // the tool where the session can — the harness calls it and the model reads
  // what came back, so a row is a whole turn. Where it cannot, the row writes
  // the name and the person says the rest.
  //
  // Mid-turn is one of the places it cannot: the transcript belongs to the turn
  // that is running, and a call written into it would be a call the answer never
  // asked for. So the row writes the name, and the message queues behind the
  // turn like every other thing typed while the model is working.
  const runnable = onCallTool && !isStreaming;
  //
  // A name the commands already use stays theirs: two rows spelt the same would
  // be one question with two answers, and the commands are the ones this surface
  // runs itself.
  for (const tool of agent?.tools ?? []) {
    const name = `/${tool.name}`;
    if (commands.some((entry) => entry.name === name)) continue;
    commands.push({
      hint: tool.description ?? "",
      name,
      run: runnable ? () => onCallTool(tool.name) : undefined,
    });
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

  // What the row under the cursor does. It takes the field with it: what was
  // typed was the button, not something to say. On a phone the keyboard goes
  // too — a page opens, or the model answers, and either is the whole surface.
  const run = (command: Command) => {
    const field = input();
    // A row nothing runs is a tool this session cannot call. The name goes into
    // the field and the caret lands after it, because the message is then the
    // only way of asking for that tool and it is not finished. The slash stays
    // behind with the list it opened; what is left is the word the model knows.
    if (!command.run) {
      const text = `${command.name.slice(1)} `;
      if (field) {
        field.value = text;
        field.focus();
        field.setSelectionRange(text.length, text.length);
      }
      setTyped(null);
      setActive(0);
      measure();
      return;
    }
    if (field) field.value = "";
    if (isTouch()) field?.blur();
    setTyped(null);
    measure();
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
    measure();
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
    // The form is reset before this runs, so the field is one line again.
    measure();
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

      <PromptInput
        groupStyle={sx(S.box, multiline && S.boxTall)}
        onSubmit={(message) => handleSubmit(message.text)}
      >
        <PromptInputBody style={S.row}>
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
              measure();
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
            style={sx(S.textarea, multiline && S.textareaTall, isTouch() && u.noZoom)}
          />
          {/* Beside the field while it is one line, and under it once it is not. */}
          {!multiline && <Send isStreaming={isStreaming} onStop={onStop} />}
        </PromptInputBody>
        {multiline && (
          <PromptInputFooter style={S.send}>
            <Send isStreaming={isStreaming} onStop={onStop} />
          </PromptInputFooter>
        )}
      </PromptInput>
    </div>
  );
}

/**
 * The one button the composer has, written once for the two rows it sits in.
 *
 * `icon` and not the `icon-sm` a prompt input takes by default: 2.25rem is the
 * height of the field beside it, so the button fills the row the padding leaves
 * and the pill closes around it. A smaller one would float in the middle of an
 * end it does not reach.
 */
function Send({ isStreaming, onStop }: { isStreaming: boolean; onStop: () => void }) {
  return (
    <PromptInputSubmit
      onStop={onStop}
      size="icon"
      status={isStreaming ? "streaming" : undefined}
      style={S.sendButton}
    />
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

  // The list scrolls once the tools are in it, and the cursor is moved by the
  // arrows: a row lit below the fold would be a list that answers keys and shows
  // nothing. `nearest` scrolls only where it has to, so the pointer moving the
  // same cursor over a visible row moves nothing. jsdom has no such method.
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  return (
    <button
      aria-selected={selected}
      data-slot="chat-command"
      id={id}
      ref={ref}
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
