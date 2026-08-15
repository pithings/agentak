import type { ComponentProps } from "preact";

import { controlSx, isInvalid } from "./input.tsx";
import { useInteraction } from "../../lib/use-interaction.ts";
import { reset } from "../../styles/base.ts";
import { sx, type Sx, type WithSx } from "../../styles/sx.ts";

const S = {
  textarea: {
    boxSizing: "border-box",
    display: "block",
    minHeight: "4rem",
    padding: "0.5rem 0.75rem",
    fieldSizing: "content",
  },
} satisfies Record<string, Sx>;

function Textarea({ className, style, ...props }: WithSx<ComponentProps<"textarea">>) {
  const { focusVisible, handlers } = useInteraction<HTMLTextAreaElement>(props);

  return (
    <textarea
      className={className}
      data-slot="textarea"
      style={sx(
        reset.control,
        controlSx({
          disabled: props.disabled === true,
          focusVisible,
          invalid: isInvalid(props["aria-invalid"]),
        }),
        S.textarea,
        style,
      )}
      {...props}
      {...handlers}
    />
  );
}

export { Textarea };
