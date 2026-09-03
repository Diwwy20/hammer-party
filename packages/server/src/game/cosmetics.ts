import {
  BACKS,
  COSMETIC_NONE_INDEX,
  FACES,
  HAIR_COLORS,
  HATS,
  PLAYER_COLORS,
  clampIndex,
  type CosmeticMessage,
} from "@hammer/shared";
import type { Player } from "@hammer/shared/schema";

/**
 * Cosmetics are the one thing a client picks for itself — so every index is clamped
 * to its catalog here. A hostile client can't smuggle in an out-of-range slot that
 * would render as nothing (or crash a peer's renderer).
 *
 * Adding a cosmetic means appending to the catalog in `shared/constants.ts`; this
 * clamp follows automatically because it reads `.length`.
 */

const CATALOG_SIZE = {
  colorIndex: PLAYER_COLORS.length,
  hairIndex: HAIR_COLORS.length,
  hatIndex: HATS.length,
  faceIndex: FACES.length,
  backIndex: BACKS.length,
} as const;

/** Apply any subset of cosmetic slots, each clamped into its catalog. */
export function applyCosmetic(player: Player, choice: CosmeticMessage): void {
  const set = (slot: keyof typeof CATALOG_SIZE, value: number | undefined) => {
    if (value === undefined) return;
    player[slot] = clampIndex(value, COSMETIC_NONE_INDEX, CATALOG_SIZE[slot] - 1);
  };

  set("colorIndex", choice.colorIndex);
  set("hairIndex", choice.hairIndex);
  set("hatIndex", choice.hatIndex);
  set("faceIndex", choice.faceIndex);
  set("backIndex", choice.backIndex);
}
