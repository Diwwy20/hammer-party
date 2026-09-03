import {
  HAIR_COLORS,
  HammerKind,
  ObstacleKind,
  PickupKind,
  StageTheme,
  clamp01,
} from "@hammer/shared";

/**
 * The client's visual palette: what each stage theme and each pickup looks like.
 *
 * Themes drive COLOR ONLY — never gameplay. The server picks the theme name; this
 * file is the only place that decides what that name looks like.
 */

export interface StagePalette {
  /** the base sky/fog colour — what the horizon fades into */
  sky: string;
  /** the gradient dome: zenith → mid → horizon */
  skyTop: string;
  skyMid: string;
  /** the same sky under a downpour — everything goes grey and low-contrast */
  skyRain: string;
  /** the floor outside the safe zone */
  danger: string;
  dangerEmissive: string;
  /**
   * The stone flags inside the safe zone: two base tones, the mortar between them,
   * and the two bevels that give a painted tile its thickness — a lit top edge and a
   * shaded bottom one.
   */
  flagA: string;
  flagB: string;
  mortar: string;
  bevelLight: string;
  bevelDark: string;
  /** the wear speckled into the stone, and the hairline cracks worn through it */
  wear: string;
  /** grass growing through the flags: the blade tone, and the shade at a tuft's base */
  grass: string;
  grassShade: string;
  /** the glowing safe-zone wall */
  ring: string;
  /** the painted physical arena boundary */
  boundary: string;
  /** the island the arena sits on: its edge band, its flank and its shaded underside */
  rim: string;
  platform: string;
  platformShade: string;
  /** the low wall round the rim, and the posts punctuating it */
  wall: string;
  wallTrim: string;
  /** props: stone (columns, pillars), its shaded side, and crate timber */
  stone: string;
  stoneShade: string;
  timber: string;
  /** hanging cloth banners, and the trim along the top of one */
  banner: string;
  bannerTrim: string;
  /** the tiered stands, and the little blocks of crowd sitting in them */
  stands: string;
  crowd: readonly string[];
  /** planting: trunk plus the leaf tones the plaza's trees and shrubs use */
  trunk: string;
  foliage: readonly string[];
  /**
   * The world OUTSIDE the arena: the treeline, the village behind it, and the hills
   * behind that. Each ring is washed toward `sky` by `BACKDROP.haze*` as it recedes,
   * so these are the colours at full strength, up close.
   */
  treeCanopy: readonly string[];
  cottage: string;
  cottageRoof: string;
  hill: string;
  /**
   * The plain the arena stands on. False for a stage that is meant to be floating in
   * the sky — there the drifting cloud slabs do the job the ground does everywhere
   * else, and a grass plain under it would give the whole illusion away.
   */
  ground: string | null;
}

