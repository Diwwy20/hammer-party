import { BackId, EventKind, FaceId, HammerKind, HatId, PrankKind } from "./enums";

/**
 * Single source of truth for the game's TUNABLE NUMBERS — imported by BOTH client
 * and server, so damage/HP/tick can never drift between the two.
 *
 * What belongs where:
 *   - here .............. simulation values (HP, damage, speeds, radii, timings) + cosmetic catalogs
 *   - `enums.ts` ........ closed value sets that get compared (phase, hammer, pickup, …)
 *   - `stages.ts` ....... per-stage layout data
 *   - client `config/` .. presentation-only tuning (camera, FX durations, palettes)
 *
 * Anything compared or measured in game logic must be named here — never inlined.
 */

// ── Server loop / session ───────────────────────────────────────────────────

/** Server simulation frequency (Hz). */
export const TICK_RATE = 20;

/** Derived: one simulation step in ms. */
export const TICK_MS = 1000 / TICK_RATE;

/** Default port for the Colyseus WS transport (server binds it, client dials it). */
export const DEFAULT_SERVER_PORT = 2567;

/** Colyseus room name used by both sides for join/define. */
export const ROOM_NAME = "game";

/** Room cap (25 players + 1 invisible host who isn't counted). */
export const MAX_PLAYERS = 25;

/** A player whose connection drops mid-match keeps their seat this long for a reconnect. */
export const RECONNECT_SECONDS = 20;

// ── Match shape ─────────────────────────────────────────────────────────────

/** Everyone starts here — high HP so a match lasts 15–20 min. */
export const HP_MAX = 600;

/** Hard match cap; the shrinking zone should always force an end well before this. */
export const MATCH_MAX_MINUTES = 20;

/** Derived: the hard cap in ms (the sim's failsafe end-of-match trigger). */
export const MATCH_MAX_MS = MATCH_MAX_MINUTES * 60_000;

/** Host can start once at least this many players have joined (bump for real play). */
export const MIN_PLAYERS_TO_START = 1;

/** Below this many starters a match can't be "won" — stops a solo test ending instantly. */
export const MIN_PLAYERS_FOR_WIN = 2;

// ── World / movement ────────────────────────────────────────────────────────

/** Default arena radius (m) at match start, before the zone shrinks. See `stages.ts`. */
export const ARENA_RADIUS = 24;

/** Players spawn on a ring at this fraction of the stage radius. */
export const SPAWN_RADIUS_RATIO = 0.65;

/** Default spawn ring radius (m) for the default stage. */
export const SPAWN_RADIUS = ARENA_RADIUS * SPAWN_RADIUS_RATIO;

/**
 * Waiting-room plaza radius (m). Before the Host starts, everyone gathers here and
 * can walk + bonk (knockback only, no damage). Kept smaller than the smallest stage
 * so the lobby feels cozy and people bump into each other.
 */
export const LOBBY_RADIUS = 16;

/** Plaza spawn ring (m) — half way out, so arrivals land near the middle, not the wall. */
export const LOBBY_SPAWN_RADIUS = LOBBY_RADIUS * 0.5;

/** Walk speed (m/s), applied by the authoritative server. */
export const MOVE_SPEED = 5;

/** Capsule radius (m) — used for arena-edge clamping and spawn spacing. */
export const PLAYER_RADIUS = 0.5;

/** Client renders OTHER players this far in the past for smooth interpolation. */
export const INTERP_DELAY_MS = 100;

/** How often the client samples the joystick and sends input up. */
export const INPUT_SEND_HZ = 20;

// ── Combat ──────────────────────────────────────────────────────────────────

/**
 * Hammers. Everyone starts on `Mid`; `Fast`/`Heavy` spawn as map pickups; `Golden`
 * only appears via the Golden Hammer event. What matters is the RATIO, not the
 * exact numbers (GDD).
 */
export const HAMMERS: Record<
  HammerKind,
  {
    readonly label: string;
    readonly dmg: number;
    readonly cooldownMs: number;
    /** Initial knockback speed (m/s) imparted to the victim, decays via KNOCKBACK_DECAY. */
    readonly knockback: number;
    /** How far (m, centre-to-centre) a swing can connect. */
    readonly reach: number;
    /** Half-angle of the swing cone (degrees) around the attacker's facing. */
    readonly arcDeg: number;
    /** How long the victim is frozen after a hit (ms). 0 = no stun. */
    readonly stunMs: number;
  }
