import { MOVE_SPEED } from "@hammer/shared";

/**
 * Presentation tuning — camera framing, animation lengths, HUD polling.
 *
 * These are FEEL values, not game values: changing one can only make the client look
 * different, never make it disagree with the server. Anything the simulation reads
 * belongs in `@hammer/shared` `constants.ts` instead.
 */

/** ms in a second — for turning simulation milliseconds into readable UI numbers. */
export const MS_PER_SECOND = 1000;

/**
 * Camera framing.
 *
 * Players are always in THIRD person, on a fixed-orientation follow cam: the camera
 * sits behind and above and never rotates with your facing. That is what lets the
 * stick stay honest (up is always away from the camera, in the plaza and in a match
 * alike) — and it is the only way you get to see your own character, costume,
 * hammer swing and the hit you just took.
 */
export const CAMERA = {
  /** plaza follow-cam: close in, so people can see each other's outfits. */
  plaza: { height: 4.4, distance: 6.5, lookHeight: 1.5 },
  /** match follow-cam: pulled back and higher, to read incoming threats. */
  match: { height: 6.2, distance: 8.6, lookHeight: 1.4 },
  /** a dead player's cam: higher still, looking down on the fight they left. */
  ghostCam: { height: 8.5, distance: 9.5, lookHeight: 1.2 },
  /** how fast the follow cam eases onto its target position (exponential rate). */
  followEaseRate: 9,
  /** where the spectator/Host orbit cam starts, and what it orbits. */
  spectator: { position: [0, 16, 22] as const, target: [0, 0.5, 0] as const },
  /**
   * Host "watch this player" cam: an over-the-shoulder chase that DOES swing round
   * with the player's facing, because the big screen wants to see what they see.
   */
  follow: { distance: 5.6, height: 3.2, lookHeight: 1.4, easeRate: 4.5, turnRate: 3 },
  /** the canvas' initial camera before any phase takes over. */
  initial: { position: [0, 12, 16] as const, fov: 50 },
} as const;

/**
 * The cute low-poly character, as measured anchor points (metres, model space).
 *
 * Every mesh — body parts, hats, glasses, backpacks, the held hammer — positions
 * itself off THIS, so re-proportioning the character moves the cosmetics with it
 * instead of leaving a crown floating where the old head used to be.
 */
export const RIG = {
  head: { y: 1.6, radius: 0.44 },
  /** the rounded "bean" torso — a sphere squashed a little on the vertical */
  body: { y: 0.84, radius: 0.43, squash: 0.92 },
  /** arms hang from the shoulder pivot, so the swing rotates about the right place */
  arm: { x: 0.44, shoulderY: 1.04, length: 0.42, radius: 0.12 },
  /** legs hang from the hip pivot, tucked up inside the bean */
  leg: { x: 0.19, hipY: 0.6, length: 0.34, radius: 0.155 },
  eye: { x: 0.17, y: 1.66, z: 0.35, radius: 0.082 },
  /** brim/base height of a hat, i.e. the top of the skull */
  hatY: 1.99,
  /** where glasses and visors sit on the face */
  face: { y: 1.63, z: 0.4 },
  /** where a cape/backpack/wings hang off the back */
  back: { y: 1.0, z: -0.38 },
  /** the hand that carries the hammer */
  hand: { x: 0.52, y: 0.92, z: 0.2 },
  /** total standing height — what the name tag and FX clear */
  heightM: 2.05,
} as const;

/**
 * Character animation. The walk cycle is driven by DISTANCE TRAVELLED rather than
 * time, so a player's legs match their actual speed whether they are being
 * interpolated, predicted, or slid across a wet floor by a knockback.
 */
export const ANIM = {
  /** full stride cycles per metre walked */
  stepsPerMetre: 0.62,
  /** how far the legs and arms swing at full speed (radians) */
  legSwingRad: 0.95,
  armSwingRad: 0.7,
  /** vertical bounce and forward lean at full speed */
  bobM: 0.075,
  leanRad: 0.14,
  /** idle breathing: rate (Hz-ish) and how much the torso swells */
  idleRate: 1.7,
  idleScale: 0.035,
  /** how fast the measured speed follows the real one (exponential rate) */
  speedEaseRate: 9,
  /** speed (m/s) that counts as a full-tilt run for animation blending */
  fullSpeed: MOVE_SPEED,
  /** below this speed (m/s) the character is treated as standing still */
  idleSpeed: 0.15,
} as const;

