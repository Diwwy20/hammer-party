import {
  AUTO_EVENT_AT_MS,
  EVENT_BANNER_MS,
  EventKind,
  HEAL_ORB_COUNT,
  HEAL_ORB_RING_RADIUS,
  PickupKind,
  TAU,
  pointOnCircle,
} from "@hammer/shared";
import { NO_SESSION } from "@hammer/shared/schema";
import { startMeteorStorm, startRain } from "./hazards";
import { addEventPickup } from "./pickups";
import type { SimContext } from "./context";

/**
 * Random events: what each one does to the world, and when it fires by itself.
 *
 * Two families, deliberately: the PICKUP events drop something on the floor and are
 * finished; the WEATHER events (meteor storm, rain) open a window that `hazards.ts`
 * then advances tick by tick. Either way this module only decides WHICH — the rules
 * live where they belong.
 *
 * The banner is published as an event KIND, not a sentence — wording is the
 * client's job (`client/src/config/copy.ts`), so no Thai copy lives in the sim.
 */

/** Centre of every stage — where the Golden Hammer lands. */
const ARENA_CENTRE = { x: 0, z: 0 } as const;

/** What each event actually does. Every `EventKind` must have an entry. */
const EVENT_ACTIONS: Record<EventKind, (ctx: SimContext) => void> = {
  [EventKind.Golden]: (ctx) => {
    addEventPickup(ctx, PickupKind.Golden, ARENA_CENTRE.x, ARENA_CENTRE.z);
  },
  [EventKind.Heal]: (ctx) => {
    for (let i = 0; i < HEAL_ORB_COUNT; i++) {
      const [x, z] = pointOnCircle((i / HEAL_ORB_COUNT) * TAU, HEAL_ORB_RING_RADIUS);
      addEventPickup(ctx, PickupKind.Heal, x, z);
    }
  },
  [EventKind.Meteor]: startMeteorStorm,
  [EventKind.Rain]: startRain,
};

/** Run this event and raise its banner. */
export function fireEvent(ctx: SimContext, kind: EventKind): void {
  EVENT_ACTIONS[kind](ctx);

  ctx.state.activeEvent = kind;
  ctx.match.bannerUntilMs = ctx.state.elapsedMs + EVENT_BANNER_MS;
  ctx.log.info(`✨ event fired: ${kind}`);
}

/** Fire any event whose scheduled moment has passed. Each fires at most once per match. */
export function fireDueAutoEvents(ctx: SimContext): void {
  for (const kind of Object.values(EventKind)) {
    if (ctx.match.firedEvents.has(kind)) continue;
    if (ctx.state.elapsedMs < AUTO_EVENT_AT_MS[kind]) continue;
    ctx.match.firedEvents.add(kind);
    fireEvent(ctx, kind);
  }
}

/** Take a spent banner down. */
export function clearExpiredBanner(ctx: SimContext): void {
  if (ctx.state.activeEvent === NO_SESSION) return;
  if (ctx.state.elapsedMs <= ctx.match.bannerUntilMs) return;
  ctx.state.activeEvent = NO_SESSION;
}
