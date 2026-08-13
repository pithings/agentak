import type { ComponentChild, ComponentProps, Context, VNode } from "preact";
import { cloneElement, createContext, toChildArray } from "preact";
import { useCallback, useContext, useLayoutEffect, useState } from "preact/hooks";

import { isIconChild } from "@/lib/icons";
import { useInteraction, type InteractionProps } from "@/lib/use-interaction";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input, isInvalid } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sx, type Sx, type WithSx } from "@/styles/sx";

/**
 * What the group does to a control it wraps travels as `style`, and what the
 * group used to read with `:has()` is reported to it by the descendant itself —
 * see `useReport`.
 */
const S = {
  group: {
    boxSizing: "border-box",
    position: "relative",
    display: "flex",
    width: "100%",
    height: "2.25rem",
    minWidth: "0",
    alignItems: "center",
    border: "1px solid var(--input)",
    borderRadius: "var(--radius-md)",
    background: "var(--surface)",
    boxShadow: "var(--shadow-xs)",
    outline: "none",
    transition: "border-color var(--transition), box-shadow var(--transition)",
  },
  groupStack: { height: "auto", flexDirection: "column" },
  groupFocus: { borderColor: "var(--ring)", boxShadow: "var(--focus-ring)" },
  groupInvalid: { borderColor: "var(--destructive)", boxShadow: "var(--invalid-ring)" },
  addon: {
    boxSizing: "border-box",
    display: "flex",
    height: "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    cursor: "text",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
    fontWeight: "500",
    paddingBlock: "0.375rem",
    userSelect: "none",
  },
  addonIcon: { width: "1rem", height: "1rem" },
  // Controls give up their own frame — the group carries it. This has to reach
  // the control as `style`: its radius and background are inline already.
  control: { flex: "1", border: "0", borderRadius: "0", background: "transparent" },
  controlFlat: { boxShadow: "none" },
  controlFocus: { borderColor: "transparent" },
  textarea: { resize: "none", paddingBlock: "0.75rem" },
  text: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
  textIcon: { width: "1rem", height: "1rem", pointerEvents: "none" },
  btn: { boxShadow: "none" },
} satisfies Record<string, Sx>;

/** An addon's placement, what a button child pulls back, and whether it stacks. */
interface Align {
  sx: Sx;
  button?: Sx;
  stack?: boolean;
}

const ALIGNS = {
  "inline-start": {
    sx: { order: "-1", paddingLeft: "0.75rem" },
    button: { marginLeft: "-0.45rem" },
  },
  "inline-end": {
    sx: { order: "1", paddingRight: "0.75rem" },
    button: { marginRight: "-0.45rem" },
  },
  "block-start": {
    sx: {
      boxSizing: "border-box",
      order: "-1",
      width: "100%",
      justifyContent: "flex-start",
      paddingTop: "0.75rem",
      paddingInline: "0.75rem",
    },
    stack: true,
  },
  "block-end": {
    sx: {
      boxSizing: "border-box",
      order: "1",
      width: "100%",
      justifyContent: "flex-start",
      paddingBottom: "0.75rem",
      paddingInline: "0.75rem",
    },
    stack: true,
  },
} satisfies Record<string, Align>;

export type InputGroupAlign = keyof typeof ALIGNS;

/** What a descendant tells an ancestor, because `:has()` has no inline form. */
type Report<K extends string> = (flag: K, on: boolean) => void;

/**
 * The three facts the group read off its own subtree: a block addon or a
 * textarea stacks it, and the control's focus and invalid states paint its
 * frame. A prop cannot see any of them, and context only travels down, so the
 * group hands a reporter down and the descendant calls it.
 */
type GroupFlag = "stack" | "focus" | "invalid";

const GroupContext = createContext<Report<GroupFlag> | null>(null);
/** The same, for `.ig-addon--inline-*:has(> button)`. */
const AddonContext = createContext<Report<"button"> | null>(null);

/**
 * Count the descendants that report a flag, not just whether one did: two of
 * them can report the same flag, and the unmount of one must not clear the
 * other.
 */
function useFlags<K extends string>() {
  const [counts, setCounts] = useState<Partial<Record<K, number>>>({});

  const report = useCallback<Report<K>>((flag, on) => {
    setCounts((previous) => ({ ...previous, [flag]: (previous[flag] ?? 0) + (on ? 1 : -1) }));
  }, []);

  return { has: (flag: K) => (counts[flag] ?? 0) > 0, report };
}

/** Publish a flag to the ancestor for as long as `on` holds. */
function useReport<K extends string>(
  context: Context<Report<K> | null>,
  flag: NoInfer<K>,
  on: boolean,
) {
  const report = useContext(context);

  // A layout effect, so the ancestor repaints before the frame is shown.
  useLayoutEffect(() => {
    if (!report || !on) return;
    report(flag, true);
    return () => report(flag, false);
  }, [report, flag, on]);
}

