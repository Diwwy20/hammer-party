import type { HammerKind, PrankKind } from "./constants";

/**
 * Client → server messages. The server is authoritative: the client only sends
 * *intent* (where I want to move, that I attacked). Never trust these blindly —
 * Phase 04 adds Zod validation on the server edge.
 */
export const ClientMsg = {
  Input: "input",
  Attack: "attack",
  Pickup: "pickup",
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
} as const;
export type ClientMsg = (typeof ClientMsg)[keyof typeof ClientMsg];

/** Dead player → server: lob a prank at a random survivor. */
export interface PrankMessage {
  kind: PrankKind;
}

/** Random events the Host can trigger (also fire automatically mid-match). */
export type EventKind = "golden" | "heal";

/** Host → server: spawn this event's pickups. */
export interface EventMessage {
  kind: EventKind;
}

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

/** A prank landed on `id` (play the banana-slip / bomb-pop FX above them). */
export interface PrankEvent {
  id: string;
  kind: PrankKind;
}

/** A player swung their hammer (play the swing animation for `id`). */
export interface SwingEvent {
  id: string;
  hammer: HammerKind;
}

/** `id` took `dmg` from `by`, leaving them at `hp` (flash + optional damage number). */
export interface HitEvent {
  id: string;
  by: string;
  dmg: number;
  hp: number;
}

/** `id` was defeated by `by` (trigger the client-only ragdoll + kill feed). */
export interface DiedEvent {
  id: string;
  by: string;
}

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
  /** monotonic sequence for client-side prediction/reconciliation (Phase 01) */
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

/** Handy union re-export. */
export type { HammerKind };
