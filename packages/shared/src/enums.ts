/**
 * Closed value sets shared by client + server.
 *
 * Every set is a frozen `const` object PLUS a union type of the same name, so a
 * comparison is always written `phase === GamePhase.Playing` — never a bare
 * `"playing"` literal that a typo could silently break. Values are the strings
 * that go on the wire (Colyseus schema fields are primitives), so renaming a key
 * is safe while renaming a *value* is a protocol change.
 *
 * Rule: if a value is ever compared, switched on, or used as a map key, it belongs
 * here. Tunable numbers belong in `constants.ts`; stage layouts in `stages.ts`.
 */

/** Where a room is in its lifecycle. Drives movement rules, HUD and camera. */
export const GamePhase = {
  /** waiting-room plaza: walk + bonk, no damage */
  Lobby: "lobby",
  /** live match: damage, zone, pickups */
  Playing: "playing",
  /** match decided: results screen up, sim halted */
  Ended: "ended",
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

/** The 3 normal hammers + `Golden` (a random-event power weapon, ~one-shot). */
export const HammerKind = {
  Fast: "fast",
  Mid: "mid",
  Heavy: "heavy",
  Golden: "golden",
} as const;
export type HammerKind = (typeof HammerKind)[keyof typeof HammerKind];

/** Hammers that spawn on the map and respawn after being taken. */
export const WEAPON_KINDS = [HammerKind.Fast, HammerKind.Heavy] as const;
export type WeaponKind = (typeof WEAPON_KINDS)[number];

/** Everything collectible on the floor: the weapon hammers, plus event items. */
export const PickupKind = {
  Fast: HammerKind.Fast,
  Heavy: HammerKind.Heavy,
  Golden: HammerKind.Golden,
  Heal: "heal",
} as const;
export type PickupKind = (typeof PickupKind)[keyof typeof PickupKind];

/** True for a pickup that swaps the collector's hammer (everything but the heal orb). */
export function isHammerPickup(kind: string): kind is HammerKind {
  return kind !== PickupKind.Heal;
}

/** True for a map weapon — the only pickups that respawn on a timer. */
export function isWeaponPickup(kind: string): kind is WeaponKind {
  return (WEAPON_KINDS as readonly string[]).includes(kind);
}

/** Random events (fire automatically mid-match, and on a Host button). */
export const EventKind = {
  Golden: "golden",
  Heal: "heal",
} as const;
export type EventKind = (typeof EventKind)[keyof typeof EventKind];

/** Items a dead player can lob at a survivor. Harass, never eliminate. */
export const PrankKind = {
  Banana: "banana",
  Bomb: "bomb",
} as const;
export type PrankKind = (typeof PrankKind)[keyof typeof PrankKind];

/** Stage ids. The Host picks one in the lobby; the server applies it at match start. */
export const StageId = {
  Colosseum: "colosseum",
  Pit: "pit",
  Grand: "grand",
} as const;
export type StageId = (typeof StageId)[keyof typeof StageId];

/**
 * Visual themes. Drives client colors ONLY — never gameplay. `Lobby` isn't a stage;
 * it's the look the client uses while `phase === GamePhase.Lobby`.
 */
export const StageTheme = {
  Colosseum: "colosseum",
  Pit: "pit",
  Sky: "sky",
  Lobby: "lobby",
} as const;
export type StageTheme = (typeof StageTheme)[keyof typeof StageTheme];

/** The cosmetic slots on `Player`. Keys match the schema field names on purpose. */
export const CosmeticSlot = {
  Color: "colorIndex",
  Hat: "hatIndex",
  Face: "faceIndex",
  Back: "backIndex",
} as const;
export type CosmeticSlot = (typeof CosmeticSlot)[keyof typeof CosmeticSlot];

/** Id of the "wearing nothing" entry — index 0 of every cosmetic catalog. */
export const COSMETIC_NONE_ID = "none";

/**
 * Cosmetic ids. Each one is BOTH a catalog entry (`constants.ts`) and a mesh case
 * (`client/three/cosmetics.tsx`) — naming them here is what stops the two drifting.
 */
export const HatId = {
  None: COSMETIC_NONE_ID,
  Cap: "cap",
  Crown: "crown",
  Horns: "horns",
  TopHat: "tophat",
  Party: "party",
} as const;
export type HatId = (typeof HatId)[keyof typeof HatId];

export const FaceId = {
  None: COSMETIC_NONE_ID,
  Shades: "shades",
  Visor: "visor",
  Nerd: "nerd",
  Eyepatch: "eyepatch",
} as const;
export type FaceId = (typeof FaceId)[keyof typeof FaceId];

export const BackId = {
  None: COSMETIC_NONE_ID,
  Cape: "cape",
  Backpack: "backpack",
  Wings: "wings",
  Jetpack: "jetpack",
} as const;
export type BackId = (typeof BackId)[keyof typeof BackId];

/**
 * Join failures the server signals by `throw new Error(JoinError.X)`. The client
 * matches on the same constant to pick a friendly Thai message — so the two sides
 * can never drift apart on a bare string.
 */
export const JoinError = {
  RoomFull: "room-full",
} as const;
export type JoinError = (typeof JoinError)[keyof typeof JoinError];

/**
 * The funny end-of-match awards. The SERVER decides who wins each (it owns the
 * stats); the CLIENT owns the icon + Thai label + how the value reads — so no UI
 * copy has to live in the simulation.
 */
export const AwardKind = {
  MostKills: "most-kills",
  FirstBlood: "first-blood",
  LongestSurvivor: "longest-survivor",
  Pacifist: "pacifist",
  MostWallSlams: "most-wall-slams",
} as const;
export type AwardKind = (typeof AwardKind)[keyof typeof AwardKind];