/** Combat FX that live in the 3D world rather than the HUD. */
export const COMBAT_FX = {
  /** how long a hit squashes the victim, and by how much */
  squashMs: 240,
  squashAmount: 0.26,
  /** the expanding impact ring: how long it lives and how big it gets (m) */
  burstMs: 360,
  burstRadiusM: 1.5,
  /** the arc the hammer smears through a swing: length (ms) and sweep (radians) */
  trailMs: 240,
  trailSweepRad: 2.1,
  /** how long a defeated player's poof of dust hangs around (ms) */
  poofMs: 700,
} as const;

/** How a dead player is drawn — to the Host and to other ghosts only. */
export const GHOST_FX = {
  /** how far above the floor a ghost floats (m) */
  hoverM: 0.7,
  /** the slow up-down drift: rate and amplitude (m) */
  bobRate: 1.3,
  bobM: 0.14,
  /** ghosts are see-through, and their own body is a little more solid than others */
  opacity: 0.34,
  selfOpacity: 0.55,
} as const;

/** The meteor storm: everything about how a strike LOOKS (the damage is the server's). */
export const METEOR_FX = {
  /** how high the rock starts its fall (m) */
  fallHeightM: 38,
  rockRadiusM: 0.6,
  /** warning-ring pulses per second while the marker is down */
  warnPulseRate: 3.4,
  /** the shockwave expands to this multiple of the blast radius */
  shockwaveScale: 1.8,
  /** how long the flash + shockwave last (ms) — shorter than the server's scorch */
  flashMs: 420,
  /** trail of sparks following the rock down */
  emberCount: 5,
} as const;

/** Rain: a cheap particle sheet that follows the camera, not a physics system. */
export const RAIN_FX = {
  /** number of drops alive at once — one buffer, updated in place */
  dropCount: 700,
  /** the cylinder the drops fall inside, centred on the camera (m) */
  areaRadiusM: 30,
  columnHeightM: 26,
  /** fall speed (m/s) and how long each streak is drawn (m) */
  fallSpeed: 30,
  dropLengthM: 0.6,
  /** how long the sky takes to darken when it starts raining (exponential rate) */
  skyEaseRate: 1.2,
} as const;

/** The dressed stage: how the decor counts in `stages.ts` get laid out in 3D. */
export const STAGE_FX = {
  /** columns stand this far outside the wall, this tall and this thick (m) */
  column: { offsetM: 1.5, heightM: 6, radiusM: 0.55 },
  /** banners hang from the columns: size and how far they drop (m) */
  banner: { widthM: 1.5, heightM: 3, offsetM: 1.2, topM: 5.2 },
  /** braziers: how far out, how tall, and the size of the flame (m) */
  torch: { offsetM: 2.6, heightM: 2.2, flameM: 0.42 },
  /** tiered spectator seating: how many rings, how far apart and how much each rises */
  stands: { tiers: 4, stepOutM: 2.1, stepUpM: 0.85, startOffsetM: 3.4 },
  /** cloud slabs for the floating stages: the ring they drift on (m) */
  cloud: { minRadiusM: 18, maxRadiusM: 42, minHeightM: -14, maxHeightM: 10, sizeM: 6 },
  /** how fast a torch flame flickers, and how much */
  flameFlickerRate: 9,
  flameFlickerAmount: 0.18,
} as const;

export const AVATAR = {
  /** swing animation length (ms). Purely visual; the server owns the real cooldown. */
  swingMs: 300,
  /** height (m) of the floating name tag and of the prank emoji above it. */
  nameTagY: 2.5,
  prankTagY: 3.1,
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
  /** how often a cooldown dial (the ghost's prank buttons) refreshes (ms). */
  cooldownPollMs: 100,
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
