/**
 * Tiny pure math helpers shared by the server sim and the client renderer.
 *
 * They live here (not duplicated on each side) because prediction only feels right
 * when both sides round-trip the exact same formula — e.g. `lerpAngle` was copied
 * into two client files before, which is exactly how facing-direction drift starts.
 */

/** One full turn in radians. Use instead of a bare `Math.PI * 2`. */
export const TAU = Math.PI * 2;

/** Degrees → radians. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Clamp `n` into [lo, hi]. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Clamp into [0, 1] — ratios for HP bars, easing curves, interpolation factors. */
export function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

/** Clamp to a whole number in [lo, hi] — for indexes arriving from a client. */
export function clampIndex(n: number, lo: number, hi: number): number {
  return clamp(Math.floor(n), lo, hi);
}

/** Linear interpolation. */
export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Shortest-path angle interpolation (radians) — never spins the long way round. */
export function lerpAngle(a: number, b: number, f: number): number {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * f;
}

/**
 * Frame-rate independent smoothing factor for an exponential approach.
 * `value += (target - value) * approach(rate, dt)` converges at the same speed
 * whether a client renders at 30fps or 144fps.
 */
export function approach(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/** A point on a circle of radius `r` at angle `a` (radians), as [x, z]. */
export function pointOnCircle(a: number, r: number): [number, number] {
  return [Math.cos(a) * r, Math.sin(a) * r];
}
