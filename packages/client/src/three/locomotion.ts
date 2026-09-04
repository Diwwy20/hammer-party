import { MODEL, MODEL_CLIP, type ModelClip } from "../config/view";

/**
 * Turning a ground speed into a clip and a playback rate.
 *
 * Both decisions are pure, and they are kept out of `ModelCharacter.tsx` so they
 * can be unit-tested without a canvas, a loader or a mixer — the house rule is
 * that a new rule goes in a pure function first and gets a test, and "which
 * animation is this person in" is exactly that kind of rule.
 */

/** The clip a character moving at this ground speed (m/s) should be playing. */
export function locomotionClip(speed: number): ModelClip {
  if (!(speed > MODEL.idleAboveSpeed)) return MODEL_CLIP.Idle;
  return speed > MODEL.runAboveSpeed ? MODEL_CLIP.Run : MODEL_CLIP.Walk;
}

/**
 * How fast to play that clip so the feet keep up with the floor.
 *
 * A canned walk travels at whatever speed it was authored for; a player being
 * interpolated toward a new position, shoved by knockback, or slid across a
 * rain-slicked floor is not moving at that speed. Scaling playback by the ratio is
 * the same distance-driven idea the hand-written walk cycle used, and it is what
 * stops 25 people reading as 25 objects being skated around a floor.
 *
 * It is CLAMPED because the honest ratio stops being convincing at the extremes: a
 * character shoved at 8 m/s should not run its legs at six times speed, it should
 * look like it has been shoved.
 */
export function locomotionTimeScale(clip: ModelClip, speed: number): number {
  if (clip === MODEL_CLIP.Idle) return 1;
  const authored = clip === MODEL_CLIP.Run ? MODEL.runClipSpeed : MODEL.walkClipSpeed;
  const ratio = speed / authored;
  if (!Number.isFinite(ratio)) return 1;
  return Math.min(MODEL.maxTimeScale, Math.max(MODEL.minTimeScale, ratio));
}
