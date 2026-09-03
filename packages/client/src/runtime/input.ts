import { HAMMERS, HammerKind } from "@hammer/shared";
import { CAMERA, HUD } from "../config/view";

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

/** The isometric camera's yaw, resolved once — the stick is rotated by exactly this. */
const YAW_SIN = Math.sin(CAMERA.isoYawRad);
const YAW_COS = Math.cos(CAMERA.isoYawRad);

/**
 * Screen-stick intent → world movement vector (the server treats input as world-space).
 *
 * Every player camera — plaza, match and ghost alike — looks down on the arena from
 * the same fixed ISOMETRIC corner and never rotates with your facing. So the stick's
 * axes are the camera's axes, turned by that one yaw:
 *
 *   screen-up    → the world direction away from the camera, `(sin, cos)`
 *   screen-right → a quarter turn clockwise from it, `(-cos, sin)`
 *
 * Because nothing ever rotates, this single mapping is correct in every phase and
 * the stick never changes meaning under the player. It is also the ONLY place the
 * camera angle leaks into movement: both the prediction loop and the input sender
 * call this, so there is exactly one mapping to get wrong.
 */
export function toWorld(dx: number, dz: number): MoveVec {
  return {
    dx: dz * YAW_SIN - dx * YAW_COS,
    dz: dz * YAW_COS + dx * YAW_SIN,
  };
}

/**
 * How often a HELD attack (thumb on the button, or Space down) fires, for the
 * hammer the player is carrying.
 *
 * It follows that hammer's own cooldown, a shade under it so the swing goes the
 * instant the cooldown lifts. A fixed rate fired three times per swing of the
 * starting hammer: the server threw two of those away, but the client's own swing
 * animation restarted on every one, so a player holding attack stood there
 * twitching through the wind-up and never landed a visible blow.
 *
 * Both control schemes ask this one function, for the same reason they share
 * `toWorld`.
 */
export function swingRepeatMs(hammer: string): number {
  const stats = HAMMERS[hammer as HammerKind] ?? HAMMERS[HammerKind.Mid];
  return stats.cooldownMs * HUD.swingRepeatOfCooldown;
}
