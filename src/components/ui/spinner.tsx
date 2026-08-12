import { LoaderIcon, type IconProps } from "@/lib/icons";
import { useAnimation } from "@/lib/use-animation";
import { spinKeyframes, spinOptions, u } from "@/styles/base";
import { sx, type Sx } from "@/styles/sx";

const S = {
  // The animation and its ref live on this wrapper, not on `LoaderIcon`
  // itself: `LoaderIcon` is a plain function component, and Preact only
  // hands a `ref` the DOM node for host elements — a function component gets
  // its internal instance instead. `u.icon` moves here too, so the wrapper
  // is the one true icon-sized box and the svg just fills it.
  root: { display: "inline-flex" },
  glyph: { width: "100%", height: "100%" },
} satisfies Record<string, Sx>;

function Spinner({ className, style, ...props }: Omit<IconProps, "style"> & { style?: Sx }) {
  const ref = useAnimation<HTMLSpanElement>(spinKeyframes, spinOptions);

  return (
    <span ref={ref} style={sx(u.icon, S.root, style)}>
      <LoaderIcon
        aria-label="Loading"
        aria-hidden={undefined}
        className={className}
        role="status"
        style={S.glyph}
        {...props}
      />
    </span>
  );
}

// Marks Spinner as an icon for Button's `hasIcon` detection, the same way
// every component in `lib/icons.tsx` marks itself — see `isIconChild` there.
// Without this, `<Button><Spinner/></Button>` gets the wider non-icon
// padding because Button never recognises the spinner as one.
(Spinner as unknown as { isIcon: true }).isIcon = true;

export { Spinner };
