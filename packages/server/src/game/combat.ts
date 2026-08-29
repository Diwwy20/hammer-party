import {
  DEFAULT_HAMMER,
  GamePhase,
  HAMMERS,
  HIT_MIN_DISTANCE,
  PRANK,
  PrankKind,
  ServerMsg,
  TAU,
  degToRad,
  type DiedEvent,
  type HammerKind,
  type HitEvent,
  type PrankEvent,
  type SwingEvent,
} from "@hammer/shared";
import { NO_SESSION, type Player } from "@hammer/shared/schema";
import type { SimContext } from "./context";

/**
 * Hit resolution, deaths and pranks — the authoritative answers to "did that land?".
 *
 * Hit detection is a reach + swing-cone check, NOT physics: for 25 players it has to
 * stay cheap, and it's accurate enough that a bonk always feels fair.
 */

/** The subset of a hammer that decides whether a swing connects. */
interface SwingShape {
  reach: number;
  arcDeg: number;
}

/** A pose in the XZ plane. */
interface Pose {
  x: number;
  z: number;
  dir: number;
}

/**
 * Unit vector from attacker to target when the swing connects, else `null`.
 * Pure — the whole hit rule lives here and can be reasoned about on its own.
 */
export function swingImpact(attacker: Pose, target: { x: number; z: number }, hammer: SwingShape) {
  const dx = target.x - attacker.x;
  const dz = target.z - attacker.z;
  const dist = Math.hypot(dx, dz);
  if (dist > hammer.reach || dist < HIT_MIN_DISTANCE) return null;

  // facing vector; the swing lands inside a cone of `arcDeg` around it
  const facingX = Math.sin(attacker.dir);
  const facingZ = Math.cos(attacker.dir);
  const alignment = (dx * facingX + dz * facingZ) / dist;
  if (alignment < Math.cos(degToRad(hammer.arcDeg))) return null;

  return { nx: dx / dist, nz: dz / dist };
}

/** The hammer a player is holding, falling back to the starter if the value is junk. */
export function hammerOf(player: Player) {
  return HAMMERS[player.hammer as HammerKind] ?? HAMMERS[DEFAULT_HAMMER];
}

/**
 * Resolve one swing. Knockback + stun land in EVERY phase (that's the lobby's
 * playful bonk); damage, kills and award tracking only happen in a live match.
 */
export function resolveAttack(ctx: SimContext, attackerId: string): void {
  const { state } = ctx;
  const isMatch = state.phase === GamePhase.Playing;
  if (!isMatch && state.phase !== GamePhase.Lobby) return;

  const attacker = state.players.get(attackerId);
  const attackerCombat = ctx.combat.get(attackerId);
  if (!attacker || !attacker.alive || !attackerCombat) return;

  const now = Date.now();
  if (now < attackerCombat.stunUntil) return;

  const hammer = hammerOf(attacker);
  if (now - attackerCombat.lastAttackAt < hammer.cooldownMs) return;
  attackerCombat.lastAttackAt = now;

  ctx.broadcast(ServerMsg.Swing, { id: attackerId, hammer: attacker.hammer } as SwingEvent);

  state.players.forEach((target, targetId) => {
    if (targetId === attackerId || !target.alive) return;
    const impact = swingImpact(attacker, target, hammer);
    if (!impact) return;

    const targetCombat = ctx.combat.get(targetId);
    if (targetCombat) {
      targetCombat.vx += impact.nx * hammer.knockback;
      targetCombat.vz += impact.nz * hammer.knockback;
      if (hammer.stunMs > 0) targetCombat.stunUntil = now + hammer.stunMs;
    }

    if (!isMatch) return; // lobby: no HP loss, no kills, no awards tracking

    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - hammer.dmg);
    attackerCombat.damageDealt += hpBefore - target.hp;
    ctx.broadcast(ServerMsg.Hit, {
      id: targetId,
      by: attackerId,
      dmg: hammer.dmg,
      hp: target.hp,
    } as HitEvent);

    if (target.hp <= 0) killPlayer(ctx, targetId, attackerId);
  });
}

