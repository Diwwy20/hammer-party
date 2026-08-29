import { GamePhase } from "@hammer/shared";

/**
 * Movement intent, and the one place that decides how a screen-space stick becomes
 * a world-space direction.
 *
 * Both control schemes (touch joystick, WASD) write the SAME raw vector, and both
 * the prediction loop and the input sender convert it with `toWorld` — so there is
 * exactly one mapping to get wrong.
 */

/** A movement intent. Screen-space until `toWorld` has been applied. */
export interface MoveVec {
  dx: number;
  dz: number;
}

export const NO_MOVEMENT: MoveVec = { dx: 0, dz: 0 };

/**
 * Screen-stick intent → world movement vector (the server treats input as world-space).
 *
 * In the plaza the camera is FIXED looking +z, so screen-right maps to world -x —
 * flip x, keep z (up = forward). In a match the first-person camera follows your
 * facing, so the raw stick is already world-correct and is used as-is.
 */
export function toWorld(dx: number, dz: number, phase: GamePhase): MoveVec {
  // `0 - dx` rather than `-dx`: negating a resting stick would yield -0, and a
  // vector that isn't canonically zero trips identity comparisons later on.
  return phase === GamePhase.Lobby ? { dx: 0 - dx, dz } : { dx, dz };
}
