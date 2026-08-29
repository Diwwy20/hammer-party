/**
 * Per-frame facts about the local player, written by the R3F game loop and polled
 * by the DOM HUD.
 *
 * Same reason as `combatFx`: this changes every frame, so it lives outside React
 * (and outside the store) and is sampled on a timer instead of re-rendering.
 */
export const localPlayer = {
  /** current distance (m) from the arena centre — drives the out-of-zone warning. */
  distanceFromCentre: 0,
};
