import { describe, expect, it } from "vitest";
import { PLAYER_RADIUS } from "./constants";
import { StageId } from "./enums";
import { TAU, pointOnCircle } from "./math";
import {
  COLOSSEUM,
  DEFAULT_STAGE_ID,
  STAGES,
  STAGE_ORDER,
  findStage,
  pushOutOfObstacles,
  zoneRadiusAt,
} from "./stages";

describe("zoneRadiusAt", () => {
  const zone = { startMs: 30_000, endMs: 120_000, minRadius: 3, dmgPerSec: 6 };
  const startRadius = 24;

  it("holds the full radius through the grace period", () => {
    expect(zoneRadiusAt(zone, 0, startRadius)).toBe(startRadius);
    expect(zoneRadiusAt(zone, zone.startMs, startRadius)).toBe(startRadius);
  });

  it("reaches minRadius exactly at endMs, and stays there", () => {
    expect(zoneRadiusAt(zone, zone.endMs, startRadius)).toBe(zone.minRadius);
    expect(zoneRadiusAt(zone, zone.endMs * 10, startRadius)).toBe(zone.minRadius);
  });

  it("only ever shrinks", () => {
    let previous = Infinity;
    for (let t = 0; t <= zone.endMs; t += 1_000) {
      const radius = zoneRadiusAt(zone, t, startRadius);
      expect(radius).toBeLessThanOrEqual(previous);
      previous = radius;
    }
  });

  it("accelerates late — that is the pressure that forces a finish", () => {
    const span = zone.endMs - zone.startMs;
    const early = zoneRadiusAt(zone, zone.startMs + span * 0.25, startRadius);
    const mid = zoneRadiusAt(zone, zone.startMs + span * 0.5, startRadius);
    const late = zoneRadiusAt(zone, zone.startMs + span * 0.75, startRadius);

    const firstHalfDrop = early - mid;
    const secondHalfDrop = mid - late;
    expect(secondHalfDrop).toBeGreaterThan(firstHalfDrop);
  });

  it("is still inside the arena at the halfway mark (nobody is squeezed early)", () => {
    const half = zoneRadiusAt(zone, (zone.startMs + zone.endMs) / 2, startRadius);
    expect(half).toBeLessThan(startRadius);
    expect(half).toBeGreaterThan(zone.minRadius);
  });
});

describe("findStage", () => {
  it("returns the config for a known id", () => {
    expect(findStage(StageId.Pit)?.id).toBe(StageId.Pit);
  });

  it("returns undefined for anything else — an unknown id must not crash a match start", () => {
    expect(findStage("rooftop")).toBeUndefined();
    expect(findStage("")).toBeUndefined();
    expect(findStage("__proto__")).toBeUndefined();
  });
});

describe("stage catalog", () => {
  it("lists every stage exactly once, in picker order", () => {
    expect([...STAGE_ORDER].sort()).toEqual(Object.keys(STAGES).sort());
    expect(new Set(STAGE_ORDER).size).toBe(STAGE_ORDER.length);
  });

  it("has a default that actually exists", () => {
    expect(STAGES[DEFAULT_STAGE_ID]).toBe(COLOSSEUM);
  });

  it("keeps every stage internally consistent", () => {
    for (const id of STAGE_ORDER) {
      const stage = STAGES[id];
      // players must spawn inside the wall, and the zone must end smaller than it starts
      expect(stage.spawnRadius).toBeLessThan(stage.radius);
      expect(stage.zone.minRadius).toBeLessThan(stage.radius);
      expect(stage.zone.startMs).toBeLessThan(stage.zone.endMs);
      // every weapon spawn has to be reachable, i.e. on the floor
      for (const spawn of stage.weaponSpawns) {
        expect(Math.hypot(spawn.x, spawn.z)).toBeLessThan(stage.radius);
      }
      expect(stage.label.length).toBeGreaterThan(0);
    }
  });
});

describe("pushOutOfObstacles", () => {
  const BODY = PLAYER_RADIUS;
  const PROP = COLOSSEUM.obstacles[0];

  it("leaves a body that is clear of everything exactly where it was", () => {
    const free = pushOutOfObstacles(0, 0, BODY, COLOSSEUM.obstacles);
    expect(free).toEqual({ x: 0, z: 0 });
  });

  it("pushes an overlapping body out to the surface, along the way it came in", () => {
    // just inside the prop, approached from +x
    const start = { x: PROP.x + PROP.radius * 0.5, z: PROP.z };
    const free = pushOutOfObstacles(start.x, start.z, BODY, COLOSSEUM.obstacles);

    expect(Math.hypot(free.x - PROP.x, free.z - PROP.z)).toBeCloseTo(PROP.radius + BODY);
    expect(free.z).toBeCloseTo(PROP.z); // no sideways teleport
    expect(free.x).toBeGreaterThan(PROP.x);
  });

  it("never leaves a body inside any prop, from any approach", () => {
    for (const stage of Object.values(STAGES)) {
      for (const obstacle of stage.obstacles) {
        for (let a = 0; a < TAU; a += TAU / 16) {
          const [dx, dz] = pointOnCircle(a, obstacle.radius * 0.3);
          const free = pushOutOfObstacles(
            obstacle.x + dx,
            obstacle.z + dz,
            PLAYER_RADIUS,
            stage.obstacles,
          );
          const gap = Math.hypot(free.x - obstacle.x, free.z - obstacle.z);
          expect(gap).toBeGreaterThanOrEqual(obstacle.radius + PLAYER_RADIUS - 1e-9);
        }
      }
    }
  });

  it("shoves a body stuck at a prop's dead centre somewhere legal", () => {
    const free = pushOutOfObstacles(PROP.x, PROP.z, BODY, [PROP]);
    expect(Math.hypot(free.x - PROP.x, free.z - PROP.z)).toBeCloseTo(PROP.radius + BODY);
  });
});

describe("stage props", () => {
  it("keeps every weapon spawn reachable — never buried inside cover", () => {
    for (const id of STAGE_ORDER) {
      const stage = STAGES[id];
      for (const spawn of stage.weaponSpawns) {
        for (const obstacle of stage.obstacles) {
          const gap = Math.hypot(spawn.x - obstacle.x, spawn.z - obstacle.z);
          expect(gap).toBeGreaterThan(obstacle.radius + PLAYER_RADIUS);
        }
      }
    }
  });

  it("keeps every prop inside the wall it belongs to", () => {
    for (const id of STAGE_ORDER) {
      const stage = STAGES[id];
      for (const obstacle of stage.obstacles) {
        expect(Math.hypot(obstacle.x, obstacle.z) + obstacle.radius).toBeLessThan(stage.radius);
      }
    }
  });
});
