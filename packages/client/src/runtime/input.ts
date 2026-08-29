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
 * Every player camera — plaza, match and ghost alike — is a FIXED-orientation follow
 * cam sitting behind the player and looking toward +z. So screen-up is world +z (z
 * passes straight through) and screen-right is world -x (x is flipped). Because no
 * camera ever rotates with your facing, this single mapping is correct in every
 * phase and the stick never changes meaning under you.
 */
export function toWorld(dx: number, dz: number): MoveVec {
  // `0 - dx` rather than `-dx`: negating a resting stick would yield -0, and a
  // vector that isn't canonically zero trips identity comparisons later on.
  return { dx: 0 - dx, dz };
}
