import type { PrankKind } from "@hammer/shared";

/**
 * Transient combat FX, written by the network layer and polled per-frame by the
 * R3F scene.
 *
 * Deliberately NOT in the zustand store: swings/hits can fire many times a second
 * and must never trigger React re-renders. The game loop reads these timestamps
 * each frame to drive swing + hit-flash + prank + blast animations.
 */

/** id → `performance.now()` of that player's last swing. */
export const swingAt: Record<string, number> = {};

/** id → `performance.now()` of the last time that player got hit. */
export const hitAt: Record<string, number> = {};

/** id → `performance.now()` at which that player was defeated (drives the death poof). */
export const diedAt: Record<string, number> = {};

/** id → the last prank that landed on that player (for the floating 🍌/💣 FX). */
export const prankAt: Record<string, { t: number; kind: PrankKind } | undefined> = {};

/** One meteor impact, kept only long enough to animate the flash and shockwave. */
export interface Blast {
  t: number;
  x: number;
  z: number;
  radius: number;
}

/**
 * Meteor impacts still being animated. A short queue rather than a map: several can
 * overlap during a storm, and each one is only interesting for a few hundred ms.
 */
export const blasts: Blast[] = [];

/** Never animate more than this many overlapping blasts — the oldest is dropped. */
const MAX_BLASTS = 8;

/**
 * When each hazard was first SEEN by this client. The server syncs where a meteor
 * will land, not the countdown; the client animates the fall from the moment the
 * marker arrives, which is exact enough for something purely visual.
 */
export const hazardSeenAt: Record<string, number> = {};

/** `performance.now()` of this client's last prank throw — drives the cooldown dial. */
export const prankThrownAt = { t: 0 };

export function markSwing(id: string): void {
  swingAt[id] = performance.now();
}

export function markHit(id: string): void {
  hitAt[id] = performance.now();
}

export function markDied(id: string): void {
  diedAt[id] = performance.now();
}

export function markPrank(id: string, kind: PrankKind): void {
  prankAt[id] = { t: performance.now(), kind };
}

export function markPrankThrown(): void {
  prankThrownAt.t = performance.now();
}

/** Record a meteor impact for the flash/shockwave FX. */
export function markBoom(x: number, z: number, radius: number): void {
  blasts.push({ t: performance.now(), x, z, radius });
  if (blasts.length > MAX_BLASTS) blasts.shift();
}

/** Stamp the moment a hazard marker first appeared, so its fall can be animated. */
export function seeHazard(id: string): number {
  return (hazardSeenAt[id] ??= performance.now());
}

/** Clear everything on (re)connect so stale FX from a previous match don't leak. */
export function resetCombatFx(): void {
  for (const bag of [swingAt, hitAt, diedAt, prankAt, hazardSeenAt]) {
    for (const key of Object.keys(bag)) delete (bag as Record<string, unknown>)[key];
  }
  blasts.length = 0;
  prankThrownAt.t = 0;
}
