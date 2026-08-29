import type { PrankKind } from "@hammer/shared";

/**
 * Transient combat FX, written by the network layer and polled per-frame by the
 * R3F scene.
 *
 * Deliberately NOT in the zustand store: swings/hits can fire many times a second
 * and must never trigger React re-renders. The game loop reads these timestamps
 * each frame to drive swing + hit-flash + prank animations.
 */

/** id → `performance.now()` of that player's last swing. */
export const swingAt: Record<string, number> = {};

/** id → `performance.now()` of the last time that player got hit. */
export const hitAt: Record<string, number> = {};

/** id → the last prank that landed on that player (for the floating 🍌/💣 FX). */
export const prankAt: Record<string, { t: number; kind: PrankKind }> = {};

export function markSwing(id: string): void {
  swingAt[id] = performance.now();
}

export function markHit(id: string): void {
  hitAt[id] = performance.now();
}

export function markPrank(id: string, kind: PrankKind): void {
  prankAt[id] = { t: performance.now(), kind };
}

/** Clear everything on (re)connect so stale FX from a previous match don't leak. */
export function resetCombatFx(): void {
  for (const key of Object.keys(swingAt)) delete swingAt[key];
  for (const key of Object.keys(hitAt)) delete hitAt[key];
  for (const key of Object.keys(prankAt)) delete prankAt[key];
}
