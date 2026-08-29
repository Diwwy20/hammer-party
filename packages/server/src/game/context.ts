import type { GameState } from "@hammer/shared/schema";
import {
  COLOSSEUM,
  DEFAULT_STAGE_ID,
  type EventKind,
  type StageConfig,
  type StageId,
} from "@hammer/shared";
import type { Logger } from "../logger";

/**
 * The server-only half of the world.
 *
 * `GameState` (schema) holds everything the clients must agree on. Everything else
 * the simulation needs — knockback velocity, cooldown stamps, per-match stats,
 * respawn timers — lives here and is NEVER synced (see the "no physics in the
 * schema" rule in the architecture skill).
 *
 * Every `game/` module takes this context, so responsibilities stay split by file
 * while all mutable simulation state stays in exactly one object.
 */

/** How a module publishes a one-shot FX event to every client. */
export type Broadcaster = (type: string, message: unknown) => void;

/** Latest movement intent received from a client (already normalised). */
export interface InputVec {
  dx: number;
  dz: number;
}

/** Per-player simulation state kept OUT of the synced schema (server-only). */
export interface CombatState {
  /** knockback velocity (m/s), decays each tick */
  vx: number;
  vz: number;
  /** frozen until this `Date.now()` */
  stunUntil: number;
  /** last swing, for the hammer cooldown gate */
  lastAttackAt: number;
  /** last wall-slam, for the slam debounce */
  lastSlamAt: number;
  /** last prank throw, for the spectator cooldown */
  lastPrankAt: number;
  /** total damage dealt this match (awards: most damage / pacifist) */
  damageDealt: number;
  /** times slammed into a wall this match (awards) */
  wallSlamsTaken: number;
  /** `elapsedMs` when they died, `ALIVE` while still standing (awards: survivor) */
  diedAtMs: number;
}

/** `CombatState.diedAtMs` while the player is still alive. */
export const ALIVE = -1;

export function createCombatState(): CombatState {
  return {
    vx: 0,
    vz: 0,
    stunUntil: 0,
    lastAttackAt: 0,
    lastSlamAt: 0,
    lastPrankAt: 0,
    damageDealt: 0,
    wallSlamsTaken: 0,
    diedAtMs: ALIVE,
  };
}

/** One queued meteor strike — the schedule behind a synced `Hazard`. */
export interface MeteorRecord {
  /** `elapsedMs` at which the warning becomes a crater */
  impactAtMs: number;
  /** `elapsedMs` at which the crater is swept up */
  clearAtMs: number;
  /** true once the damage has been dealt (an impact resolves exactly once) */
  landed: boolean;
}

/** Bookkeeping that lives for exactly one match and is rebuilt on every start. */
export interface MatchBookkeeping {
  /** how many players were alive at the starting bell (a win needs a real field) */
  aliveAtStart: number;
  /** name of whoever drew first blood; "" until the first kill */
  firstBloodName: string;
  /** events that already fired automatically — each fires at most once per match */
  firedEvents: Set<EventKind>;
  /** `elapsedMs` at which the current event banner should clear */
  bannerUntilMs: number;
  /** pickup id → `elapsedMs` at which it comes back */
  pickupRespawnAt: Map<string, number>;
  /** monotonic counter for event-pickup ids */
  eventPickupSeq: number;
  /** monotonic counter for hazard ids */
  hazardSeq: number;
  /** meteors still to be dropped by the running storm */
  meteorsLeft: number;
  /** `elapsedMs` at which the next meteor of the storm goes down */
  nextMeteorAtMs: number;
  /** hazard id → its impact schedule (the synced `Hazard` carries only what's visible) */
  meteors: Map<string, MeteorRecord>;
  /** `elapsedMs` at which the current weather reverts to clear */
  weatherUntilMs: number;
}

export function createMatchBookkeeping(): MatchBookkeeping {
  return {
    aliveAtStart: 0,
    firstBloodName: "",
    firedEvents: new Set(),
    bannerUntilMs: 0,
    pickupRespawnAt: new Map(),
    eventPickupSeq: 0,
    hazardSeq: 0,
    meteorsLeft: 0,
    nextMeteorAtMs: 0,
    meteors: new Map(),
    weatherUntilMs: 0,
  };
}

export interface SimContext {
  readonly state: GameState;
  readonly broadcast: Broadcaster;
  readonly log: Logger;
  readonly combat: Map<string, CombatState>;
  readonly inputs: Map<string, InputVec>;
  /** stage config driving the CURRENT match */
  stage: StageConfig;
  /** stage the Host picked for the NEXT match (applied at `beginMatch`) */
  selectedStageId: StageId;
  match: MatchBookkeeping;
}

export function createSimContext(
  state: GameState,
  broadcast: Broadcaster,
  log: Logger,
): SimContext {
  return {
    state,
    broadcast,
    log,
    combat: new Map(),
    inputs: new Map(),
    stage: COLOSSEUM,
    selectedStageId: DEFAULT_STAGE_ID,
    match: createMatchBookkeeping(),
  };
}
