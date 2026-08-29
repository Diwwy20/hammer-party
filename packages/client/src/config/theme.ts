import { PickupKind, StageTheme, clamp01 } from "@hammer/shared";

/**
 * The client's visual palette: what each stage theme and each pickup looks like.
 *
 * Themes drive COLOR ONLY — never gameplay. The server picks the theme name; this
 * file is the only place that decides what that name looks like.
 */

export interface StagePalette {
  sky: string;
  /** the floor outside the safe zone */
  danger: string;
  dangerEmissive: string;
  /** the floor inside the safe zone */
  safe: string;
  /** the glowing safe-zone edge */
  ring: string;
  /** the painted physical arena boundary */
  boundary: string;
}

const STAGE_PALETTES: Record<StageTheme, StagePalette> = {
  [StageTheme.Colosseum]: {
    sky: "#bfe4ff",
    danger: "#ff7a5c",
    dangerEmissive: "#e14b3d",
    safe: "#eaf6ff",
    ring: "#38a3ff",
    boundary: "#2c81d6",
  },
  [StageTheme.Pit]: {
    sky: "#f3d0a2",
    danger: "#d8462f",
    dangerEmissive: "#a52d1a",
    safe: "#ffe6cf",
    ring: "#ff8a3a",
    boundary: "#b5431f",
  },
  [StageTheme.Sky]: {
    sky: "#cfe4ff",
    danger: "#8fb0ff",
    dangerEmissive: "#5b6ee0",
    safe: "#eef6ff",
    ring: "#6d8bff",
    boundary: "#6d4bd6",
  },
  // waiting-room plaza — friendly, no danger colours (used whenever the phase is lobby)
  [StageTheme.Lobby]: {
    sky: "#bfe4ff",
    danger: "#dbeeff",
    dangerEmissive: "#bfe0ff",
    safe: "#eef7ff",
    ring: "#7fc4ff",
    boundary: "#38a3ff",
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
