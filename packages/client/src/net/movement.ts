import { INTERP_DELAY_MS, TICK_RATE, clamp01, lerp, lerpAngle } from "@hammer/shared";

/**
 * The interpolation buffer: keep the last second or so of authoritative snapshots
 * and render OTHER players `INTERP_DELAY_MS` in the past, between the two snapshots
 * that bracket that moment. That delay is what turns a 20Hz stream into smooth
 * motion — the local player is predicted instead (see `three/World.tsx`).
 */

/** A player's transform as broadcast by the server. */
export interface Pos {
  x: number;
  z: number;
  dir: number;
}

interface Snapshot {
  /** `performance.now()` when the patch arrived */
  t: number;
  pos: Record<string, Pos>;
}

/** ~1.5s of history at the server tick rate — plenty to interpolate inside. */
const BUFFER_SECONDS = 1.5;
const MAX_SNAPSHOTS = Math.ceil(TICK_RATE * BUFFER_SECONDS);

const buffer: Snapshot[] = [];

export function recordSnapshot(pos: Record<string, Pos>): void {
  buffer.push({ t: performance.now(), pos });
  if (buffer.length > MAX_SNAPSHOTS) buffer.shift();
}

export function resetBuffer(): void {
  buffer.length = 0;
}

/** Most recent known position of `id`, or null if never seen. */
export function latest(id: string): Pos | null {
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i].pos[id]) return buffer[i].pos[id];
  }
  return null;
}

/**
 * Position of `id` rendered `INTERP_DELAY_MS` in the past, lerped between the two
 * snapshots that bracket that render time — smooth motion for other players.
 */
export function sampleOther(id: string, now: number): Pos | null {
  const renderAt = now - INTERP_DELAY_MS;

  let before: Snapshot | undefined;
  let after: Snapshot | undefined;
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i].t <= renderAt) {
      before = buffer[i];
      after = buffer[i + 1];
      break;
    }
  }
  if (!before) before = buffer[0];
  if (!before || !before.pos[id]) return latest(id); // no history yet — snap to newest

  const from = before.pos[id];
  if (!after || !after.pos[id]) return from; // nothing newer to lerp toward

  const to = after.pos[id];
  const span = after.t - before.t || 1;
  const f = clamp01((renderAt - before.t) / span);
  return {
    x: lerp(from.x, to.x, f),
    z: lerp(from.z, to.z, f),
    dir: lerpAngle(from.dir, to.dir, f),
  };
}