const STAGE_PALETTES: Record<StageTheme, StagePalette> = {
  [StageTheme.Colosseum]: {
    sky: "#bfe4ff",
    skyTop: "#4aa8f5",
    skyMid: "#a5dcff",
    skyRain: "#7d8ea0",
    danger: "#ff7a5c",
    dangerEmissive: "#e14b3d",
    flagA: "#dccdb1",
    flagB: "#cdbc9c",
    mortar: "#8d7c62",
    bevelLight: "#f2e8d3",
    bevelDark: "#9a8869",
    wear: "#b2a087",
    grass: "#5cbf5c",
    grassShade: "#3d8f45",
    ring: "#38a3ff",
    boundary: "#c9a978",
    rim: "#e0562f",
    platform: "#e6d2ae",
    platformShade: "#b9996d",
    wall: "#f3e7cf",
    wallTrim: "#d8c09a",
    stone: "#efe3cc",
    stoneShade: "#cbb894",
    timber: "#b07a45",
    banner: "#e0562f",
    bannerTrim: "#ffcf3a",
    stands: "#d5c2a0",
    crowd: ["#e0562f", "#f2a03a", "#4caf50", "#2f9ee0", "#7b53e0", "#e05aa0"],
    trunk: "#8a6034",
    foliage: ["#4caf50", "#3f9a45", "#68c06a"],
    treeCanopy: ["#4caf50", "#3f9a45", "#68c06a", "#2f8a48"],
    cottage: "#f0e2c6",
    cottageRoof: "#c25a3a",
    hill: "#8fc48a",
    ground: "#79b86f",
  },
  [StageTheme.Pit]: {
    sky: "#f3d0a2",
    skyTop: "#f0a256",
    skyMid: "#f7c78c",
    skyRain: "#9a8571",
    danger: "#d8462f",
    dangerEmissive: "#a52d1a",
    flagA: "#e4c49d",
    flagB: "#d4ad84",
    mortar: "#956f4d",
    bevelLight: "#f8dfc0",
    bevelDark: "#a67d56",
    wear: "#bc9770",
    grass: "#9fb055",
    grassShade: "#75873c",
    ring: "#ff8a3a",
    boundary: "#b5431f",
    rim: "#b5431f",
    platform: "#e0b78c",
    platformShade: "#a8724a",
    wall: "#f0cfa8",
    wallTrim: "#c99465",
    stone: "#e8c9a4",
    stoneShade: "#c19a72",
    timber: "#96602f",
    banner: "#b5431f",
    bannerTrim: "#f5c26b",
    stands: "#dcbb92",
    crowd: ["#b5431f", "#e08a3a", "#8a5a2f"],
    trunk: "#7b4c26",
    foliage: ["#7a9a4a", "#95ad55"],
    treeCanopy: ["#7a9a4a", "#95ad55", "#5f7f3c"],
    cottage: "#e8cba4",
    cottageRoof: "#a8492a",
    hill: "#c2a06e",
    ground: "#c9a877",
  },
  [StageTheme.Sky]: {
    sky: "#cfe4ff",
    skyTop: "#6f9dff",
    skyMid: "#b9d4ff",
    skyRain: "#8996ab",
    danger: "#8fb0ff",
    dangerEmissive: "#5b6ee0",
    flagA: "#e7edfa",
    flagB: "#d7dff2",
    mortar: "#a2afcb",
    bevelLight: "#ffffff",
    bevelDark: "#b5c0db",
    wear: "#c2cce2",
    grass: "#8fd9b0",
    grassShade: "#5fae87",
    ring: "#6d8bff",
    boundary: "#6d4bd6",
    rim: "#7b53e0",
    platform: "#e8eeff",
    platformShade: "#b9c6ea",
    wall: "#f7faff",
    wallTrim: "#d4dff5",
    stone: "#f2f5ff",
    stoneShade: "#c9d4f0",
    timber: "#9aa8d6",
    banner: "#7b53e0",
    bannerTrim: "#c9b6ff",
    stands: "#e6ecff",
    crowd: ["#8b7cf0", "#6d8bff", "#b39cff"],
    trunk: "#8d86b8",
    foliage: ["#9ad7ff", "#bfe4ff", "#8bc7f0"],
    treeCanopy: ["#9ad7ff", "#bfe4ff", "#8bc7f0"],
    cottage: "#f4f7ff",
    cottageRoof: "#7b53e0",
    hill: "#b9cdf0",
    ground: null,
  },
  // waiting-room plaza — friendly, no danger colours (used whenever the phase is lobby)
  [StageTheme.Lobby]: {
    sky: "#cdeaff",
    skyTop: "#48b0ff",
    skyMid: "#a8dcff",
    skyRain: "#8fa3b5",
    danger: "#dbeeff",
    dangerEmissive: "#bfe0ff",
    flagA: "#e9f3fc",
    flagB: "#d9e9f7",
    mortar: "#93b2cb",
    bevelLight: "#ffffff",
    bevelDark: "#bbd2e5",
    wear: "#c6daea",
    grass: "#5fd48a",
    grassShade: "#3aa864",
    ring: "#7fc4ff",
    boundary: "#38a3ff",
    rim: "#38a3ff",
    platform: "#eaf6ff",
    platformShade: "#b4d4ea",
    wall: "#ffffff",
    wallTrim: "#cfe6ff",
    stone: "#f0f6ff",
    stoneShade: "#cfe0f0",
    timber: "#c69a6a",
    banner: "#38a3ff",
    bannerTrim: "#ffc93c",
    stands: "#e8f2fb",
    crowd: ["#38a3ff", "#34c86a", "#ffc93c"],
    trunk: "#a9784a",
    foliage: ["#4ec97a", "#34b869", "#7fdd9a"],
    treeCanopy: ["#4ec97a", "#34b869", "#7fdd9a"],
    cottage: "#ffffff",
    cottageRoof: "#38a3ff",
    hill: "#9fd9b8",
    ground: "#79cf90",
  },
};

/** Palette for a theme name off the wire, falling back to the default stage's look. */
export function stagePalette(theme: string): StagePalette {
  return STAGE_PALETTES[theme as StageTheme] ?? STAGE_PALETTES[StageTheme.Colosseum];
}

