/**
 * Presentation tuning — camera framing, animation lengths, HUD polling.
 *
 * These are FEEL values, not game values: changing one can only make the client look
 * different, never make it disagree with the server. Anything the simulation reads
 * belongs in `@hammer/shared` `constants.ts` instead.
 */

/** ms in a second — for turning simulation milliseconds into readable UI numbers. */
export const MS_PER_SECOND = 1000;

export const CAMERA = {
  /** first-person eye height (m) — at the avatar's head. */
  eyeHeight: 2.05,
  /** how far ahead the eye cam looks, and at what height. */
  lookAheadDistance: 6,
  lookAheadHeight: 1.0,
  /** how quickly the eye cam swings round to your facing (exponential rate). */
  turnRate: 12,
  /** plaza follow-cam: fixed orientation, parked behind and above the player. */
  plaza: { height: 4.4, distance: 6.5, lookHeight: 1.5 },
  /** where the spectator/Host orbit cam starts, and what it orbits. */
  spectator: { position: [0, 16, 22] as const, target: [0, 0.5, 0] as const },
  /** the canvas' initial camera before any phase takes over. */
  initial: { position: [0, 12, 16] as const, fov: 50 },
} as const;

export const AVATAR = {
  /** swing animation length (ms). Purely visual; the server owns the real cooldown. */
  swingMs: 300,
  /** how fast the client-only death ragdoll tips over (exponential rate). */
  ragdollRate: 6,
  /** how far a corpse tips (radians) and sinks (m). */
  ragdollTilt: 1.45,
  ragdollDrop: 0.5,
  /** height (m) of the floating name tag and of the prank emoji above it. */
  nameTagY: 2.7,
  prankTagY: 3.35,
  /** how long a 🍌/💣 hangs over the victim (ms). */
  prankFxMs: 1200,
  /** name-tag HP bar size (px, in the drei Html overlay). */
  hpBar: { width: 46, height: 6 },
  /** dimming applied to a player whose seat is held open for a reconnect. */
  disconnectedOpacity: 0.45,
} as const;

export const PREDICTION = {
  /** how fast the predicted self is pulled back onto the server position. */
  correctionRate: 8,
  /** a gap bigger than this (m) snaps instead of easing — a teleport, not drift. */
  snapDistanceM: 1.5,
} as const;

export const HUD = {
  /** how often the out-of-zone warning samples the game loop (ms). */
  zonePollMs: 150,
  /** how far outside the safe radius (m) before the warning shows — stops flicker. */
  zoneMarginM: 0.15,
  /** hold-to-swing repeat rate (ms). The server still gates the real cooldown. */
  swingRepeatMs: 130,
} as const;

export const JOYSTICK = {
  sizePx: 110,
  color: "#38a3ff",
} as const;

export const SPLASH = {
  /** progress-bar tick (ms) and the easing it uses to creep toward its target. */
  tickMs: 55,
  startPct: 6,
  /** where the bar parks while still connecting, vs. once the room is open. */
  waitingPct: 90,
  donePct: 100,
  minStepPct: 0.6,
  easeFactor: 0.09,
  /** how long the finished bar is shown before the world appears (ms). */
  handoffMs: 650,
} as const;

export const SCENE = {
  /** segment count for the arena discs/rings — high enough to read as a circle. */
  circleSegments: 64,
  /** width (m) of the painted arena boundary ring. */
  boundaryWidthM: 0.3,
  /** the plaza's decorative inner ring, as a fraction of the plaza radius. */
  plazaAccentRing: { inner: 0.62, outer: 0.64 },
  /** floor grid spacing (m). */
  grid: { cellSize: 2, sectionSize: 10, fadeDistance: 60 },
  /** pickup bob/spin speeds and float height. */
  pickupSpinRate: 2,
  pickupBobRate: 3,
  pickupBobAmplitudeM: 0.16,
  pickupHeightM: 1,
} as const;
