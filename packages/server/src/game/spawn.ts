import { DEFAULT_HAMMER, HP_MAX, LOBBY_SPAWN_RADIUS, TAU, pointOnCircle } from "@hammer/shared";
import { NO_SESSION } from "@hammer/shared/schema";
import { createCombatState, type SimContext } from "./context";

/** Where a player is put, and what gets reset, at each entry point into the world. */

/** Face the middle of the world from wherever you're standing. */
function faceCentre(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/** Drop one player onto a random spot of the plaza ring (join, or back from a match). */
export function spawnIntoLobby(ctx: SimContext, id: string): void {
  const player = ctx.state.players.get(id);
  if (!player) return;

  const [x, z] = pointOnCircle(Math.random() * TAU, LOBBY_SPAWN_RADIUS);
  player.x = x;
  player.z = z;
  player.dir = faceCentre(x, z);
  ctx.inputs.set(id, { dx: 0, dz: 0 });
}

/**
 * Place everyone evenly around the stage's spawn ring and give them a clean slate:
 * full HP, alive, starting hammer, zeroed stats. Returns how many players started.
 */
export function spawnForMatch(ctx: SimContext): number {
  const ids = [...ctx.state.players.keys()];

  ids.forEach((id, index) => {
    const player = ctx.state.players.get(id);
    if (!player) return;

    const [x, z] = pointOnCircle((index / Math.max(1, ids.length)) * TAU, ctx.stage.spawnRadius);
    player.x = x;
    player.z = z;
    player.dir = faceCentre(x, z);
    player.hp = HP_MAX;
    player.alive = true;
    player.stunned = false;
    player.hammer = DEFAULT_HAMMER;
    player.kills = 0;

    ctx.inputs.set(id, { dx: 0, dz: 0 });
    ctx.combat.set(id, createCombatState());
  });

  ctx.state.winnerId = NO_SESSION;
  return ids.length;
}
