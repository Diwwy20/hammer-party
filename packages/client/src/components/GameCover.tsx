import { HammerKind, PLAYER_COLORS } from "@hammer/shared";
import {
  CHARACTER_COLORS,
  COSMETIC_COLORS,
  FACE_COLORS,
  hairColor,
  hammerStyle,
} from "../config/theme";

/**
 * The game's cover art: the Hammer Party mascot, hammer over one shoulder.
 *
 * Deliberately an inline SVG rather than an image file — it is the first thing a
 * phone renders after the QR scan, so it has to be instant, crisp at any size and
 * work with no network at all (the event runs on a room LAN). It is painted from the
 * SAME swatches as the 3D characters (`config/theme.ts`) and built out of the same
 * parts — hair, scarf, collar, belt, boots — so the character on the cover is
 * recognisably the one you are about to walk around as.
 *
 * `bob` adds the idle float used on the loading screen; the join screen keeps it
 * still so it reads as a logo.
 */
export function GameCover({ bob = false, className = "" }: { bob?: boolean; className?: string }) {
  const skin = CHARACTER_COLORS.skin;
  const trim = CHARACTER_COLORS.trim;
  const dark = CHARACTER_COLORS.dark;
  /** the brand orange the default character wears, and the hair and scarf that go with it */
  const colorIndex = 1;
  const body = PLAYER_COLORS[colorIndex];
  const hair = hairColor(colorIndex);
  const weapon = hammerStyle(HammerKind.Mid);

  return (
    <svg
      viewBox="0 0 260 250"
      className={`cover ${bob ? "cover--bob" : ""} ${className}`}
      role="img"
      aria-label="Hammer Party"
    >
      {/* sunburst — slow, so it reads as warmth rather than motion */}
      <g className="cover__rays">
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            key={i}
            x="126"
            y="-40"
            width="8"
            height="130"
            rx="4"
            fill="#ffffff"
            opacity="0.34"
            transform={`rotate(${i * 30} 130 120)`}
          />
        ))}
      </g>

      {/* ground shadow */}
      <ellipse cx="112" cy="226" rx="62" ry="11" fill="#2c81d6" opacity="0.16" />

      {/* the hammer, resting back over the shoulder: a waisted head on a wrapped haft */}
      <g transform="translate(158 145) rotate(22)">
        <rect x="-6" y="-92" width="12" height="104" rx="6" fill={weapon.haft} />
        <rect x="-8" y="-16" width="16" height="30" rx="7" fill={weapon.grip} />
        <rect x="-11" y="-86" width="22" height="10" rx="4" fill={weapon.shade} />
        <path
          d="M-33 -124 Q0 -120 33 -124 L33 -80 Q0 -84 -33 -80 Z"
          fill={weapon.head}
          stroke={weapon.shade}
          strokeWidth="2"
        />
        <rect x="-7" y="-122" width="14" height="40" fill={weapon.shade} opacity="0.9" />
        <rect x="-30" y="-119" width="15" height="8" rx="4" fill="#ffffff" opacity="0.6" />
      </g>

      {/* boots: a trim cuff, the boot, and a sole under it */}
      {[88, 114].map((x) => (
        <g key={x}>
          <rect x={x - 2} y="188" width="23" height="9" rx="4.5" fill={trim} />
          <rect x={x} y="192" width="19" height="26" rx="8" fill={dark} />
          <rect x={x - 1} y="214" width="21" height="8" rx="4" fill={CHARACTER_COLORS.sole} />
        </g>
      ))}

      {/* the bean, in the uniform: flared hem, belt, chest panel and collar */}
      <ellipse cx="111" cy="173" rx="44" ry="39" fill={body} />
      <path d="M70 180 L152 180 L162 206 L60 206 Z" fill={body} />
      <ellipse cx="96" cy="158" rx="18" ry="13" fill="#ffffff" opacity="0.16" />
      <rect x="68" y="184" width="86" height="13" rx="6" fill={dark} />
      <rect x="105" y="185" width="11" height="11" rx="3" fill={CHARACTER_COLORS.buckle} />

      {/* arms — the right one reaches up to the grip */}
      <rect
        x="60"
        y="158"
        width="17"
        height="46"
        rx="8.5"
        fill={body}
        transform="rotate(14 68 160)"
      />
      <circle cx="63" cy="203" r="10" fill={CHARACTER_COLORS.glove} />
      <rect
        x="134"
        y="136"
        width="38"
        height="17"
        rx="8.5"
        fill={body}
        transform="rotate(-16 153 145)"
      />
      <circle cx="160" cy="141" r="11" fill={CHARACTER_COLORS.glove} />

      {/* the scarf, caught mid-flap — it is the collar too */}
      <path d="M104 152 Q80 158 68 180 L82 185 Q94 166 110 161 Z" fill={trim} />
      <ellipse cx="111" cy="146" rx="24" ry="9" fill={trim} />
      <circle cx="122" cy="150" r="8" fill={trim} />

      {/* head */}
      <circle cx="111" cy="113" r="43" fill={skin} />
      <ellipse cx="84" cy="128" rx="10" ry="6" fill={FACE_COLORS.blush} opacity="0.5" />
      <ellipse cx="138" cy="128" rx="10" ry="6" fill={FACE_COLORS.blush} opacity="0.5" />

      {/* the face: an iris with light coming through the bottom of it, and a lash line */}
      {[97, 127].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy="110" rx="12" ry="13.5" fill={FACE_COLORS.white} />
          <circle cx={x + (i === 0 ? 1 : -1)} cy="112" r="9" fill={FACE_COLORS.iris} />
          <ellipse cx={x + (i === 0 ? 1 : -1)} cy="117" rx="5" ry="4" fill={FACE_COLORS.irisLow} />
          <circle cx={x + (i === 0 ? 1 : -1)} cy="112" r="4.4" fill={FACE_COLORS.pupil} />
          <circle cx={x - 4} cy="106" r="3" fill={FACE_COLORS.shine} />
          <path
            d={`M${x - 12} 108 Q${x} 94 ${x + 12} 108`}
            fill="none"
            stroke={FACE_COLORS.lash}
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      ))}
      <path d="M99 129 L123 129 Q111 145 99 129 Z" fill={FACE_COLORS.mouth} />

      {/* hair: a cap down to the brow, a swept fringe, and a lock either side */}
      <ellipse cx="70" cy="118" rx="8" ry="21" fill={hair} />
      <ellipse cx="152" cy="118" rx="8" ry="21" fill={hair} />
      <path d="M71 90 A46 46 0 0 1 151 90 Z" fill={hair} />
      <path d="M71 88 Q104 108 151 86 L151 78 L71 78 Z" fill={hair} />

      {/* party hat, tipped at a jaunty angle */}
      <g transform="rotate(-12 111 74)">
        <path d="M111 34 L131 84 L91 84 Z" fill={COSMETIC_COLORS.party} />
        <path d="M111 34 L121 59 L101 59 Z" fill="#ffffff" opacity="0.25" />
        <circle cx="111" cy="32" r="7" fill={COSMETIC_COLORS.goldLight} />
      </g>

      {/* a little confetti, because it is a party */}
      <g className="cover__confetti">
        <circle cx="34" cy="70" r="6" fill={COSMETIC_COLORS.capCrown} opacity="0.85" />
        <rect
          x="216"
          y="150"
          width="11"
          height="11"
          rx="3"
          fill={COSMETIC_COLORS.party}
          opacity="0.8"
        />
        <circle cx="228" cy="98" r="5" fill={COSMETIC_COLORS.gold} opacity="0.9" />
        <rect
          x="30"
          y="150"
          width="10"
          height="10"
          rx="3"
          fill={COSMETIC_COLORS.visor}
          opacity="0.7"
        />
      </g>
    </svg>
  );
}
