import type { ComponentProps } from "preact";

import { sx, type Sx, type WithSx } from "@/styles/sx";
import type { GeneratedImage } from "@/types";

const S = {
  image: {
    height: "auto",
    maxWidth: "100%",
    overflow: "hidden",
    borderRadius: "var(--radius-md)",
  },
} satisfies Record<string, Sx>;

export type ImageProps = GeneratedImage & WithSx<Omit<ComponentProps<"img">, "src">>;

/** A model-generated image, carried as base64 rather than a URL. */
export const Image = ({
  base64,
  mediaType,
  uint8Array: _uint8Array,
  style,
  ...props
}: ImageProps) => (
  <img
    {...props}
    alt={props.alt}
    src={`data:${mediaType};base64,${base64}`}
    style={sx(S.image, style)}
  />
);
