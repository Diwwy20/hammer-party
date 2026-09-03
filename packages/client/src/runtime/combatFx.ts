import type { PrankKind } from "@hammer/shared";
import { COMBAT_FX, DAMAGE_FX } from "../config/view";

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

/**
 * A fracture left in the flagstones where a hammer came down.
 *
 * Cracks live in the WORLD, not on the player who made them — the player walks away
 * and the damage to the floor does not. It is the one combat effect that outlasts
 * its own combat, which is precisely why it is worth having.
 */
export interface Crack {
  t: number;
  x: number;
  z: number;
  /** how far the painted star is turned, so no two smashes look like the same decal */
  spin: number;
}

/** Fractures currently on the floor. A ring buffer — the oldest is written over. */
export const cracks: Crack[] = [];

/** Record a smash at this spot on the floor. */
export function markCrack(x: number, z: number): void {
  cracks.push({ t: performance.now(), x, z, spin: Math.random() * Math.PI * 2 });
  if (cracks.length > COMBAT_FX.crackPool) cracks.shift();
}

/** One damage number, waiting to be picked up by a free tag in the overlay pool. */
export interface DamageHit {
  t: number;
  /** who took it — the tag follows them until it fades */
  id: string;
  dmg: number;
  /** true when this is damage YOU took: it gets its own colour */
  mine: boolean;
  /** where it drifts to, so two hits in the same instant don't stack up illegibly */
  spread: number;
}

/**
 * Damage numbers waiting to be drawn. A short queue, drained by the overlay pool
 * every frame: several blows can land in the same tick, and each one is only
 * interesting for nine hundred milliseconds.
 */
export const damageHits: DamageHit[] = [];

/** Record a blow for the floating number over the victim. */
export function markDamage(id: string, dmg: number, mine: boolean): void {
  if (dmg <= 0) return;
  damageHits.push({ t: performance.now(), id, dmg, mine, spread: Math.random() * 2 - 1 });
  // never queue more than the pool could ever show — the oldest is dropped unseen
  if (damageHits.length > DAMAGE_FX.pool) damageHits.shift();
}

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
  cracks.length = 0;
  damageHits.length = 0;
  prankThrownAt.t = 0;
}
