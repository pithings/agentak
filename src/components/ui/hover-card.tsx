import { createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef } from "preact/hooks";

import { useControllableState } from "../../lib/use-controllable-state.ts";
import { sx, type Sx } from "../../styles/sx.ts";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  type PopoverContentProps,
  type PopoverProps,
  type PopoverTriggerProps,
} from "./popover.tsx";

/**
 * Replaces `@radix-ui/react-hover-card`. A thin layer over `popover.tsx`: the
 * same panel, opened by the pointer and by focus after a delay, and left open
 * while the pointer is over it. Focus is not trapped and not moved, so a hover
 * card never steals the caret.
 *
 * Nothing here needs the sheet — the card is a width over PopoverContent.
 */
const S = { content: { width: "16rem" } } satisfies Record<string, Sx>;

interface HoverCardContextValue {
  /** Cancel a pending open or close. */
  cancel: () => void;
  scheduleOpen: () => void;
  scheduleClose: () => void;
  /** Open now. Keyboard focus must not wait out the delay. */
  show: () => void;
}

const HoverCardContext = createContext<HoverCardContextValue | null>(null);

function useHoverCard(part: string) {
  const context = useContext(HoverCardContext);
  if (!context) throw new Error(`${part} must be used within HoverCard`);
  return context;
}

export type HoverCardProps = PopoverProps & {
  /** ms the pointer must rest on the trigger. */
  openDelay?: number;
  /** ms before the card closes once the pointer leaves both parts. */
  closeDelay?: number;
};

function HoverCard({
  open,
  defaultOpen = false,
  onOpenChange,
  openDelay = 150,
  closeDelay = 150,
  ...props
}: HoverCardProps) {
  const [isOpen, setOpen] = useControllableState({
    defaultProp: defaultOpen,
    onChange: onOpenChange,
    prop: open,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const schedule = useCallback(
    (next: boolean, delay: number) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = undefined;
        setOpen(next);
      }, delay);
    },
    [cancel, setOpen],
  );

  // No timer outlives the card.
  useEffect(() => cancel, [cancel]);

  const context = useMemo(
    () => ({
      cancel,
      scheduleClose: () => schedule(false, closeDelay),
      scheduleOpen: () => schedule(true, openDelay),
      show: () => {
        cancel();
        setOpen(true);
      },
    }),
    [cancel, closeDelay, openDelay, schedule, setOpen],
  );

  return (
    <HoverCardContext.Provider value={context}>
      <Popover
        data-slot="hover-card"
        onOpenChange={(next) => {
          cancel(); // A dismissal wins over anything already scheduled.
          setOpen(next);
        }}
        open={isOpen}
        {...props}
      />
    </HoverCardContext.Provider>
  );
}

export type HoverCardTriggerProps = PopoverTriggerProps;

function HoverCardTrigger({
  onBlur,
  onClick,
  onFocus,
  onPointerEnter,
  onPointerLeave,
  ...props
}: HoverCardTriggerProps) {
  const { scheduleClose, scheduleOpen, show } = useHoverCard("HoverCardTrigger");

  return (
    <PopoverTrigger
      data-slot="hover-card-trigger"
      onBlur={(event) => {
        onBlur?.(event);
        if (!event.defaultPrevented) scheduleClose();
      }}
      // Hovering is the whole gesture — a click must not toggle. preventDefault
      // is how PopoverTrigger is told to leave the state alone.
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) show();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (!event.defaultPrevented) scheduleOpen();
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        if (!event.defaultPrevented) scheduleClose();
      }}
      {...props}
    />
  );
}

export type HoverCardContentProps = PopoverContentProps;

function HoverCardContent({
  className,
  onFocusIn,
  onFocusOut,
  onPointerEnter,
  onPointerLeave,
  style,
  ...props
}: HoverCardContentProps) {
  const { cancel, scheduleClose } = useHoverCard("HoverCardContent");

  return (
    <PopoverContent
      className={className}
      data-slot="hover-card-content"
      style={sx(S.content, style)}
      // focusin/focusout, not focus/blur: they bubble, so a link inside the
      // card keeps it open.
      onFocusIn={(event) => {
        onFocusIn?.(event);
        cancel();
      }}
      onFocusOut={(event) => {
        onFocusOut?.(event);
        scheduleClose();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        cancel();
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        scheduleClose();
      }}
      trapFocus={false}
      {...props}
    />
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
