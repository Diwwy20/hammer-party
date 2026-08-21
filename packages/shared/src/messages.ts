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
} as const;
export type ClientMsg = (typeof ClientMsg)[keyof typeof ClientMsg];

/** Options sent with joinOrCreate(). */
export interface JoinOptions {
  name: string;
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

/** Cosmetic-only loadout (no stats) — colour/hat/etc. */
export interface CosmeticMessage {
  colorIndex?: number;
  hatIndex?: number;
}

/** Handy union re-export. */
export type { HammerKind };
