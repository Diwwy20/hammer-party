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
import { addEventPickup } from "./pickups";
import type { SimContext } from "./context";

/**
 * Random events: what each one drops on the floor, and when it fires by itself.
 *
 * The banner is published as an event KIND, not a sentence — wording is the
 * client's job (`client/src/config/copy.ts`), so no Thai copy lives in the sim.
 */

/** Centre of every stage — where the Golden Hammer lands. */
const ARENA_CENTRE = { x: 0, z: 0 } as const;

/** Drop this event's pickups and raise its banner. */
export function fireEvent(ctx: SimContext, kind: EventKind): void {
  if (kind === EventKind.Golden) {
    addEventPickup(ctx, PickupKind.Golden, ARENA_CENTRE.x, ARENA_CENTRE.z);
  } else {
    for (let i = 0; i < HEAL_ORB_COUNT; i++) {
      const [x, z] = pointOnCircle((i / HEAL_ORB_COUNT) * TAU, HEAL_ORB_RING_RADIUS);
      addEventPickup(ctx, PickupKind.Heal, x, z);
    }
  }

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
