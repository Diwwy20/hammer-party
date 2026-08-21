/**
 * Single source of truth for game numbers — imported by BOTH client and server.
 * Tuning happens here so damage/HP/tick never drift between the two.
 * (GDD v0.1: HP=600, dmg 2/5/20, tick 20Hz. Numbers are placeholders to tune in Phase 02.)
 */

/** Server simulation frequency (Hz). */
export const TICK_RATE = 20;

/** Everyone starts here — high HP so a match lasts 15–20 min. */
export const HP_MAX = 600;

/** Room cap (25 players + 1 invisible host who isn't counted). */
export const MAX_PLAYERS = 25;

/** Hard match cap; the shrinking zone forces an end before this. */
export const MATCH_MAX_MINUTES = 20;

/** Colosseum arena radius (meters) at match start, before the zone shrinks. */
export const ARENA_RADIUS = 24;

/** Placeholder walk speed (m/s) — real movement lands in Phase 01. */
export const MOVE_SPEED = 5;

export type HammerKind = "fast" | "mid" | "heavy";

/**
 * The 3 hammers. Everyone starts on `mid`; `fast`/`heavy` spawn as map pickups.
 * What matters is the RATIO between them, not the exact numbers (GDD).
 */
export const HAMMERS: Record<
  HammerKind,
  { readonly label: string; readonly dmg: number; readonly cooldownMs: number; readonly knockback: number }
> = {
  fast: { label: "ฆ้อนเร็ว", dmg: 2, cooldownMs: 220, knockback: 4 },
  mid: { label: "ฆ้อนกลาง", dmg: 5, cooldownMs: 420, knockback: 7 },
  heavy: { label: "ฆ้อนแรง", dmg: 20, cooldownMs: 900, knockback: 14 },
};

export const DEFAULT_HAMMER: HammerKind = "mid";

/** Colyseus room name used by both sides for joinOrCreate/define. */
export const ROOM_NAME = "game";
