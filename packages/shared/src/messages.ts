import type { HammerKind } from "./constants";

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
} as const;
export type ClientMsg = (typeof ClientMsg)[keyof typeof ClientMsg];

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
