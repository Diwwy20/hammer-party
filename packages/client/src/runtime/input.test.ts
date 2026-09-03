import { describe, expect, it } from "vitest";
import { CAMERA } from "../config/view";
import { NO_MOVEMENT, toWorld } from "./input";

/**
 * `toWorld` is the single place a screen-space stick becomes a world direction.
 * Both the prediction loop and the input sender call it, so if these two mappings
 * ever disagree the player walks one way and the server moves them another.
 *
 * There is exactly ONE mapping, for every phase and every view: each player camera
 * (plaza, match, ghost) looks down on the arena from the same fixed ISOMETRIC corner
 * and never rotates with the player's facing, so the stick means the same thing all
 * game long.
 *
 * The tests below are deliberately about PROPERTIES rather than about specific
 * numbers. The camera's yaw is a tuning value and it is allowed to change; what may
 * never change is that up on the stick is away from the camera, that the mapping is
 * a rotation, and that a resting thumb moves nobody.
 */
describe("toWorld", () => {
  it("sends 'up on the stick' away from the camera, along its own yaw", () => {
    const up = toWorld(0, 1);
    expect(up.dx).toBeCloseTo(Math.sin(CAMERA.isoYawRad), 10);
    expect(up.dz).toBeCloseTo(Math.cos(CAMERA.isoYawRad), 10);
  });

  it("sends 'right on the stick' a quarter turn clockwise from that", () => {
    const right = toWorld(1, 0);
    const up = toWorld(0, 1);
    // perpendicular to up, and on the correct side of it
    expect(right.dx * up.dx + right.dz * up.dz).toBeCloseTo(0, 10);
    expect(up.dx * right.dz - up.dz * right.dx).toBeGreaterThan(0);
  });

  it("leaves a resting stick at rest — an idle thumb must never nudge the avatar", () => {
    expect(toWorld(NO_MOVEMENT.dx, NO_MOVEMENT.dz)).toEqual({ dx: 0, dz: 0 });
  });

  it("preserves magnitude, so the server-side speed clamp still sees a unit vector", () => {
    const before = Math.hypot(0.6, -0.8);
    const after = toWorld(0.6, -0.8);
    expect(Math.hypot(after.dx, after.dz)).toBeCloseTo(before, 10);
  });

  it("is a rotation, not a mirror — opposite sticks give opposite directions", () => {
    const forward = toWorld(0.3, 0.9);
    const back = toWorld(-0.3, -0.9);
    expect(back.dx).toBeCloseTo(-forward.dx, 10);
    expect(back.dz).toBeCloseTo(-forward.dz, 10);
  });
});