/** Flip a player to spectator. `by` = attacker id for a kill credit, `NO_SESSION` for zone/wall. */
export function killPlayer(ctx: SimContext, id: string, by: string): void {
  const player = ctx.state.players.get(id);
  if (!player || !player.alive) return;

  player.alive = false;
  player.stunned = false;

  const combat = ctx.combat.get(id);
  if (combat) {
    combat.vx = 0;
    combat.vz = 0;
    combat.diedAtMs = ctx.state.elapsedMs;
  }

  if (by !== NO_SESSION) {
    const killer = ctx.state.players.get(by);
    if (killer) {
      killer.kills += 1;
      if (!ctx.match.firstBloodName) ctx.match.firstBloodName = killer.name;
    }
  }

  ctx.broadcast(ServerMsg.Died, { id, by } as DiedEvent);
  ctx.log.info(`☠ ${player.name} died (by ${by || "zone/wall"})`);
}

/** Apply damage that has no attacker behind it (the zone, a wall). Kills if it empties HP. */
export function applyEnvironmentDamage(
  ctx: SimContext,
  id: string,
  player: Player,
  dmg: number,
): boolean {
  player.hp = Math.max(0, player.hp - dmg);
  if (player.hp > 0) return false;
  killPlayer(ctx, id, NO_SESSION);
  return true;
}

/** The living player closest to `from`, or null when nobody is left standing. */
function nearestSurvivor(
  ctx: SimContext,
  from: { x: number; z: number },
): { id: string; player: Player } | null {
  let best: { id: string; player: Player } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  ctx.state.players.forEach((player, id) => {
    if (!player.alive) return;
    const distance = Math.hypot(player.x - from.x, player.z - from.z);
    if (distance >= bestDistance) return;
    bestDistance = distance;
    best = { id, player };
  });

  return best;
}

/**
 * A dead player lobs a prank at whoever they are floating nearest to. Harasses;
 * never eliminates — bomb damage is floored at `PRANK.minHpAfterBomb` so a
 * spectator can't take a kill.
 *
 * Targeting the NEAREST survivor (rather than a random one) is what makes ghost
 * movement worth doing: to bully someone in particular, go and hover over them.
 */
export function resolvePrank(ctx: SimContext, senderId: string, kind: PrankKind): void {
  if (ctx.state.phase !== GamePhase.Playing) return;

  const sender = ctx.state.players.get(senderId);
  const senderCombat = ctx.combat.get(senderId);
  if (!sender || sender.alive || !senderCombat) return; // only the DEAD may prank

  const now = Date.now();
  if (now - senderCombat.lastPrankAt < PRANK.cooldownMs) return;

  const victim = nearestSurvivor(ctx, sender);
  if (!victim) return;
  senderCombat.lastPrankAt = now;

  const { id: targetId, player: target } = victim;
  const targetCombat = ctx.combat.get(targetId);

  const angle = Math.random() * TAU;
  const shove = (knockback: number, stunMs: number) => {
    if (!targetCombat) return;
    targetCombat.vx += Math.cos(angle) * knockback;
    targetCombat.vz += Math.sin(angle) * knockback;
    targetCombat.stunUntil = now + stunMs;
  };

  if (kind === PrankKind.Banana) {
    shove(PRANK[PrankKind.Banana].knockback, PRANK[PrankKind.Banana].stunMs);
  } else {
    const bomb = PRANK[PrankKind.Bomb];
    target.hp = Math.max(PRANK.minHpAfterBomb, target.hp - bomb.dmg);
    shove(bomb.knockback, bomb.stunMs);
    ctx.broadcast(ServerMsg.Hit, {
      id: targetId,
      by: NO_SESSION,
      dmg: bomb.dmg,
      hp: target.hp,
    } as HitEvent);
  }

  ctx.broadcast(ServerMsg.Prank, { id: targetId, kind } as PrankEvent);
}
