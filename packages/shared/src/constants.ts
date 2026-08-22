/**
 * Single source of truth for game numbers — imported by BOTH client and server.
 * Tuning happens here so damage/HP/tick never drift between the two.
 * (GDD v0.1: HP=600, dmg 2/5/20, tick 20Hz. Numbers are placeholders to tune in Phase 02.)
 */

/** Server simulation frequency (Hz). */
export const TICK_RATE = 20;

/** Everyone starts here — high HP so a match lasts 15–20 min. */
export const HP_MAX = 600;

/** Room cap (25 players + 1 invisible host who isn't counted). */
export const MAX_PLAYERS = 25;

/** Hard match cap; the shrinking zone forces an end before this. */
export const MATCH_MAX_MINUTES = 20;

/** Colosseum arena radius (meters) at match start, before the zone shrinks. */
export const ARENA_RADIUS = 24;

/** Placeholder walk speed (m/s) — real movement lands in Phase 01. */
export const MOVE_SPEED = 5;

export type HammerKind = "fast" | "mid" | "heavy";

/**
 * The 3 hammers. Everyone starts on `mid`; `fast`/`heavy` spawn as map pickups.
 * What matters is the RATIO between them, not the exact numbers (GDD).
 */
export const HAMMERS: Record<
  HammerKind,
  { readonly label: string; readonly dmg: number; readonly cooldownMs: number; readonly knockback: number }
> = {
  fast: { label: "ฆ้อนเร็ว", dmg: 2, cooldownMs: 220, knockback: 4 },
  mid: { label: "ฆ้อนกลาง", dmg: 5, cooldownMs: 420, knockback: 7 },
  heavy: { label: "ฆ้อนแรง", dmg: 20, cooldownMs: 900, knockback: 14 },
};

export const DEFAULT_HAMMER: HammerKind = "mid";

/** Colyseus room name used by both sides for joinOrCreate/define. */
export const ROOM_NAME = "game";

/**
 * Game phase. Declared here (not in schema.ts) so the CLIENT can import the type
 * from "@hammer/shared" without pulling in @colyseus/schema. schema.ts re-uses it.
 */
export type GamePhase = "lobby" | "playing" | "ended";

// ── Lobby / room code ───────────────────────────────────────────────────────

/** Short, human-readable room code shown on the Host screen (e.g. "AB7K"). */
export const ROOM_CODE_LENGTH = 4;

/** No 0/O/1/I to avoid misreads when someone types the code off the big screen. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate a room code. The Host makes one and passes it as a matchmaking filter. */
export function randomRoomCode(len: number = ROOM_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Host can start once at least this many players have joined (bump for real play). */
export const MIN_PLAYERS_TO_START = 1;

// ── Cosmetics (no stat effect) ──────────────────────────────────────────────

/** Body tints players pick in the lobby. Index stored in Player.colorIndex. */
export const PLAYER_COLORS = [
  "#e0562f", // red-orange
  "#f2a03a", // orange (brand)
  "#e6c12f", // gold
  "#4caf50", // green
  "#2f9ee0", // blue
  "#7b53e0", // purple
  "#e05aa0", // pink
  "#5b6672", // slate
] as const;

/** One cosmetic choice. `id` drives the 3D mesh; `icon`/`label` drive the picker UI. */
export interface CosmeticOption {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

/** Cosmetic catalogs (index 0 is always "none"). Rendered procedurally — see CharacterPreview. */
export const HATS: readonly CosmeticOption[] = [
  { id: "none", label: "ไม่ใส่", icon: "🚫" },
  { id: "cap", label: "แก๊ป", icon: "🧢" },
  { id: "crown", label: "มงกุฎ", icon: "👑" },
  { id: "horns", label: "เขาสัตว์", icon: "🐮" },
  { id: "tophat", label: "หมวกสูง", icon: "🎩" },
  { id: "party", label: "ปาร์ตี้", icon: "🎉" },
];

export const FACES: readonly CosmeticOption[] = [
  { id: "none", label: "ไม่ใส่", icon: "🚫" },
  { id: "shades", label: "แว่นกันแดด", icon: "😎" },
  { id: "visor", label: "ไวเซอร์", icon: "🤖" },
  { id: "nerd", label: "แว่นกลม", icon: "🤓" },
  { id: "eyepatch", label: "ผ้าปิดตา", icon: "🩹" },
];

export const BACKS: readonly CosmeticOption[] = [
  { id: "none", label: "ไม่มี", icon: "🚫" },
  { id: "cape", label: "ผ้าคลุม", icon: "🦸" },
  { id: "backpack", label: "เป้", icon: "🎒" },
  { id: "wings", label: "ปีก", icon: "🦋" },
  { id: "jetpack", label: "เจ็ตแพ็ก", icon: "🚀" },
];

export const DEFAULT_COLOR_INDEX = 1; // orange
export const DEFAULT_HAT_INDEX = 0; // none
export const DEFAULT_FACE_INDEX = 0; // none
export const DEFAULT_BACK_INDEX = 0; // none
