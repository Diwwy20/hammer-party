import { describe, expect, it } from "vitest";
import { NO_MOVEMENT, toWorld } from "./input";

/**
 * `toWorld` is the single place a screen-space stick becomes a world direction.
 * Both the prediction loop and the input sender call it, so if these two mappings
 * ever disagree the player walks one way and the server moves them another.
 *
 * There is exactly ONE mapping, for every phase and every view: each player camera
 * (plaza, match, ghost) sits behind the player looking toward +z and never rotates
 * with their facing, so the stick means the same thing all game long.
 */
describe("toWorld", () => {
  it("mirrors x, because a camera looking +z has world -x on its right", () => {
    expect(toWorld(0.6, -0.2)).toEqual({ dx: -0.6, dz: -0.2 });
  });

  it("keeps 'up on the stick' meaning 'away from the camera'", () => {
    expect(toWorld(0, 1).dz).toBe(1);
  });

  it("is its own inverse", () => {
    const once = toWorld(0.3, 0.9);
    expect(toWorld(once.dx, once.dz)).toEqual({ dx: 0.3, dz: 0.9 });
  });

  it("leaves a resting stick at rest — an idle thumb must never nudge the avatar", () => {
    expect(toWorld(NO_MOVEMENT.dx, NO_MOVEMENT.dz)).toEqual({ dx: 0, dz: 0 });
  });

  it("preserves magnitude, so the server-side speed clamp still sees a unit vector", () => {
    const before = Math.hypot(0.6, -0.8);
    const after = toWorld(0.6, -0.8);
    expect(Math.hypot(after.dx, after.dz)).toBeCloseTo(before, 10);
  });
});