export interface PickupStyle {
  color: string;
  /** emissive intensity — how much the item glows. */
  glow: number;
}

const PICKUP_STYLES: Record<PickupKind, PickupStyle> = {
  [PickupKind.Fast]: { color: "#38a3ff", glow: 0.25 },
  [PickupKind.Heavy]: { color: "#5b6672", glow: 0.2 },
  [PickupKind.Golden]: { color: "#ffcf3a", glow: 0.85 },
  [PickupKind.Heal]: { color: "#34c86a", glow: 0.6 },
};

export function pickupStyle(kind: string): PickupStyle {
  return PICKUP_STYLES[kind as PickupKind] ?? PICKUP_STYLES[PickupKind.Fast];
}

/**
 * How each hammer LOOKS.
 *
 * The four hammers are four different weapons with four different feels, and until
 * now they were one grey mallet that occasionally turned gold. You should be able
 * to tell what somebody is carrying from across the arena — before they hit you
 * with it — so each kind gets its own metal, its own timber, its own bulk and its
 * own colour of smear through the air.
 *
 * One `HammerModel` still draws all of them, held and lying on the floor alike, so
 * the silhouette you learn in the lobby is the one you dodge in the match.
 */
export interface HammerStyle {
  /** the metal of the head, and the darker tone of its band, collar and pommel */
  head: string;
  shade: string;
  /** the timber of the haft and the wrap round its grip */
  haft: string;
  grip: string;
  /** how big the whole hammer is, and how much bulkier its head is on top of that */
  scale: number;
  headScale: number;
  /**
   * How much the metal glows, and the colour it smears through the air.
   *
   * The smears are SATURATED rather than the white a slash effect wants to be,
   * because the arenas are pale and a white smear over a white floor is no smear at
   * all. Bright beats correct: you have about a fifth of a second to notice it.
   */
  glow: number;
  trail: string;
  /** only the golden hammer twinkles */
  sparkle: boolean;
}

const HAMMER_STYLES: Record<HammerKind, HammerStyle> = {
  // light blue steel on pale wood: small head, quick, barely there
  [HammerKind.Fast]: {
    head: "#a9dcff",
    shade: "#5aa6d8",
    haft: "#d7b184",
    grip: "#2f7fbf",
    scale: 1,
    headScale: 0.8,
    glow: 0.14,
    trail: "#3fd0ff",
    sparkle: false,
  },
  // the one everybody starts with: honest steel on an honest stick
  [HammerKind.Mid]: {
    head: "#ccd6de",
    shade: "#6d7884",
    haft: "#8a5a2c",
    grip: "#43301f",
    scale: 1.14,
    headScale: 1,
    glow: 0,
    trail: "#ffd24a",
    sparkle: false,
  },
  // dark iron, far too much of it, on a stubby haft
  [HammerKind.Heavy]: {
    head: "#6b7683",
    shade: "#3b444f",
    haft: "#5b4630",
    grip: "#241c14",
    scale: 1.3,
    headScale: 1.3,
    glow: 0,
    trail: "#ff7a2f",
    sparkle: false,
  },
  // the event weapon: bigger, brighter, and lit from inside
  [HammerKind.Golden]: {
    head: "#ffcf3a",
    shade: "#e0a51e",
    haft: "#a8722e",
    grip: "#7a4a1e",
    scale: 1.38,
    headScale: 1.14,
    glow: 0.7,
    trail: "#fff36b",
    sparkle: true,
  },
};

/** How a hammer kind off the wire is drawn, falling back to the starting hammer. */
export function hammerStyle(kind: string): HammerStyle {
  return HAMMER_STYLES[kind as HammerKind] ?? HAMMER_STYLES[HammerKind.Mid];
}

/** The bits of a hammer that are the same whatever kind it is. */
export const WEAPON_COLORS = {
  sparkle: "#fff6d0",
} as const;

/** The party dressing: balloons, bunting and confetti all pick from this. */
export const PARTY_COLORS = [
  "#ff6f61",
  "#ffc93c",
  "#34c86a",
  "#38a3ff",
  "#8b7cf0",
  "#ff8ac4",
] as const;

/** HP bar colours: green → amber → red as HP drops. */
const HP_STEPS = [
  { above: 0.5, color: "#34c86a" },
  { above: 0.22, color: "#ffc93c" },
] as const;
const HP_CRITICAL_COLOR = "#ff6f61";

