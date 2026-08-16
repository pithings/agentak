import type { ComponentProps } from "preact";
import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

import { sx, type Sx, type WithSx } from "../../../styles/sx.ts";

const S = {
  avatar: {
    position: "relative",
    display: "flex",
    width: "2rem",
    height: "2rem",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: "9999px",
    userSelect: "none",
  },
  image: { width: "100%", height: "100%", aspectRatio: "1", objectFit: "cover" },
  // Sits over the image, so a slow or broken load never moves the layout.
  fallback: {
    position: "absolute",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9999px",
    background: "var(--muted)",
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
} satisfies Record<string, Sx>;

const SIZES = {
  default: undefined,
  sm: { width: "1.5rem", height: "1.5rem" },
  lg: { width: "2.5rem", height: "2.5rem" },
} satisfies Record<string, Sx | undefined>;

// The small avatar shrinks its fallback text; only `sm` differs from the base.
const FALLBACK_SIZES = {
  default: undefined,
  sm: { fontSize: "0.75rem" },
  lg: undefined,
} satisfies Record<string, Sx | undefined>;

export type AvatarSize = keyof typeof SIZES;

const AvatarContext = createContext<{
  loaded: boolean;
  setLoaded: (loaded: boolean) => void;
  size: AvatarSize;
}>({ loaded: false, setLoaded: () => {}, size: "default" });

export type AvatarProps = WithSx<ComponentProps<"span">> & { size?: AvatarSize };

function Avatar({ className, size = "default", style, ...props }: AvatarProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <AvatarContext.Provider value={{ loaded, setLoaded, size }}>
      <span
        className={className}
        data-size={size}
        data-slot="avatar"
        style={sx(S.avatar, SIZES[size], style)}
        {...props}
      />
    </AvatarContext.Provider>
  );
}

export type AvatarImageProps = WithSx<ComponentProps<"img">>;

function AvatarImage({ className, style, ...props }: AvatarImageProps) {
  const { setLoaded } = useContext(AvatarContext);

  return (
    <img
      alt={props.alt ?? ""}
      className={className}
      data-slot="avatar-image"
      onError={() => setLoaded(false)}
      onLoad={() => setLoaded(true)}
      style={sx(S.image, style)}
      {...props}
    />
  );
}

export type AvatarFallbackProps = WithSx<ComponentProps<"span">>;

/** Shown until an `AvatarImage` reports a load. */
function AvatarFallback({ className, style, ...props }: AvatarFallbackProps) {
  const { loaded, size } = useContext(AvatarContext);
  if (loaded) return null;

  return (
    <span
      className={className}
      data-slot="avatar-fallback"
      style={sx(S.fallback, FALLBACK_SIZES[size], style)}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
