import { ARENA_RADIUS, SPAWN_RADIUS_RATIO } from "./constants";
import { HammerKind, ObstacleKind, StageId, StageTheme, type WeaponKind } from "./enums";

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
  kind: WeaponKind;
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

/**
 * A solid prop. Blocks movement on BOTH sides — the server clamps players out of it
 * and the client's prediction runs the exact same `pushOutOfObstacles`, so cover
 * never disagrees between what you see and where you actually are.
 */
export interface Obstacle {
  kind: ObstacleKind;
  x: number;
  z: number;
  /** solid radius (m) — nobody's capsule may overlap this circle */
  radius: number;
  /** how tall it stands (m). Visual only; there is no vertical movement to block. */
  height: number;
}

/**
 * How dressed the stage is. These are COUNTS and toggles (layout), not colours —
 * what a banner or a torch actually looks like is the client's business
 * (`client/src/config/theme.ts`).
 */
export interface StageDecor {
  /** tiered spectator seating ringing the arena */
  stands: boolean;
  /** stone columns spaced evenly around the wall */
  columns: number;
  /** cloth banners hung between the columns */
  banners: number;
  /** flaming braziers just outside the wall */
  torches: number;
  /** drifting cloud slabs in the sky (for the floating stages) */
  clouds: number;
}

export interface StageConfig {
  id: StageId;
  /** short Thai label for the Host's stage picker (describes the vibe, not a lore name) */
  label: string;
  /** drives client visuals only (floor tint, props) — not gameplay */
  theme: StageTheme;
  /** starting arena radius (m) — the physical wall; the zone shrinks inside it */
  radius: number;
  /** ring radius (m) players spawn on */
  spawnRadius: number;
  zone: ZoneConfig;
  weaponSpawns: WeaponSpawn[];
  /** solid cover players walk around (gameplay — both sides collide with it) */
  obstacles: Obstacle[];
  /** how the stage is dressed (presentation counts; colours live on the client) */
  decor: StageDecor;
  wallSlam: WallSlamConfig;
}

/** Shorthand for the two prop shapes, so a layout row stays readable. */
const pillar = (x: number, z: number): Obstacle => ({
  kind: ObstacleKind.Pillar,
  x,
  z,
  radius: 1,
  height: 4.6,
});

const crate = (x: number, z: number): Obstacle => ({
  kind: ObstacleKind.Crate,
  x,
  z,
  radius: 0.8,
  height: 1.3,
});

/** Below this separation (m) an obstacle has no usable push-out direction. */
const OBSTACLE_MIN_DISTANCE = 1e-4;

/** One minute in ms — zone timings read far better in minutes. */
const MINUTE_MS = 60_000;

/**
 * The showcase stage — a dressed arena ringed by stands, columns and braziers, with
 * four stone pillars for cover and low crates further out. The pillars sit off the
 * weapon spawns on purpose: you fight AROUND them to reach a hammer.
 */
export const COLOSSEUM: StageConfig = {
  id: StageId.Colosseum,
  label: "สนามประลอง",
  theme: StageTheme.Colosseum,
  radius: ARENA_RADIUS,
  spawnRadius: ARENA_RADIUS * SPAWN_RADIUS_RATIO,
  zone: {
    startMs: 30_000,
    endMs: 12 * MINUTE_MS,
    minRadius: 3,
    dmgPerSec: 6,
  },
  weaponSpawns: [
    { kind: HammerKind.Heavy, x: 5, z: 5 },
    { kind: HammerKind.Heavy, x: -5, z: -5 },
    { kind: HammerKind.Fast, x: 9, z: -9 },
    { kind: HammerKind.Fast, x: -9, z: 9 },
    { kind: HammerKind.Fast, x: 12, z: 0 },
    { kind: HammerKind.Fast, x: -12, z: 0 },
  ],
  obstacles: [
    pillar(8, 0),
    pillar(0, 8),
    pillar(-8, 0),
    pillar(0, -8),
    crate(11, 4),
    crate(-11, -4),
    crate(4, -11),
    crate(-4, 11),
  ],
  decor: { stands: true, columns: 20, banners: 10, torches: 8, clouds: 0 },
  wallSlam: { dmg: 12, stunMs: 400, minSpeed: 5 },
};