> = {
  [HammerKind.Fast]: {
    label: "ฆ้อนเร็ว",
    dmg: 2,
    cooldownMs: 220,
    knockback: 4,
    reach: 2.0,
    arcDeg: 55,
    stunMs: 0,
  },
  [HammerKind.Mid]: {
    label: "ฆ้อนกลาง",
    dmg: 5,
    cooldownMs: 420,
    knockback: 7,
    reach: 2.3,
    arcDeg: 65,
    stunMs: 0,
  },
  [HammerKind.Heavy]: {
    label: "ฆ้อนแรง",
    dmg: 20,
    cooldownMs: 900,
    knockback: 14,
    reach: 2.7,
    arcDeg: 80,
    stunMs: 550,
  },
  [HammerKind.Golden]: {
    label: "ฆ้อนทองคำ",
    dmg: 250,
    cooldownMs: 650,
    knockback: 22,
    reach: 3.2,
    arcDeg: 100,
    stunMs: 350,
  },
};

export const DEFAULT_HAMMER: HammerKind = HammerKind.Mid;

/** Knockback velocity decays by this factor per second (exponential). Higher = stops sooner. */
export const KNOCKBACK_DECAY = 6;

/** Knockback below this speed (m/s) is snapped to zero — stops endless micro-drift. */
export const KNOCKBACK_STOP_SPEED = 0.05;

/** Two capsules closer than this (m) have no usable hit direction — skip the swing. */
export const HIT_MIN_DISTANCE = 1e-4;

/** A player can only take one wall-slam per this window (ms) — debounces edge grinding. */
export const WALL_SLAM_COOLDOWN_MS = 400;

// ── Pickups / events ────────────────────────────────────────────────────────

/** Walk within this distance (m) of a pickup to collect it. */
export const PICKUP_RADIUS = 1.2;

/** A collected weapon pickup respawns after this long (ms). Event orbs don't respawn. */
export const WEAPON_RESPAWN_MS = 12_000;

/** How long an event banner stays on screen (ms). */
export const EVENT_BANNER_MS = 4_000;

/** HP restored by walking over a heal orb (Heal event). */
export const HEAL_ORB_HP = 200;

/** Heal orbs spawn on a ring of this many, at this radius (m) from the centre. */
export const HEAL_ORB_COUNT = 4;
export const HEAL_ORB_RING_RADIUS = 8;

/** Each event also fires automatically at this point into the match (ms). */
export const AUTO_EVENT_AT_MS: Record<EventKind, number> = {
  [EventKind.Meteor]: 60_000,
  [EventKind.Golden]: 90_000,
  [EventKind.Heal]: 150_000,
  [EventKind.Rain]: 200_000,
};

// ── Weather + hazards ───────────────────────────────────────────────────────

/**
 * The meteor storm. Every strike is TELEGRAPHED: a marker sits on the floor for
 * `warnMs` before it lands, so getting hit is always a decision you made, never
 * something that happened to you.
 */
export const METEOR = {
  /** strikes in one storm */
  count: 14,
  /** gap between strikes (ms) */
  intervalMs: 850,
  /** how long the floor marker shows before impact (ms) */
  warnMs: 1_400,
  /** blast radius (m) — damage falls off linearly to zero at the edge */
  blastRadius: 3.4,
  /** HP taken at the dead centre of the blast */
  dmg: 90,
  /** knockback (m/s) imparted at the centre */
  knockback: 18,
  /** how long a direct hit freezes you (ms) */
  stunMs: 320,
  /** strikes land within this fraction of the current safe radius */
  spreadRatio: 0.92,
  /** how long the scorch mark lingers after impact (ms) */
  scorchMs: 900,
} as const;

/**
 * Rain. The floor goes slick, so knockback decays far slower and a good hit sends
 * someone sliding across the arena (and possibly out of the zone).
 */
export const RAIN = {
  /** how long one downpour lasts (ms) */
  durationMs: 45_000,
  /** knockback decay is multiplied by this while it rains — lower = more sliding */
  slipFactor: 0.34,
} as const;

