import { ObstacleKind, PickupKind, StageTheme, clamp01 } from "@hammer/shared";

/**
 * The client's visual palette: what each stage theme and each pickup looks like.
 *
 * Themes drive COLOR ONLY — never gameplay. The server picks the theme name; this
 * file is the only place that decides what that name looks like.
 */

export interface StagePalette {
  sky: string;
  /** the same sky under a downpour — everything goes grey and low-contrast */
  skyRain: string;
  /** the floor outside the safe zone */
  danger: string;
  dangerEmissive: string;
  /** the floor inside the safe zone */
  safe: string;
  /** the glowing safe-zone edge */
  ring: string;
  /** the painted physical arena boundary */
  boundary: string;
  /** props: stone (columns, pillars), its shaded side, and crate timber */
  stone: string;
  stoneShade: string;
  timber: string;
  /** hanging cloth banners */
  banner: string;
  /** the tiered stands, and the little blocks of crowd sitting in them */
  stands: string;
  crowd: readonly string[];
}

const STAGE_PALETTES: Record<StageTheme, StagePalette> = {
  [StageTheme.Colosseum]: {
    sky: "#bfe4ff",
    skyRain: "#7d8ea0",
    danger: "#ff7a5c",
    dangerEmissive: "#e14b3d",
    safe: "#f6e9cf",
    ring: "#38a3ff",
    boundary: "#c9a978",
    stone: "#efe3cc",
    stoneShade: "#cbb894",
    timber: "#b07a45",
    banner: "#e0562f",
    stands: "#e3d5ba",
    crowd: ["#e0562f", "#f2a03a", "#4caf50", "#2f9ee0", "#7b53e0", "#e05aa0"],
  },
  [StageTheme.Pit]: {
    sky: "#f3d0a2",
    skyRain: "#9a8571",
    danger: "#d8462f",
    dangerEmissive: "#a52d1a",
    safe: "#ffe6cf",
    ring: "#ff8a3a",
    boundary: "#b5431f",
    stone: "#e8c9a4",
    stoneShade: "#c19a72",
    timber: "#96602f",
    banner: "#b5431f",
    stands: "#dcbb92",
    crowd: ["#b5431f", "#e08a3a", "#8a5a2f"],
  },
  [StageTheme.Sky]: {
    sky: "#cfe4ff",
    skyRain: "#8996ab",
    danger: "#8fb0ff",
    dangerEmissive: "#5b6ee0",
    safe: "#eef6ff",
    ring: "#6d8bff",
    boundary: "#6d4bd6",
    stone: "#f2f5ff",
    stoneShade: "#c9d4f0",
    timber: "#9aa8d6",
    banner: "#7b53e0",
    stands: "#e6ecff",
    crowd: ["#8b7cf0", "#6d8bff", "#b39cff"],
  },
  // waiting-room plaza — friendly, no danger colours (used whenever the phase is lobby)
  [StageTheme.Lobby]: {
    sky: "#bfe4ff",
    skyRain: "#8fa3b5",
    danger: "#dbeeff",
    dangerEmissive: "#bfe0ff",
    safe: "#eef7ff",
    ring: "#7fc4ff",
    boundary: "#38a3ff",
    stone: "#f0f6ff",
    stoneShade: "#cfe0f0",
    timber: "#c69a6a",
    banner: "#38a3ff",
    stands: "#e8f2fb",
    crowd: ["#38a3ff", "#34c86a", "#ffc93c"],
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

/** Shared props colours (the wooden haft, plain steel, and the golden hammer's shine). */
export const WEAPON_COLORS = {
  haft: "#5a3a1e",
  head: "#c9d2da",
  golden: "#ffcf3a",
  none: "#000000",
} as const;

/** Grid + world colours that aren't stage-specific. */
export const WORLD_COLORS = {
  gridCell: "#cfe0ef",
  gridSection: "#a9c9e6",
} as const;

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

/** The character's fixed (non-cosmetic) parts. */
export const CHARACTER_COLORS = {
  skin: "#f6d3ad",
  eye: "#2a2f39",
  eyeShine: "#ffffff",
  /** the shoes/feet and the arm stubs, tinted off the body colour */
  shoe: "#4a5766",
  mouth: "#b5645a",
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
  hatDark: "#1b1c24",
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
