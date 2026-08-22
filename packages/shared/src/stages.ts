import { ARENA_RADIUS, SPAWN_RADIUS, type HammerKind } from "./constants";

/**
 * A stage is DATA, not code — so future maps (rooftop/forest/factory/spaceship)
 * change only `{ radius, spawns, hazards, theme }` while the combat core stays the
 * same. The server owns the active stage; the client renders from `theme` + the
 * synced `zoneRadius`/pickups. Keep UI copy generic — never bake a stage name in.
 */

/** The shrinking safe zone. Outside it, players bleed HP; it accelerates late to force a finish. */
export interface ZoneConfig {
  /** grace period (ms after start) before the zone begins shrinking */
  startMs: number;
  /** ms after start when the zone reaches `minRadius` (hard finish pressure) */
  endMs: number;
  /** smallest safe radius (m) */
  minRadius: number;
  /** HP/sec lost while standing outside the safe zone */
  dmgPerSec: number;
}

/** A fixed weapon-pickup point. Fast/Heavy hammers respawn here after being taken. */
export interface WeaponSpawn {
  kind: Extract<HammerKind, "fast" | "heavy">;
  x: number;
  z: number;
}

/** Being knocked into the arena wall at speed = extra damage + a brief stun. */
export interface WallSlamConfig {
  dmg: number;
  stunMs: number;
  /** only knockback faster than this (m/s) counts as a slam (normal walking never does) */
  minSpeed: number;
}

export interface StageConfig {
  id: string;
  /** drives client visuals only (floor tint, props) — not gameplay */
  theme: string;
  /** starting arena radius (m) — the physical wall; the zone shrinks inside it */
  radius: number;
  /** ring radius (m) players spawn on */
  spawnRadius: number;
  zone: ZoneConfig;
  weaponSpawns: WeaponSpawn[];
  wallSlam: WallSlamConfig;
}

/** First playtest stage — a colosseum-style ring. Values are tuned in playtests. */
export const COLOSSEUM: StageConfig = {
  id: "colosseum",
  theme: "colosseum",
  radius: ARENA_RADIUS,
  spawnRadius: SPAWN_RADIUS,
  zone: {
    startMs: 30_000,
    endMs: 12 * 60_000,
    minRadius: 3,
    dmgPerSec: 6,
  },
  weaponSpawns: [
    { kind: "heavy", x: 5, z: 5 },
    { kind: "heavy", x: -5, z: -5 },
    { kind: "fast", x: 9, z: -9 },
    { kind: "fast", x: -9, z: 9 },
    { kind: "fast", x: 12, z: 0 },
    { kind: "fast", x: -12, z: 0 },
  ],
  wallSlam: { dmg: 12, stunMs: 400, minSpeed: 5 },
};

/** Every stage the game knows about (only one for now). */
export const STAGES: Record<string, StageConfig> = {
  [COLOSSEUM.id]: COLOSSEUM,
};

export const DEFAULT_STAGE_ID = COLOSSEUM.id;

/**
 * Current safe radius at `elapsedMs` into the match. Constant through the grace
 * period, then eases IN (t²) so the shrink accelerates late — the pressure that
 * forces a finish before the hard time cap.
 */
export function zoneRadiusAt(zone: ZoneConfig, elapsedMs: number, startRadius: number): number {
  if (elapsedMs <= zone.startMs) return startRadius;
  if (elapsedMs >= zone.endMs) return zone.minRadius;
  const t = (elapsedMs - zone.startMs) / (zone.endMs - zone.startMs);
  const eased = t * t;
  return startRadius + (zone.minRadius - startRadius) * eased;
}