/** A raw textarea child, which reports nothing — this was `:has(> textarea)`. */
function isTextareaChild(child: ComponentChild): boolean {
  if (!child || typeof child !== "object") return false;
  const type = (child as VNode).type;
  return type === "textarea" || type === Textarea;
}

function InputGroup({ className, style, children, ...props }: WithSx<ComponentProps<"div">>) {
  const { has, report } = useFlags<GroupFlag>();
  const stacked = has("stack") || toChildArray(children).some(isTextareaChild);

  return (
    <GroupContext.Provider value={report}>
      <div
        className={className}
        data-slot="input-group"
        role="group"
        style={sx(
          S.group,
          stacked && S.groupStack,
          has("focus") && S.groupFocus,
          has("invalid") && S.groupInvalid,
          style,
        )}
        {...props}
      >
        {children}
      </div>
    </GroupContext.Provider>
  );
}

function InputGroupAddon({
  className,
  align = "inline-start",
  style,
  children,
  ...props
}: WithSx<ComponentProps<"div">> & { align?: InputGroupAlign }) {
  const placement = ALIGNS[align] as Align;
  const { has, report } = useFlags<"button">();
  useReport(GroupContext, "stack", placement.stack === true);

  return (
    <AddonContext.Provider value={report}>
      <div
        className={className}
        data-align={align}
        data-slot="input-group-addon"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          event.currentTarget.parentElement?.querySelector("input")?.focus();
        }}
        role="group"
        style={sx(S.addon, placement.sx, has("button") && placement.button, style)}
        {...props}
      >
        {toChildArray(children).map((child) =>
          isIconChild(child)
            ? cloneElement(child, { style: sx(S.addonIcon, child.props.style) })
            : child,
        )}
      </div>
    </AddonContext.Provider>
  );
}

/**
 * A Button sized from the same scale, minus the variant's resting shadow.
 *
 * The shadow goes as `style`, so it lands after `buttonSx()` — a class was
 * (0,1,0) and lost to every inline value the button computes. It is dropped
 * again while a ring is up, because those rules outranked `.ig-btn`.
 */
function InputGroupButton({
  className,
  style,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: ButtonProps) {
  const { focusVisible, handlers } = useInteraction<HTMLButtonElement>(props);
  useReport(AddonContext, "button", true);
  const ringed = focusVisible || isInvalid(props["aria-invalid"]);

  return (
    <Button
      className={className}
      size={size}
      style={sx(!ringed && S.btn, style)}
      type={type}
      variant={variant}
      {...props}
      {...handlers}
    />
  );
}

function InputGroupText({ className, style, children, ...props }: WithSx<ComponentProps<"span">>) {
  return (
    <span className={className} style={sx(S.text, style)} {...props}>
      {toChildArray(children).map((child) =>
        isIconChild(child)
          ? cloneElement(child, { style: sx(S.textIcon, child.props.style) })
          : child,
      )}
    </span>
  );
}

/**
 * The frame the group takes off a control, and the ring it leaves on it.
 *
 * `[aria-invalid]` outranked `.ig-control`, so an invalid control keeps its
 * own ring; the focus rule outranked both, so a focused one is flat again.
 */
function useGroupControl<T extends EventTarget>(
  props: InteractionProps<T> & { "aria-invalid"?: unknown },
) {
  const { focusVisible, handlers } = useInteraction<T>(props);
  const invalid = isInvalid(props["aria-invalid"]);

  useReport(GroupContext, "focus", focusVisible);
  useReport(GroupContext, "invalid", invalid);

  return {
    handlers,
    style: sx(
      S.control,
      (focusVisible || !invalid) && S.controlFlat,
      focusVisible && S.controlFocus,
    ),
  };
}

function InputGroupInput({ className, style, ...props }: WithSx<ComponentProps<"input">>) {
  const control = useGroupControl<HTMLInputElement>(props);

  return (
    <Input
      className={className}
      data-slot="input-group-control"
      style={sx(control.style, style)}
      {...props}
      {...control.handlers}
    />
  );
}

function InputGroupTextarea({ className, style, ...props }: WithSx<ComponentProps<"textarea">>) {
  const control = useGroupControl<HTMLTextAreaElement>(props);
  // A report reaches the group from any depth, where `:has(> textarea)` read
  // direct children alone — the composer wraps its own in a `display: contents`
  // body, and a group holding a textarea stacks either way.
  useReport(GroupContext, "stack", true);

  return (
    <Textarea
      className={className}
      data-slot="input-group-control"
      style={sx(control.style, S.textarea, style)}
      {...props}
      {...control.handlers}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
