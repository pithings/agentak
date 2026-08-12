import { useCallback, useRef, useState } from "preact/hooks";

interface Options<T> {
  prop?: T;
  defaultProp: T;
  onChange?: (value: T) => void;
}

/**
 * Controlled-or-uncontrolled state. A defined `prop` takes over; otherwise the
 * value is held locally. Replaces `@radix-ui/react-use-controllable-state`.
 */
export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: Options<T>): [T, (value: T) => void] {
  const [uncontrolled, setUncontrolled] = useState<T>(defaultProp);
  const isControlled = prop !== undefined;

  // Read through a ref so setValue stays stable across renders.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
      onChangeRef.current?.(next);
    },
    [isControlled],
  );

  return [isControlled ? prop : uncontrolled, setValue];
}
