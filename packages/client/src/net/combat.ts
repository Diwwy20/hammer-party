/**
 * Transient combat FX, written by the network layer and polled per-frame by the
 * R3F scene. Deliberately NOT in the zustand store: swings/hits can fire many
 * times a second and must never trigger React re-renders. The game loop reads
 * these timestamps each frame to drive swing + hit-flash animations.
 */

/** id → performance.now() of that player's last swing. */
export const swingAt: Record<string, number> = {};
/** id → performance.now() of the last time that player got hit. */
export const hitAt: Record<string, number> = {};

/** Local player's current distance from arena centre — the game loop writes it so
 *  DOM HUD (out-of-zone warning) can read it without a per-frame React re-render. */
export const selfStat = { r: 0 };

export function markSwing(id: string): void {
  swingAt[id] = performance.now();
}

export function markHit(id: string): void {
  hitAt[id] = performance.now();
}

/** Clear everything on (re)connect so stale FX from a previous match don't leak. */
export function resetCombatFx(): void {
  for (const k in swingAt) delete swingAt[k];
  for (const k in hitAt) delete hitAt[k];
}