/** Bar colour for an HP ratio in [0, 1]. */
export function hpColor(ratio: number): string {
  return HP_STEPS.find((step) => ratio > step.above)?.color ?? HP_CRITICAL_COLOR;
}

/** Clamp raw hp into the 0–1 ratio the bars are drawn from. */
export function hpRatio(hp: number, hpMax: number): number {
  return clamp01(hp / hpMax);
}

/** Solid cover: pillars are stone, crates are timber. */
export function obstacleColors(
  kind: string,
  palette: StagePalette,
): {
  main: string;
  trim: string;
} {
  return kind === ObstacleKind.Crate
    ? { main: palette.timber, trim: palette.stoneShade }
    : { main: palette.stone, trim: palette.stoneShade };
}

/** The meteor storm's colours: the warning on the floor, the rock, and the blast. */
export const METEOR_COLORS = {
  /** the telegraphed danger circle — reads as "move" from across the arena */
  warn: "#ff4d3d",
  warnFill: "#ff8a6a",
  /** the falling rock and its glowing underside */
  rock: "#4a3b38",
  ember: "#ff9a3a",
  /** the flash and expanding shockwave on impact */
  flash: "#ffd27a",
  shockwave: "#ffb85c",
  /** the scorch mark it leaves behind */
  scorch: "#5a3a33",
} as const;

/** Rain, and the dimming it lays over the whole scene. */
export const RAIN_COLORS = {
  drop: "#cfe6ff",
  /** puddle sheen laid over the arena floor */
  sheen: "#8fb6d8",
} as const;

/** A dead player: pale, see-through, and unmistakably not in the fight any more. */
export const GHOST_COLORS = {
  body: "#dbe9f7",
  trim: "#a8c4e0",
  eye: "#5d6f82",
} as const;

/**
 * The character's fixed (non-cosmetic) parts — including every colour the PAINTED
 * face is drawn with (`three/textures.ts`). The face is the whole personality of
 * the thing, so it gets named properly rather than living in the drawing code.
 */
export const CHARACTER_COLORS = {
  skin: "#f7d6b0",
  /**
   * The UNIFORM. The tunic itself is the player's own tint; everything here is what
   * it is trimmed with, and it is deliberately the same on all 25 of them — the
   * team kit is what makes one player's colour read as a colour rather than as a
   * different character entirely.
   */
  trim: "#fff4e0",
  /** the belt, the leggings and the boots — one dark tone that grounds the outfit */
  dark: "#3a4356",
  /** the sole under a boot, and the buckle on the belt */
  sole: "#2a3242",
  buckle: "#f2c14e",
  /** the mitten gloves */
  glove: "#fff4e0",
  /** the soft blob of contact shadow every character stands on */
  blobShadow: "#2b4058",
} as const;

/**
 * This player's hair tone, from the wardrobe slot they picked.
 *
 * The catalog itself lives in `shared/constants.ts` alongside the body tints,
 * because it is a cosmetic CATALOG now — an index that travels on the wire and gets
 * clamped by the server — rather than a colour this file made up off `colorIndex`.
 */
export function hairColor(hairIndex: number): string {
  return HAIR_COLORS[hairIndex % HAIR_COLORS.length] ?? HAIR_COLORS[0];
}

/**
 * Mix a colour toward another by `amount` (0 = untouched, 1 = fully the other).
 *
 * This is the whole of the backdrop's "depth of field": distance is drawn by washing
 * a thing toward the sky it sits in front of, which is what aerial perspective
 * actually looks like and what a blur only approximates.
 */
