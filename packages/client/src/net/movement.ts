import { INTERP_DELAY_MS } from "@hammer/shared";

/** A player's transform as broadcast by the server. */
export interface Pos {
  x: number;
  z: number;
  dir: number;
}

interface Snapshot {
  t: number; // performance.now() when received
  pos: Record<string, Pos>;
}

/** Ring buffer of recent authoritative snapshots (~1.5s at 20Hz). */
const buffer: Snapshot[] = [];
const MAX_SNAPSHOTS = 30;

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
 * Position of `id` rendered INTERP_DELAY_MS in the past, lerped between the two
 * snapshots that bracket that render time — smooth motion for other players.
 */
export function sampleOther(id: string, now: number): Pos | null {
  const renderT = now - INTERP_DELAY_MS;

  let a: Snapshot | undefined;
  let b: Snapshot | undefined;
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i].t <= renderT) {
      a = buffer[i];
      b = buffer[i + 1];
      break;
    }
  }
  if (!a) a = buffer[0];
  if (!a || !a.pos[id]) return latest(id);
  const pa = a.pos[id];
  if (!b || !b.pos[id]) return pa;

  const span = b.t - a.t || 1;
  const f = clamp01((renderT - a.t) / span);
  return {
    x: lerp(pa.x, b.pos[id].x, f),
    z: lerp(pa.z, b.pos[id].z, f),
    dir: lerpAngle(pa.dir, b.pos[id].dir, f),
  };
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Shortest-path angle interpolation (radians). */
function lerpAngle(a: number, b: number, f: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
