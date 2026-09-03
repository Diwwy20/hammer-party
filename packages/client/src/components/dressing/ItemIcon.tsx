import { BackId, FaceId, HatId } from "@hammer/shared";
import { COSMETIC_COLORS, CHARACTER_COLORS, hammerStyle } from "../../config/theme";

/**
 * Painted preview icons for the wardrobe grid.
 *
 * The old picker used an emoji per item (🎩, 😎, 🦸). Emoji are quick, but they are
 * somebody else's drawings: they are a different colour, a different weight and a
 * different style on every phone in the room, and none of them is the item you are
 * actually about to put on your character. These are drawn from THE SAME palette the
 * 3D meshes use (`COSMETIC_COLORS`, `hammerStyle`), so the grid cell and the thing in
 * the mirror are the same object twice.
 *
 * Inline SVG rather than images, for the same reason every texture in this game is
 * painted at runtime: nothing to fetch, so nothing to wait for on party wifi.
 */

const BOX = 32;
const c = COSMETIC_COLORS;

/** The frame every icon is drawn in. */
function Icon({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      className="item__art"
      viewBox={`0 0 ${BOX} ${BOX}`}
      role="img"
      aria-label={label}
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** "Wearing nothing" — the one entry in every catalog that is an absence. */
function Empty({ label }: { label: string }) {
  return (
    <Icon label={label}>
      <circle cx="16" cy="16" r="10" fill="none" stroke="#c3d2e0" strokeWidth="2.4" />
      <line
        x1="9"
        y1="23"
        x2="23"
        y2="9"
        stroke="#c3d2e0"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </Icon>
  );
}

export function HatIcon({ id, label }: { id: string; label: string }) {
  switch (id) {
    case HatId.Cap:
      return (
        <Icon label={label}>
          <path d="M6 20a10 9 0 0 1 20 0z" fill={c.capCrown} />
          <path d="M16 20h11a3 3 0 0 1-3 3H16z" fill={c.capBrim} />
          <circle cx="16" cy="11" r="1.8" fill={c.capBrim} />
        </Icon>
      );

    case HatId.Crown:
      return (
        <Icon label={label}>
          <path d="M6 22V11l5 4 5-7 5 7 5-4v11z" fill={c.gold} />
          <rect x="6" y="21" width="20" height="4" rx="1.4" fill={c.goldLight} />
          <circle cx="16" cy="13" r="1.6" fill={c.ribbon} />
        </Icon>
      );

    case HatId.Horns:
      return (
        <Icon label={label}>
          <path d="M13 24C9 21 6 16 7 8c4 2 6 8 6 16z" fill={c.bone} />
          <path d="M19 24c4-3 7-8 6-16-4 2-6 8-6 16z" fill={c.bone} />
        </Icon>
      );

    case HatId.TopHat:
      return (
        <Icon label={label}>
          {/* the signature hat: black felt, red band, RED brim */}
          <rect x="10" y="5" width="12" height="15" rx="1.2" fill={c.hatDark} />
          <rect x="9.4" y="14" width="13.2" height="3.4" fill={c.ribbon} />
          <rect x="4" y="19.5" width="24" height="4" rx="2" fill={c.hatBrim} />
        </Icon>
      );

    case HatId.Party:
      return (
        <Icon label={label}>
          <path d="M16 4l7 20H9z" fill={c.party} />
          <path d="M11.6 17.2h8.8l1 3H10.6z" fill={c.goldLight} />
          <circle cx="16" cy="4" r="2.4" fill={c.gold} />
        </Icon>
      );

    default:
      return <Empty label={label} />;
  }
}

export function FaceIcon({ id, label }: { id: string; label: string }) {
  switch (id) {
    case FaceId.Shades:
      return (
        <Icon label={label}>
          <rect x="3" y="12" width="26" height="4" rx="2" fill={c.frame} />
          <rect x="4" y="12" width="10" height="9" rx="3" fill={c.lensDark} />
          <rect x="18" y="12" width="10" height="9" rx="3" fill={c.lensDark} />
          <path d="M6 15l4 3" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.6" />
        </Icon>
      );

    case FaceId.Visor:
      return (
        <Icon label={label}>
          <path d="M3 13a13 8 0 0 1 26 0v4a13 6 0 0 1-26 0z" fill={c.visor} />
          <path
            d="M6 14a10 5 0 0 1 9-3"
            stroke="#ffffff"
            strokeOpacity="0.6"
            strokeWidth="1.8"
            fill="none"
          />
        </Icon>
      );

    case FaceId.Nerd:
      return (
        <Icon label={label}>
          <circle cx="9" cy="16" r="6" fill={c.lensClear} stroke={c.frame} strokeWidth="2.2" />
          <circle cx="23" cy="16" r="6" fill={c.lensClear} stroke={c.frame} strokeWidth="2.2" />
          <path d="M15 16h2" stroke={c.frame} strokeWidth="2.2" />
        </Icon>
      );

    case FaceId.Eyepatch:
      return (
        <Icon label={label}>
          <path d="M3 9l26 5" stroke={c.patch} strokeWidth="2.4" strokeLinecap="round" />
          <rect x="6" y="12" width="11" height="10" rx="3.4" fill={c.patch} />
          <circle cx="23" cy="17" r="2.6" fill={CHARACTER_COLORS.skin} />
        </Icon>
      );

    default:
      return <Empty label={label} />;
  }
}

export function BackIcon({ id, label }: { id: string; label: string }) {
  switch (id) {
    case BackId.Cape:
      return (
        <Icon label={label}>
          <path d="M10 5h12l4 22-10-4-10 4z" fill={c.cape} />
          <path d="M10 5h12l-1 4h-10z" fill={c.goldLight} />
        </Icon>
      );

    case BackId.Backpack:
      return (
        <Icon label={label}>
          <rect x="7" y="8" width="18" height="19" rx="4" fill={c.pack} />
          <rect x="11" y="15" width="10" height="7" rx="2" fill={c.packTrim} />
          <rect x="12" y="4" width="8" height="5" rx="2.4" fill={c.packTrim} />
        </Icon>
      );

    case BackId.Wings:
      return (
        <Icon label={label}>
          <path
            d="M15 6c-6 1-11 6-12 14 6 1 10-4 12-8z"
            fill={c.wing}
            stroke={c.wingGlow}
            strokeWidth="1.2"
          />
          <path
            d="M17 6c6 1 11 6 12 14-6 1-10-4-12-8z"
            fill={c.wing}
            stroke={c.wingGlow}
            strokeWidth="1.2"
          />
        </Icon>
      );

    case BackId.Jetpack:
      return (
        <Icon label={label}>
          <rect x="7" y="5" width="7" height="15" rx="3.4" fill={c.metal} />
          <rect x="18" y="5" width="7" height="15" rx="3.4" fill={c.metal} />
          <path d="M10.5 21l2.5 6-5 0z" fill={c.flame} />
          <path d="M21.5 21l2.5 6-5 0z" fill={c.flame} />
        </Icon>
      );

    default:
      return <Empty label={label} />;
  }
}

/**
 * A hammer, drawn from the same style table the 3D model uses — so the fast one is a
 * small pale head on a light haft and the heavy one is far too much dark iron, in the
 * grid exactly as it is in your hand.
 */
export function HammerIcon({ kind, label }: { kind: string; label: string }) {
  const style = hammerStyle(kind);
  // the same bulk the model has, mapped onto the icon's box
  const half = 5.5 * style.headScale;

  return (
    <Icon label={label}>
      <rect x="14.6" y="12" width="2.8" height="16" rx="1.4" fill={style.haft} />
      <rect x="13.9" y="20" width="4.2" height="6" rx="2" fill={style.grip} />
      <rect
        x={16 - half * 1.7}
        y={12 - half * 0.62}
        width={half * 3.4}
        height={half * 1.9}
        rx="2"
        fill={style.head}
      />
      <rect
        x={16 - half * 0.45}
        y={12 - half * 0.62}
        width={half * 0.9}
        height={half * 1.9}
        fill={style.shade}
      />
      {style.sparkle && <circle cx="25" cy="6" r="2.4" fill={c.goldLight} />}
    </Icon>
  );
}

/**
 * A hair tone, drawn as an actual head of hair rather than a bare dot — a grid of
 * circles tells you which colours exist, a grid of hair tells you what you are
 * choosing.
 */
export function HairIcon({ color, label }: { color: string; label: string }) {
  return (
    <Icon label={label}>
      <circle cx="16" cy="18" r="9.5" fill={CHARACTER_COLORS.skin} />
      <path d="M6.5 18a9.5 9.5 0 0 1 19 0c0-3-2-5-4-6-3 2-8 2-11 1-2 1-4 2.6-4 5z" fill={color} />
      <path
        d="M6.2 17c-.6-6 4-11 9.8-11s10.4 5 9.8 11c-1.2-4-4-6-6-6.6-3.4 2.4-9.6 2-11 .6-1.4 1.2-2.2 3.4-2.6 6z"
        fill={color}
      />
    </Icon>
  );
}

/** A body tint, drawn as the shirt it actually becomes. */
export function ShirtIcon({ color, label }: { color: string; label: string }) {
  return (
    <Icon label={label}>
      <path d="M11 6h10l6 4-3 5-2-1.4V27H10V13.6L8 15 5 10z" fill={color} />
      <path d="M11 6h10l-5 4z" fill={CHARACTER_COLORS.trim} />
      <rect x="10" y="21" width="12" height="3" fill={CHARACTER_COLORS.dark} />
      <rect x="14.6" y="21" width="2.8" height="3" fill={CHARACTER_COLORS.buckle} />
    </Icon>
  );
}
