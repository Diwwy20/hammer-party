import {
  METEOR,
  RAIN,
  TAU,
  WeatherKind,
  HazardKind,
  HazardPhase,
  ServerMsg,
  clamp01,
  pointOnCircle,
  type BoomEvent,
  type HitEvent,
} from "@hammer/shared";
import { Hazard, NO_SESSION } from "@hammer/shared/schema";
import { applyEnvironmentDamage } from "./combat";
import type { SimContext } from "./context";

/**
 * Environmental events with a LIFETIME: the meteor storm and the rain.
 *
 * Unlike the pickup events (drop an item, done), these run over time, so each one
 * gets a schedule in the match bookkeeping and is advanced once per tick from
 * `stepHazards`. Everything a client must SEE (where a meteor will land, and for how
 * long) is synced as a `Hazard`; the schedule behind it stays server-only.
 */

/** Hazard ids are prefixed so they can never collide with a pickup id. */
const HAZARD_ID_PREFIX = "h";

/**
 * Blast damage at `distance` from the centre: full at the impact point, fading
 * linearly to nothing at the rim. Pure, so the falloff can be reasoned about (and
 * tested) without a running match.
 */
export function blastFalloff(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  return clamp01(1 - distance / radius);
}

/** Queue a full meteor storm. Strikes are dealt out one at a time by `stepHazards`. */
export function startMeteorStorm(ctx: SimContext): void {
  ctx.match.meteorsLeft = METEOR.count;
  ctx.match.nextMeteorAtMs = ctx.state.elapsedMs;
}

/** Open the rain window. Ends by itself once `RAIN.durationMs` has passed. */
export function startRain(ctx: SimContext): void {
  ctx.state.weather = WeatherKind.Rain;
  ctx.match.weatherUntilMs = ctx.state.elapsedMs + RAIN.durationMs;
}

/** True while the floor is slick — the movement step decays knockback far slower. */
export function isSlippery(ctx: SimContext): boolean {
  return ctx.state.weather === WeatherKind.Rain;
}

/** Advance every timed hazard: drop new meteors, land the due ones, clear the spent. */
export function stepHazards(ctx: SimContext): void {
  dropDueMeteor(ctx);
  resolveDueMeteors(ctx);
  clearExpiredWeather(ctx);
}

/** Everything a match must forget between rounds. */
export function clearHazards(ctx: SimContext): void {
  ctx.state.hazards.clear();
  ctx.state.weather = WeatherKind.Clear;
}

/**
 * Put the next warning marker down, somewhere inside the CURRENT safe zone — a
 * storm has to threaten where people actually are, not the dead ground they already
 * fled. The strike itself lands `METEOR.warnMs` later.
 */
function dropDueMeteor(ctx: SimContext): void {
  const { match, state } = ctx;
  if (match.meteorsLeft <= 0 || state.elapsedMs < match.nextMeteorAtMs) return;

  const [x, z] = pointOnCircle(
    Math.random() * TAU,
    Math.random() * state.zoneRadius * METEOR.spreadRatio,
  );

  const hazard = new Hazard();
  hazard.kind = HazardKind.Meteor;
  hazard.phase = HazardPhase.Warn;
  hazard.x = x;
  hazard.z = z;
  hazard.radius = METEOR.blastRadius;

  const id = `${HAZARD_ID_PREFIX}${match.hazardSeq++}`;
  state.hazards.set(id, hazard);
  match.meteors.set(id, {
    impactAtMs: state.elapsedMs + METEOR.warnMs,
    clearAtMs: state.elapsedMs + METEOR.warnMs + METEOR.scorchMs,
    landed: false,
  });

  match.meteorsLeft -= 1;
  match.nextMeteorAtMs = state.elapsedMs + METEOR.intervalMs;
}

/** Land any meteor whose warning has run out, then sweep up the spent craters. */
function resolveDueMeteors(ctx: SimContext): void {
  const { match, state } = ctx;
  if (match.meteors.size === 0) return;

  match.meteors.forEach((record, id) => {
    const hazard = state.hazards.get(id);
    if (!hazard) {
      match.meteors.delete(id);
      return;
    }

    if (!record.landed && state.elapsedMs >= record.impactAtMs) {
      record.landed = true;
      hazard.phase = HazardPhase.Impact;
      strike(ctx, hazard.x, hazard.z, hazard.radius);
    }

    if (state.elapsedMs >= record.clearAtMs) {
      state.hazards.delete(id);
      match.meteors.delete(id);
    }
  });
}

/** Resolve one impact: damage + shove everyone inside the blast, then announce it. */
function strike(ctx: SimContext, x: number, z: number, radius: number): void {
  ctx.broadcast(ServerMsg.Boom, { x, z, radius } as BoomEvent);

  const now = Date.now();
  ctx.state.players.forEach((player, id) => {
    if (!player.alive) return; // ghosts drift through a meteor storm untouched

    const dx = player.x - x;
    const dz = player.z - z;
    const distance = Math.hypot(dx, dz);
    if (distance > radius) return;

    const power = blastFalloff(distance, radius);
    const combat = ctx.combat.get(id);
    if (combat) {
      // straight up out of the crater when standing dead centre, else away from it
      const away = distance > 0 ? { x: dx / distance, z: dz / distance } : { x: 1, z: 0 };
      combat.vx += away.x * METEOR.knockback * power;
      combat.vz += away.z * METEOR.knockback * power;
      combat.stunUntil = now + METEOR.stunMs * power;
    }

    const dmg = METEOR.dmg * power;
    ctx.broadcast(ServerMsg.Hit, {
      id,
      by: NO_SESSION,
      dmg,
      hp: Math.max(0, player.hp - dmg),
    } as HitEvent);
    applyEnvironmentDamage(ctx, id, player, dmg);
  });
}

/** Turn the rain off once its window has passed. */
function clearExpiredWeather(ctx: SimContext): void {
  if (ctx.state.weather === WeatherKind.Clear) return;
  if (ctx.state.elapsedMs < ctx.match.weatherUntilMs) return;
  ctx.state.weather = WeatherKind.Clear;
}
