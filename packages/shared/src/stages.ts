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
  /** short Thai label for the Host's stage picker (describes the vibe, not a lore name) */
  label: string;
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

/** Balanced default — a colosseum-style ring. Values are tuned in playtests. */
export const COLOSSEUM: StageConfig = {
  id: "colosseum",
  label: "สนามมาตรฐาน",
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

/** Close-quarters: a small hot pit — few weapons, hard walls, an early shrink. */
export const PIT: StageConfig = {
  id: "pit",
  label: "แดนประชิด",
  theme: "pit",
  radius: 17,
  spawnRadius: 17 * 0.7,
  zone: {
    startMs: 20_000,
    endMs: 8 * 60_000,
    minRadius: 2.5,
    dmgPerSec: 9,
  },
  weaponSpawns: [
    { kind: "heavy", x: 0, z: 0 },
    { kind: "fast", x: 8, z: 0 },
    { kind: "fast", x: -8, z: 0 },
  ],
  wallSlam: { dmg: 18, stunMs: 500, minSpeed: 4.5 },
};

/** Big battle: a wide arena, lots of pickups, a late but relentless shrink. */
export const GRAND: StageConfig = {
  id: "grand",
  label: "สังเวียนใหญ่",
  theme: "sky",
  radius: 30,
  spawnRadius: 30 * 0.68,
  zone: {
    startMs: 45_000,
    endMs: 14 * 60_000,
    minRadius: 3.5,
    dmgPerSec: 6,
  },
  weaponSpawns: [
    { kind: "heavy", x: 7, z: 7 },
    { kind: "heavy", x: -7, z: -7 },
    { kind: "heavy", x: 7, z: -7 },
    { kind: "heavy", x: -7, z: 7 },
    { kind: "fast", x: 15, z: 0 },
    { kind: "fast", x: -15, z: 0 },
    { kind: "fast", x: 0, z: 15 },
    { kind: "fast", x: 0, z: -15 },
  ],
  wallSlam: { dmg: 10, stunMs: 350, minSpeed: 5.5 },
};

/** Every stage the game knows about. Order = display order in the Host picker. */
export const STAGES: Record<string, StageConfig> = {
  [COLOSSEUM.id]: COLOSSEUM,
  [PIT.id]: PIT,
  [GRAND.id]: GRAND,
};

/** Stage ids in display order (object key order isn't guaranteed for UIs). */
export const STAGE_ORDER: readonly string[] = [COLOSSEUM.id, PIT.id, GRAND.id];

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
