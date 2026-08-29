import { describe, expect, it } from "vitest";
import { GamePhase } from "@hammer/shared";
import { NO_MOVEMENT, toWorld } from "./input";

/**
 * `toWorld` is the single place a screen-space stick becomes a world direction.
 * Both the prediction loop and the input sender call it, so if these two mappings
 * ever disagree the player walks one way and the server moves them another.
 */
describe("toWorld", () => {
  it("passes the stick straight through in a match — the eye cam already follows your facing", () => {
    expect(toWorld(0.6, -0.2, GamePhase.Playing)).toEqual({ dx: 0.6, dz: -0.2 });
  });

  it("mirrors x in the plaza, where the camera is fixed looking +z", () => {
    expect(toWorld(0.6, -0.2, GamePhase.Lobby)).toEqual({ dx: -0.6, dz: -0.2 });
  });

  it("keeps 'up on the stick' meaning 'away from the camera' in both phases", () => {
    expect(toWorld(0, 1, GamePhase.Lobby).dz).toBe(1);
    expect(toWorld(0, 1, GamePhase.Playing).dz).toBe(1);
  });

  it("is its own inverse in the plaza", () => {
    const once = toWorld(0.3, 0.9, GamePhase.Lobby);
    expect(toWorld(once.dx, once.dz, GamePhase.Lobby)).toEqual({ dx: 0.3, dz: 0.9 });
  });

  it("leaves a resting stick at rest — an idle thumb must never nudge the avatar", () => {
    for (const phase of Object.values(GamePhase)) {
      expect(toWorld(NO_MOVEMENT.dx, NO_MOVEMENT.dz, phase)).toEqual({ dx: 0, dz: 0 });
    }
  });

  it("preserves magnitude, so the server-side speed clamp still sees a unit vector", () => {
    const before = Math.hypot(0.6, -0.8);
    for (const phase of Object.values(GamePhase)) {
      const after = toWorld(0.6, -0.8, phase);
      expect(Math.hypot(after.dx, after.dz)).toBeCloseTo(before, 10);
    }
  });
});
