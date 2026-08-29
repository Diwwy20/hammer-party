import {
  KNOCKBACK_DECAY,
  KNOCKBACK_STOP_SPEED,
  LOBBY_RADIUS,
  MOVE_SPEED,
  PLAYER_RADIUS,
  WALL_SLAM_COOLDOWN_MS,
  ServerMsg,
  zoneRadiusAt,
  type HitEvent,
} from "@hammer/shared";
import { NO_SESSION, type Player } from "@hammer/shared/schema";
import { applyEnvironmentDamage, killPlayer } from "./combat";
import { collectPickupsAt, respawnDueWeapons } from "./pickups";
import type { CombatState, SimContext } from "./context";

/**
 * The authoritative movement step, in two flavours:
 *   - `stepLobby`  — plaza horseplay: walk + knockback only. No zone, no pickups, no HP.
 *   - `stepMatch`  — the real thing: adds wall-slam, the shrinking zone and pickups.
 *
 * Both share `integrate()`, so a bonk decays identically in the plaza and the arena.
 */

/** Where a player ended up this tick, before the wall is applied. */
interface Integrated {
  x: number;
  z: number;
  /** knockback speed BEFORE decay — what a wall-slam is judged on */
  knockbackSpeed: number;
}

/**
 * Advance one player by `dt`: apply their walk intent (unless stunned) and their
 * decaying knockback. Writes `stunned`/`dir` onto the player; returns the new
 * position for the caller to clamp against its own kind of wall.
 */
function integrate(
  ctx: SimContext,
  id: string,
  player: Player,
  dt: number,
  now: number,
  decay: number,
): Integrated {
  const combat = ctx.combat.get(id);
  const stunned = !!combat && now < combat.stunUntil;
  player.stunned = stunned;

  const knockbackSpeed = combat ? Math.hypot(combat.vx, combat.vz) : 0;
  let x = player.x;
  let z = player.z;

  const input = ctx.inputs.get(id);
  if (!stunned && input && (input.dx !== 0 || input.dz !== 0)) {
    x += input.dx * MOVE_SPEED * dt;
    z += input.dz * MOVE_SPEED * dt;
    player.dir = Math.atan2(input.dx, input.dz);
  }

  if (combat && (combat.vx !== 0 || combat.vz !== 0)) {
    x += combat.vx * dt;
    z += combat.vz * dt;
    combat.vx *= decay;
    combat.vz *= decay;
    if (Math.hypot(combat.vx, combat.vz) < KNOCKBACK_STOP_SPEED) {
      combat.vx = 0;
      combat.vz = 0;
    }
  }

  return { x, z, knockbackSpeed };
}

/** Stop dead at the wall (the plaza's soft edge, and the base case in a match). */
function clampToWall(x: number, z: number, maxRadius: number, combat?: CombatState) {
  const radius = Math.hypot(x, z);
  if (radius <= maxRadius) return { x, z, hitWall: false };
  if (combat) {
    combat.vx = 0;
    combat.vz = 0;
  }
  return { x: (x / radius) * maxRadius, z: (z / radius) * maxRadius, hitWall: true };
}

/** Exponential knockback decay for this tick length. */
const decayFor = (dt: number) => Math.exp(-KNOCKBACK_DECAY * dt);

/**
 * Plaza step. The lobby is horseplay only: people walk, bonk each other around and
 * bounce off a soft edge. Nothing here can cost HP.
 */
export function stepLobby(ctx: SimContext, deltaMs: number): void {
  const dt = deltaMs / 1000;
  const maxRadius = LOBBY_RADIUS - PLAYER_RADIUS;
  const now = Date.now();
  const decay = decayFor(dt);

  ctx.state.players.forEach((player, id) => {
    const moved = integrate(ctx, id, player, dt, now, decay);
    const clamped = clampToWall(moved.x, moved.z, maxRadius, ctx.combat.get(id));
    player.x = clamped.x;
    player.z = clamped.z;
  });
}

/**
 * Match step: movement + wall-slam + the shrinking zone + pickups.
 * Advances `elapsedMs`; the caller decides whether the match is over.
 */
export function stepMatch(ctx: SimContext, deltaMs: number): void {
  const dt = deltaMs / 1000;
  const { stage, state } = ctx;
  const maxRadius = stage.radius - PLAYER_RADIUS;
  const now = Date.now();
  const decay = decayFor(dt);

  state.zoneRadius = zoneRadiusAt(stage.zone, state.elapsedMs, stage.radius);
  const safeRadius = state.zoneRadius;

  state.players.forEach((player, id) => {
    if (!player.alive) return;

    const combat = ctx.combat.get(id);
    const moved = integrate(ctx, id, player, dt, now, decay);
    const clamped = clampToWall(moved.x, moved.z, maxRadius, combat);

    // hitting the wall hard enough is a wall-slam: extra damage + a brief stun
    if (clamped.hitWall && combat && isSlam(ctx, combat, moved.knockbackSpeed, now)) {
      if (registerWallSlam(ctx, id, player, combat, now)) return; // died on the wall
    }

    player.x = clamped.x;
    player.z = clamped.z;

    // outside the safe zone: bleed HP
    if (Math.hypot(player.x, player.z) > safeRadius) {
      if (applyEnvironmentDamage(ctx, id, player, stage.zone.dmgPerSec * dt)) return;
    }

    collectPickupsAt(ctx, player, player.x, player.z);
  });

  respawnDueWeapons(ctx);
  state.elapsedMs += deltaMs;
}

/** A slam needs real speed AND a cooled-down debounce, so edge-grinding isn't lethal. */
function isSlam(
  ctx: SimContext,
  combat: CombatState,
  knockbackSpeed: number,
  now: number,
): boolean {
  return (
    knockbackSpeed > ctx.stage.wallSlam.minSpeed && now - combat.lastSlamAt > WALL_SLAM_COOLDOWN_MS
  );
}

/** Apply a wall-slam. Returns true when it was fatal (the caller must stop touching the player). */
function registerWallSlam(
  ctx: SimContext,
  id: string,
  player: Player,
  combat: CombatState,
  now: number,
): boolean {
  const { wallSlam } = ctx.stage;
  combat.lastSlamAt = now;
  combat.vx = 0;
  combat.vz = 0;
  combat.wallSlamsTaken += 1;
  combat.stunUntil = now + wallSlam.stunMs;

  // the crunch is broadcast first so the FX plays before the ragdoll
  player.hp = Math.max(0, player.hp - wallSlam.dmg);
  ctx.broadcast(ServerMsg.Hit, {
    id,
    by: NO_SESSION,
    dmg: wallSlam.dmg,
    hp: player.hp,
  } as HitEvent);

  if (player.hp > 0) return false;
  killPlayer(ctx, id, NO_SESSION);
  return true;
}
