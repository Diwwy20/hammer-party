import type { AwardKind, EventKind, HammerKind, PrankKind } from "./enums";

/**
 * The wire contract between client and server: message names + payload shapes.
 *
 * The server is authoritative — the client only ever sends *intent* ("I want to
 * move there", "I swung"). Every inbound payload is re-validated at the server edge
 * (`server/src/net/validate.ts`); the types here are a convenience, never a trust
 * boundary.
 */

/** Client → server message names. */
export const ClientMsg = {
  Input: "input",
  Attack: "attack",
  Ready: "ready",
  SetCosmetic: "cosmetic",
  /** Host-only: leave the lobby and begin the match. */
  Start: "start",
  /** Host-only: end the current match and send everyone back to the lobby. */
  Restart: "restart",
  /** Host-only: trigger a random event (Golden Hammer / Heal orbs). */
  Event: "event",
  /** Dead-player only: throw a prank (banana/bomb) at a random survivor. */
  Prank: "prank",
  /** Host-only: pick the stage for the next match (lobby only). */
  SetStage: "setstage",
} as const;
export type ClientMsg = (typeof ClientMsg)[keyof typeof ClientMsg];

/**
 * Server → client one-shot events for transient combat FX. These are NOT state —
 * they animate a swing / hit / death on every client (visual only). Anything the
 * clients must AGREE on (hp, alive, position) stays in the synced schema instead.
 */
export const ServerMsg = {
  Swing: "swing",
  Hit: "hit",
  Died: "died",
  Prank: "prank",
} as const;
export type ServerMsg = (typeof ServerMsg)[keyof typeof ServerMsg];

// ── Client → server payloads ────────────────────────────────────────────────

/** Options sent with create()/join(). */
export interface JoinOptions {
  name: string;
  /** True when this connection is the big-screen Host (director, not a player). */
  asHost?: boolean;
  /** Room code — the matchmaking filter so players land in the Host's room. */
  code?: string;
}

/** Movement intent, sampled from the virtual joystick. dx/dz are a unit-ish vector. */
export interface InputMessage {
  /** monotonic sequence for client-side prediction/reconciliation */
  seq: number;
  dx: number;
  dz: number;
}

/** Fired when the attack button is pressed. */
export interface AttackMessage {
  seq: number;
}

/** Toggle "ready" in the lobby. */
export interface ReadyMessage {
  ready: boolean;
}

/** Cosmetic-only loadout (no stats). Any subset of slots may be sent. */
export interface CosmeticMessage {
  colorIndex?: number;
  hatIndex?: number;
  faceIndex?: number;
  backIndex?: number;
}

/** Host → server: spawn this event's pickups. */
export interface EventMessage {
  kind: EventKind;
}

/** Dead player → server: lob a prank at a random survivor. */
export interface PrankMessage {
  kind: PrankKind;
}

/** Host → server: choose the stage for the next match. */
export interface StageMessage {
  stageId: string;
}

// ── Server → client payloads ────────────────────────────────────────────────

/** A player swung their hammer (play the swing animation for `id`). */
export interface SwingEvent {
  id: string;
  hammer: HammerKind;
}

/** `id` took `dmg` from `by`, leaving them at `hp` (flash + optional damage number). */
export interface HitEvent {
  id: string;
  /** attacker's sessionId, or "" for environmental damage (zone / wall / prank). */
  by: string;
  dmg: number;
  hp: number;
}

/** `id` was defeated by `by` (trigger the client-only ragdoll + kill feed). */
export interface DiedEvent {
  id: string;
  /** killer's sessionId, or "" when the zone or a wall did it. */
  by: string;
}

/** A prank landed on `id` (play the banana-slip / bomb-pop FX above them). */
export interface PrankEvent {
  id: string;
  kind: PrankKind;
}

// ── End-of-match payloads (JSON blobs on GameState) ─────────────────────────

/**
 * One row of the final standings, ranked winner-first. Serialised into
 * `GameState.standingsJson` once, when the match ends — a JSON blob rather than a
 * schema map because it never changes again and nothing interpolates it.
 */
export interface MatchStanding {
  place: number;
  name: string;
  colorIndex: number;
  kills: number;
  dmg: number;
}

/**
 * One award winner. Deliberately carries NO copy: the server states the fact
 * ("`kind` was won by `name`, value `value`"), the client owns icon + Thai label +
 * how the value reads (kills / seconds / damage / times).
 */
export interface MatchAward {
  kind: AwardKind;
  name: string;
  /** The stat that won it — meaning depends on `kind`; -1 when the award has none. */
  value: number;
}

/** An award with no meaningful number to show (e.g. First Blood). */
export const AWARD_NO_VALUE = -1;