export function haze(color: string, toward: string, amount: number): string {
  const a = hexToRgb(color);
  const b = hexToRgb(toward);
  const t = clamp01(amount);
  const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return rgbToHex(mix(0), mix(1), mix(2));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * The painted face: big eyes, soft brows, a smile, and a bit of blush.
 *
 * The eye is drawn in five passes — white, iris, pupil, the pool of light coming
 * through the bottom of the iris, and two catchlights on top. That is most of the
 * budget of the whole character, and it is the right place to spend it: a face is
 * the only part of it anybody actually looks at.
 */
export const FACE_COLORS = {
  white: "#ffffff",
  /** the iris, and the brighter pool at the bottom of it where light comes through */
  iris: "#4c73c8",
  irisLow: "#9fd0ff",
  pupil: "#232a3a",
  /** the lash line over the eye — heavier than the brow, and the eye's real shape */
  lash: "#2b3242",
  /** the catchlight that makes an eye look wet rather than printed */
  shine: "#ffffff",
  brow: "#4a4034",
  mouth: "#7a3b38",
  tongue: "#f08a92",
  blush: "#ff9d9d",
} as const;

/**
 * The moment of impact: the flash, the star, the sparks and the dust.
 *
 * Warm and near-white on purpose. Whatever colour the arena, the stage lights or
 * the weather happen to be, a hit has to be the brightest thing on the screen for
 * the fifth of a second it lasts.
 */
export const IMPACT_COLORS = {
  flash: "#ffffff",
  star: "#fff2b8",
  /**
   * The sparks thrown off the stone.
   *
   * Saturated orange rather than the near-white a spark "should" be: the arenas are
   * pale cream and these are drawn with ordinary alpha, so the colour has to be one
   * the floor is not already made of.
   */
  spark: "#ff8f2e",
  ring: "#ffe6a8",
  dust: "#f4e6cf",
  /** the fractures a smash leaves in the flags, and the shadow inside them */
  crack: "#3a2f26",
  crackGlow: "#ffd9a0",
} as const;

/**
 * The floating damage numbers: cool for a tap, hot for a hit that hurt.
 *
 * The colour is a SIZE cue as much as a damage one — you should be able to tell a
 * fast-hammer tap from a golden-hammer haymaker out of the corner of your eye,
 * without reading the digits.
 */
export const DAMAGE_COLORS = {
  small: "#ffffff",
  big: "#ffd23c",
  /** damage YOU took — the one number on screen that is about you */
  taken: "#ff6f61",
  /** the outline every number is drawn with, so it reads over any floor */
  outline: "#2a1c14",
} as const;

/** The ring under the player your next swing would land on, and the reticle over them. */
export const TARGET_COLORS = {
  ring: "#3fd0ff",
  reticle: "#ffffff",
} as const;

/**
 * The dressing room: warm timber, cream plaster, brass on the mirror.
 *
 * Deliberately warmer and darker than anywhere else in the game. The arena is a
 * bright outdoor place; this is indoors, in the afternoon, and the contrast is what
 * makes stepping into it feel like stepping somewhere.
 */
export const ROOM_COLORS = {
  floor: "#b98a5a",
  floorPlank: "#a97a4c",
  wall: "#f3e6d2",
  wainscot: "#c8a173",
  rail: "#8f6743",
  rug: "#c25a4a",
  rugTrim: "#e8c06a",
  /** the mirror: its brass frame, the bevel inside it, and the glass */
  frame: "#d8a94e",
  frameShade: "#a87c2c",
  bevel: "#f6e2ae",
  glass: "#dfeef7",
  /** the shelf, and the things standing on it */
  shelf: "#8f6743",
  books: ["#c2452f", "#3d5a8c", "#3f7f5e", "#8e3b5e", "#d8a94e"],
  pot: "#c98a5e",
  scroll: "#efe2c4",
  scrollTie: "#b0324a",
  /** the plant beside the mirror */
  plantPot: "#c07a52",
  plantLeaf: "#4fa85e",
  /** the window, and the warm shaft of afternoon coming through it */
  windowFrame: "#8f6743",
  daylight: "#fff0c9",
} as const;

/**
 * Cosmetic colours. They live here rather than inline in the meshes so a restyle of
 * the wardrobe never means editing geometry — and so the join-screen cover art can
 * be painted from the exact same swatches as the 3D characters.
 */
export const COSMETIC_COLORS = {
  capCrown: "#3fae6a",
  capBrim: "#2f9455",
  gold: "#e8c583",
  goldLight: "#f8e6b6",
  goldGlow: "#7a5a1e",
  bone: "#efe6d2",
  /** the signature top hat: black felt, a RED brim, and a red band round the crown */
  hatDark: "#1b1c24",
  hatBrim: "#d0392f",
  ribbon: "#b0324a",
  party: "#e05aa0",
  lensDark: "#101014",
  lensClear: "#bfe3ff",
  frame: "#2a2a2a",
  visor: "#39e0e0",
  patch: "#141414",
  cape: "#b0324a",
  pack: "#6f4f30",
  packTrim: "#8a6540",
  wing: "#eaf2ff",
  wingGlow: "#8fb6ff",
  metal: "#3a4150",
  flame: "#ff8a3a",
  flameGlow: "#ff6a1a",
} as const;