/** Close-quarters: a small hot pit — few weapons, hard walls, an early shrink. */
const PIT_RADIUS = 17;
export const PIT: StageConfig = {
  id: StageId.Pit,
  label: "แดนประชิด",
  theme: StageTheme.Pit,
  radius: PIT_RADIUS,
  spawnRadius: PIT_RADIUS * 0.7,
  zone: {
    startMs: 20_000,
    endMs: 8 * MINUTE_MS,
    minRadius: 2.5,
    dmgPerSec: 9,
  },
  weaponSpawns: [
    { kind: HammerKind.Heavy, x: 0, z: 0 },
    { kind: HammerKind.Fast, x: 8, z: 0 },
    { kind: HammerKind.Fast, x: -8, z: 0 },
  ],
  obstacles: [crate(0, 6), crate(0, -6), crate(6, 0), crate(-6, 0)],
  decor: { stands: false, columns: 12, banners: 6, torches: 6, clouds: 0 },
  wallSlam: { dmg: 18, stunMs: 500, minSpeed: 4.5 },
};

/** Big battle: a wide arena, lots of pickups, a late but relentless shrink. */
const GRAND_RADIUS = 30;
export const GRAND: StageConfig = {
  id: StageId.Grand,
  label: "สังเวียนใหญ่",
  theme: StageTheme.Sky,
  radius: GRAND_RADIUS,
  spawnRadius: GRAND_RADIUS * 0.68,
  zone: {
    startMs: 45_000,
    endMs: 14 * MINUTE_MS,
    minRadius: 3.5,
    dmgPerSec: 6,
  },
  weaponSpawns: [
    { kind: HammerKind.Heavy, x: 7, z: 7 },
    { kind: HammerKind.Heavy, x: -7, z: -7 },
    { kind: HammerKind.Heavy, x: 7, z: -7 },
    { kind: HammerKind.Heavy, x: -7, z: 7 },
    { kind: HammerKind.Fast, x: 15, z: 0 },
    { kind: HammerKind.Fast, x: -15, z: 0 },
    { kind: HammerKind.Fast, x: 0, z: 15 },
    { kind: HammerKind.Fast, x: 0, z: -15 },
  ],
  obstacles: [pillar(11, 11), pillar(-11, -11), pillar(11, -11), pillar(-11, 11)],
  decor: { stands: false, columns: 0, banners: 8, torches: 0, clouds: 9 },
  wallSlam: { dmg: 10, stunMs: 350, minSpeed: 5.5 },
};

/** Every stage the game knows about. Order = display order in the Host picker. */
export const STAGES: Record<StageId, StageConfig> = {
  [StageId.Colosseum]: COLOSSEUM,
  [StageId.Pit]: PIT,
  [StageId.Grand]: GRAND,
};

/** Stage ids in display order (object key order isn't guaranteed for UIs). */
export const STAGE_ORDER: readonly StageId[] = [StageId.Colosseum, StageId.Pit, StageId.Grand];

export const DEFAULT_STAGE_ID: StageId = COLOSSEUM.id;

/**
 * Narrow an untrusted stage id (from a Host message) to a known stage, or `undefined`.
 * The own-property check matters: a plain `STAGES[id]` lookup would happily return
 * `Object.prototype` for the id `"__proto__"`.
 */
export function findStage(stageId: string): StageConfig | undefined {
  if (!Object.prototype.hasOwnProperty.call(STAGES, stageId)) return undefined;
  return STAGES[stageId as StageId];
}

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

/**
 * Push a body out of any obstacle it overlaps.
 *
 * Pure on purpose: the server calls it in `stepMatch` and the client calls it in the
 * prediction loop, so a pillar is in exactly the same place for both. Obstacles are
 * treated as circles — for chunky low-poly cover that reads perfectly and costs a
 * hypot per prop, which matters at 25 players × 20Hz.
 *
 * A body somehow at a prop's exact centre is nudged along +x rather than dividing by
 * zero, so it always ends up somewhere legal.
 */
export function pushOutOfObstacles(
  x: number,
  z: number,
  bodyRadius: number,
  obstacles: readonly Obstacle[],
): { x: number; z: number } {
  let outX = x;
  let outZ = z;

  for (const obstacle of obstacles) {
    const dx = outX - obstacle.x;
    const dz = outZ - obstacle.z;
    const minGap = obstacle.radius + bodyRadius;
    const dist = Math.hypot(dx, dz);
    if (dist >= minGap) continue;

    if (dist < OBSTACLE_MIN_DISTANCE) {
      outX = obstacle.x + minGap;
      outZ = obstacle.z;
      continue;
    }
    outX = obstacle.x + (dx / dist) * minGap;
    outZ = obstacle.z + (dz / dist) * minGap;
  }

  return { x: outX, z: outZ };
}
