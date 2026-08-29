import { describe, expect, it } from "vitest";
import { HAMMERS, HammerKind, HIT_MIN_DISTANCE, degToRad } from "@hammer/shared";
import { swingImpact } from "./combat";

/**
 * The whole hit rule lives in `swingImpact`: reach + a cone around the attacker's
 * facing. These are the cases that decide whether a bonk feels fair.
 *
 * Facing convention: `dir` is `atan2(dx, dz)`, so dir=0 faces +z.
 */

const HAMMER = { reach: 2, arcDeg: 60 };
const facingNorth = { x: 0, z: 0, dir: 0 }; // looking down +z

describe("swingImpact", () => {
  it("connects with a target straight ahead and inside reach", () => {
    const impact = swingImpact(facingNorth, { x: 0, z: 1.5 }, HAMMER);
    expect(impact).not.toBeNull();
    expect(impact!.nx).toBeCloseTo(0, 10);
    expect(impact!.nz).toBeCloseTo(1, 10);
  });

  it("returns a UNIT direction — knockback strength comes from the hammer, not the gap", () => {
    const near = swingImpact(facingNorth, { x: 0.3, z: 0.4 }, HAMMER)!;
    const far = swingImpact(facingNorth, { x: 0.9, z: 1.2 }, HAMMER)!;
    expect(Math.hypot(near.nx, near.nz)).toBeCloseTo(1, 10);
    expect(Math.hypot(far.nx, far.nz)).toBeCloseTo(1, 10);
    // same bearing, different distance → same direction
    expect(near.nx).toBeCloseTo(far.nx, 10);
    expect(near.nz).toBeCloseTo(far.nz, 10);
  });

  it("misses a target just past reach", () => {
    expect(swingImpact(facingNorth, { x: 0, z: HAMMER.reach - 0.01 }, HAMMER)).not.toBeNull();
    expect(swingImpact(facingNorth, { x: 0, z: HAMMER.reach + 0.01 }, HAMMER)).toBeNull();
  });

  it("misses someone standing behind you", () => {
    expect(swingImpact(facingNorth, { x: 0, z: -1.5 }, HAMMER)).toBeNull();
  });

  it("respects the cone edge", () => {
    const inside = degToRad(HAMMER.arcDeg - 5);
    const outside = degToRad(HAMMER.arcDeg + 5);
    const at = (angle: number) => ({ x: Math.sin(angle) * 1.5, z: Math.cos(angle) * 1.5 });

    expect(swingImpact(facingNorth, at(inside), HAMMER)).not.toBeNull();
    expect(swingImpact(facingNorth, at(-inside), HAMMER)).not.toBeNull();
    expect(swingImpact(facingNorth, at(outside), HAMMER)).toBeNull();
    expect(swingImpact(facingNorth, at(-outside), HAMMER)).toBeNull();
  });

  it("follows the attacker's facing, not the world axes", () => {
    const facingEast = { x: 0, z: 0, dir: Math.PI / 2 }; // +x
    expect(swingImpact(facingEast, { x: 1.5, z: 0 }, HAMMER)).not.toBeNull();
    expect(swingImpact(facingEast, { x: 0, z: 1.5 }, HAMMER)).toBeNull();
  });

  it("skips a target that is exactly on top of you — there is no usable direction", () => {
    expect(swingImpact(facingNorth, { x: 0, z: 0 }, HAMMER)).toBeNull();
    expect(swingImpact(facingNorth, { x: HIT_MIN_DISTANCE / 2, z: 0 }, HAMMER)).toBeNull();
  });

  it("gives the wide, long-reach golden hammer strictly more coverage than the fast one", () => {
    const fast = HAMMERS[HammerKind.Fast];
    const golden = HAMMERS[HammerKind.Golden];
    const wideTarget = { x: 2.4, z: 1.4 }; // ~60° off, ~2.8m away

    expect(swingImpact(facingNorth, wideTarget, fast)).toBeNull();
    expect(swingImpact(facingNorth, wideTarget, golden)).not.toBeNull();
  });
});