// ── Ghosts (dead players) ───────────────────────────────────────────────────

/**
 * Death is not a spectator seat: you stay in the world as a ghost. The living can't
 * see you, you can't be hit, and all you can do is drift about and lob pranks.
 */
export const GHOST = {
  /** walk-speed multiplier — a ghost drifts a bit quicker than it walked */
  speedFactor: 1.4,
  /** how far past the arena wall a ghost may drift (m) */
  wanderMarginM: 5,
} as const;

// ── Dead-player pranks ──────────────────────────────────────────────────────

/**
 * Spectators (dead players) can lob a prank at a random survivor. Pranks HARASS
 * but never eliminate — bomb damage is floored so outcomes stay player-driven.
 */
export const PRANK = {
  /** min gap between a spectator's prank throws (ms) */
  cooldownMs: 3_000,
  /** a bombed player never drops below this HP — a prank can't take the kill */
  minHpAfterBomb: 1,
  [PrankKind.Banana]: { stunMs: 700, knockback: 5 },
  [PrankKind.Bomb]: { dmg: 30, stunMs: 350, knockback: 12 },
} as const;

// ── Player names ────────────────────────────────────────────────────────────

/** Display names are clamped to this (input maxLength + server-side truncation). */
export const MAX_NAME_LENGTH = 16;

/** Shown when a name is empty or entirely masked by the profanity filter. */
export const FALLBACK_PLAYER_NAME = "ผู้เล่น";

// ── Lobby / room code ───────────────────────────────────────────────────────

/** Short, human-readable room code shown on the Host screen (e.g. "AB7K"). */
export const ROOM_CODE_LENGTH = 4;

/** No 0/O/1/I to avoid misreads when someone types the code off the big screen. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Everything a typed/scanned room code may NOT contain — used to sanitise the join field. */
export const ROOM_CODE_STRIP_PATTERN = /[^A-Z0-9]/g;

/** Generate a room code. The Host makes one and passes it as a matchmaking filter. */
export function randomRoomCode(len: number = ROOM_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

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

/** Index 0 of every catalog is always the "wearing nothing" entry (`COSMETIC_NONE_ID`). */
export const COSMETIC_NONE_INDEX = 0;

/** Cosmetic catalogs (index 0 is always "none"). Rendered procedurally — see three/cosmetics.tsx. */
export const HATS: readonly CosmeticOption[] = [
  { id: HatId.None, label: "ไม่ใส่", icon: "🚫" },
  { id: HatId.Cap, label: "แก๊ป", icon: "🧢" },
  { id: HatId.Crown, label: "มงกุฎ", icon: "👑" },
  { id: HatId.Horns, label: "เขาสัตว์", icon: "🐮" },
  { id: HatId.TopHat, label: "หมวกสูง", icon: "🎩" },
  { id: HatId.Party, label: "ปาร์ตี้", icon: "🎉" },
];

export const FACES: readonly CosmeticOption[] = [
  { id: FaceId.None, label: "ไม่ใส่", icon: "🚫" },
  { id: FaceId.Shades, label: "แว่นกันแดด", icon: "😎" },
  { id: FaceId.Visor, label: "ไวเซอร์", icon: "🤖" },
  { id: FaceId.Nerd, label: "แว่นกลม", icon: "🤓" },
  { id: FaceId.Eyepatch, label: "ผ้าปิดตา", icon: "🩹" },
];

export const BACKS: readonly CosmeticOption[] = [
  { id: BackId.None, label: "ไม่มี", icon: "🚫" },
  { id: BackId.Cape, label: "ผ้าคลุม", icon: "🦸" },
  { id: BackId.Backpack, label: "เป้", icon: "🎒" },
  { id: BackId.Wings, label: "ปีก", icon: "🦋" },
  { id: BackId.Jetpack, label: "เจ็ตแพ็ก", icon: "🚀" },
];

export const DEFAULT_COLOR_INDEX = 1; // orange
export const DEFAULT_HAT_INDEX = COSMETIC_NONE_INDEX;
export const DEFAULT_FACE_INDEX = COSMETIC_NONE_INDEX;
export const DEFAULT_BACK_INDEX = COSMETIC_NONE_INDEX;
