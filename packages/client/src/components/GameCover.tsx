import { PLAYER_COLORS } from "@hammer/shared";
import { CHARACTER_COLORS, COSMETIC_COLORS, WEAPON_COLORS } from "../config/theme";

/**
 * The game's cover art: the Hammer Party mascot, hammer over one shoulder.
 *
 * Deliberately an inline SVG rather than an image file — it is the first thing a
 * phone renders after the QR scan, so it has to be instant, crisp at any size and
 * work with no network at all (the event runs on a room LAN). It is painted from the
 * SAME swatches as the 3D characters (`config/theme.ts`), so the face on the cover
 * is recognisably the one you walk around as.
 *
 * `bob` adds the idle float used on the loading screen; the join screen keeps it
 * still so it reads as a logo.
 */
export function GameCover({ bob = false, className = "" }: { bob?: boolean; className?: string }) {
  const skin = CHARACTER_COLORS.skin;
  const body = PLAYER_COLORS[1]; // the brand orange the default character wears

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

      {/* the hammer, resting back over the shoulder */}
      <g transform="translate(158 145) rotate(22)">
        <rect x="-6" y="-92" width="12" height="104" rx="6" fill={WEAPON_COLORS.haft} />
        <rect x="-33" y="-124" width="66" height="44" rx="13" fill={WEAPON_COLORS.head} />
        <rect x="-33" y="-112" width="66" height="9" fill="#a7b3bd" opacity="0.8" />
        <rect x="-25" y="-118" width="20" height="9" rx="4.5" fill="#ffffff" opacity="0.65" />
      </g>

      {/* legs */}
      <rect x="88" y="192" width="19" height="30" rx="9.5" fill={CHARACTER_COLORS.shoe} />
      <rect x="114" y="192" width="19" height="30" rx="9.5" fill={CHARACTER_COLORS.shoe} />

      {/* the bean */}
      <ellipse cx="111" cy="173" rx="44" ry="39" fill={body} />
      <ellipse cx="96" cy="160" rx="18" ry="13" fill="#ffffff" opacity="0.18" />

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
      <circle cx="63" cy="203" r="10" fill={skin} />
      <rect
        x="134"
        y="136"
        width="38"
        height="17"
        rx="8.5"
        fill={body}
        transform="rotate(-16 153 145)"
      />
      <circle cx="160" cy="141" r="11" fill={skin} />

      {/* head */}
      <circle cx="111" cy="113" r="43" fill={skin} />
      <ellipse cx="86" cy="130" rx="9" ry="6" fill="#f0968f" opacity="0.55" />
      <ellipse cx="136" cy="130" rx="9" ry="6" fill="#f0968f" opacity="0.55" />

      {/* eyes, with the same highlight the 3D character has */}
      <circle cx="97" cy="110" r="8" fill={CHARACTER_COLORS.eye} />
      <circle cx="127" cy="110" r="8" fill={CHARACTER_COLORS.eye} />
      <circle cx="100" cy="107" r="3" fill={CHARACTER_COLORS.eyeShine} />
      <circle cx="130" cy="107" r="3" fill={CHARACTER_COLORS.eyeShine} />
      <path
        d="M100 128 Q111 138 122 128"
        fill="none"
        stroke={CHARACTER_COLORS.mouth}
        strokeWidth="4"
        strokeLinecap="round"
      />

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
