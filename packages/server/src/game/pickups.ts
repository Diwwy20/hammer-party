import {
  HEAL_ORB_HP,
  HP_MAX,
  PICKUP_RADIUS,
  PickupKind,
  WEAPON_RESPAWN_MS,
  isWeaponPickup,
  type PickupKind as PickupKindValue,
} from "@hammer/shared";
import { Pickup, type Player } from "@hammer/shared/schema";
import type { SimContext } from "./context";

/**
 * Everything on the floor: the stage's weapon hammers (respawn on a timer) and the
 * one-shot event items dropped by the Golden Hammer / Heal events.
 */

/** Pickup ids are prefixed by origin so the two families can never collide. */
const ID_PREFIX = {
  Weapon: "w",
  Event: "e",
} as const;

function makePickup(kind: PickupKindValue, x: number, z: number): Pickup {
  const pickup = new Pickup();
  pickup.kind = kind;
  pickup.x = x;
  pickup.z = z;
  pickup.active = true;
  return pickup;
}

/** Lay out the current stage's weapon spawns. Wipes anything from the previous match. */
export function spawnStageWeapons(ctx: SimContext): void {
  ctx.state.pickups.clear();
  ctx.match.pickupRespawnAt.clear();
  ctx.match.eventPickupSeq = 0;

  ctx.stage.weaponSpawns.forEach((spawn, index) => {
    ctx.state.pickups.set(`${ID_PREFIX.Weapon}${index}`, makePickup(spawn.kind, spawn.x, spawn.z));
  });
}

/** Drop a one-shot event item (golden hammer / heal orb) on the floor. */
export function addEventPickup(ctx: SimContext, kind: PickupKindValue, x: number, z: number): void {
  const id = `${ID_PREFIX.Event}${ctx.match.eventPickupSeq++}`;
  ctx.state.pickups.set(id, makePickup(kind, x, z));
}

/** Give a walked-over pickup to `player`, then either queue its respawn or remove it. */
function collect(ctx: SimContext, player: Player, pickup: Pickup, pickupId: string): void {
  pickup.active = false;

  if (pickup.kind === PickupKind.Heal) {
    player.hp = Math.min(HP_MAX, player.hp + HEAL_ORB_HP);
  } else {
    player.hammer = pickup.kind; // fast / heavy / golden
  }

  if (isWeaponPickup(pickup.kind)) {
    ctx.match.pickupRespawnAt.set(pickupId, ctx.state.elapsedMs + WEAPON_RESPAWN_MS);
  } else {
    ctx.state.pickups.delete(pickupId); // event items are one-shot
  }
}

/** Collect anything `player` is standing on. Called once per player per tick. */
export function collectPickupsAt(ctx: SimContext, player: Player, x: number, z: number): void {
  ctx.state.pickups.forEach((pickup, pickupId) => {
    if (!pickup.active) return;
    if (Math.hypot(x - pickup.x, z - pickup.z) <= PICKUP_RADIUS)
      collect(ctx, player, pickup, pickupId);
  });
}

/** Re-activate every weapon pickup whose respawn timer has elapsed. */
export function respawnDueWeapons(ctx: SimContext): void {
  const { pickupRespawnAt } = ctx.match;
  if (pickupRespawnAt.size === 0) return;

  pickupRespawnAt.forEach((respawnAtMs, pickupId) => {
    if (ctx.state.elapsedMs < respawnAtMs) return;
    const pickup = ctx.state.pickups.get(pickupId);
    if (pickup) pickup.active = true;
    pickupRespawnAt.delete(pickupId);
  });
}
