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
 * Camera framing — ISOMETRIC.
 *
 * Every player camera is a fixed three-quarter view looking down on the arena from
 * one corner: a constant yaw of `isoYawRad`, a constant pitch, and no rotation with
 * your facing, ever. It is the classic arena/brawler camera, and it is what the
 * whole redesign is framed for.
 *
 * Three things follow from it and all three are the point:
 *
 *   - **You can see the fight.** A camera parked behind a character shows you their
 *     back and whoever is directly in front of them; a camera above the corner shows
 *     you the floor, everyone standing on it, and the hammer coming at you from the
 *     side you were not looking at.
 *   - **The stick stays honest.** Nothing rotates, so screen-up is one fixed world
 *     direction in every phase — `runtime/input.ts` rotates the stick by this same
 *     yaw exactly once, and that is the only place the mapping exists.
 *   - **The swing reads.** A blow that sweeps round the body crosses the screen from
 *     up here instead of being foreshortened into the character it came from.
 *
 * It is a PERSPECTIVE camera at an isometric angle rather than a true orthographic
 * one: the fog, the floating name tags and the backdrop all want a bit of
 * convergence, and an arena of 25 people wants to know who is nearer.
 */
export const CAMERA = {
  /**
   * Which corner it looks from (radians). 45° round is the isometric diagonal —
   * walls read as walls, the flagstones read as a grid, and neither of the two
   * horizontal axes is favoured over the other.
   *
   * Every camera in the game shares it: the player's, the Host's chase cam
   * (`follow`), and the mapping in `runtime/input.ts` that turns the stick.
   */
  isoYawRad: Math.PI / 4,
  /**
   * The three player framings, as `height` above and `distance` back.
   *
   * The two are deliberately NOT equal. A true 45° pitch would be the textbook
   * isometric angle and it looks straight down on the tops of everybody's heads —
   * which is the one part of a character nobody dressed. Around 37° keeps the
   * isometric read of the floor while still showing a face, a shirt and a hammer.
   */
  plaza: { height: 5.6, distance: 7.6, lookHeight: 1.15 },
  /** match cam: pulled back, to read incoming threats from every side. */
  match: { height: 9.5, distance: 12.5, lookHeight: 1 },
  /** a dead player's cam: higher still, looking down on the fight they left. */
  ghostCam: { height: 12.5, distance: 15.5, lookHeight: 0.8 },
  /**
   * A phone held upright sees the same VERTICAL slice of the world as a monitor
   * does but far less of it sideways, which puts the camera in the character's
   * face. Every player cam backs off by this much as the aspect narrows.
   */
  portrait: { referenceAspect: 1.5, maxPullback: 1.45 },
  /** how fast the follow cam eases onto its target position (exponential rate). */
  followEaseRate: 9,
  /** where the spectator/Host orbit cam starts, and what it orbits. */
  spectator: { position: [24, 26, 24] as const, target: [0, 0.5, 0] as const },
  /**
   * Host "watch this player" cam: the same isometric framing, closer in. It does NOT
   * swing round with the player any more — the big screen showing 25 people needs
   * one stable read of the arena, not a camera that lurches every time its subject
   * turns round.
   */
  follow: { distance: 9, height: 6.8, lookHeight: 1.1, easeRate: 4.5 },
  /** the canvas' initial camera before any phase takes over. */
  initial: { position: [16, 16, 16] as const, fov: 46 },
} as const;

/**
 * The dressing room's own camera — a room, not the arena, so it gets its own frame.
 *
 * It looks at the mirror straight on and far enough back to hold the WHOLE mirror
 * in shot, crest to feet. This is a full-length mirror: the boots matter as much as
 * the hat, and a camera parked at chest height in front of a chibi character shows
 * you an enormous head and nothing else.
 */
export const DRESSING_CAMERA = {
  fov: 32,
  /**
   * Side-by-side layout: the mirror LEFT, the item grids right.
   *
   * The camera is slid to the RIGHT, which pushes the mirror to the left of the
   * frame — where the brief wants it, and, more to the point, on the half of the
   * screen the grids are not sitting on.
   */
  wide: { position: [1.35, 1.85, 5.9] as const, target: [1.35, 1.45, 0] as const },
  /**
   * Stacked layout (a phone held upright): the grids are a sheet across the bottom
   * half, so the whole mirror has to fit in the band ABOVE them.
   *
   * The fix is not to zoom out symmetrically — that would leave the character
   * floating in the middle, half of it behind the sheet. The camera drops and looks
   * at a point BELOW the character's feet instead, which pushes the whole figure up
   * into the top of the frame. Vertical fov is fixed, so a narrow screen also crops
   * hard sideways, and the extra distance is what keeps the mirror's frame in shot.
   */
  portrait: { position: [0, 1.25, 9.6] as const, target: [0, 0.2, 0] as const },
  /** the viewport width (px) the two swap at — the CSS breakpoint, named in one place */
  wideBreakpointPx: 760,
} as const;

/**
 * Lighting.
 *
 * One warm key light whose shadow camera is sized to the WHOLE arena — the default
 * box is a few metres across, which is why shadows used to simply stop existing
 * away from the middle — plus a sky/ground hemisphere fill, so the shaded side of a
 * character stays colourful instead of going muddy grey.
 */
export const LIGHTING = {
  /** the sun's direction, scaled by `sunDistanceM` — a low afternoon angle. */
  sunDirection: [0.55, 1, 0.42] as const,
  sunDistanceM: 34,
  sunIntensity: 1.45,
  /** everything dims and flattens under a downpour. */
  sunIntensityRain: 0.8,
  /**
   * A cool RIM light from behind and off to the other side, casting no shadows.
   *
   * It never lights anything you look at directly — it catches the edge that faces
   * away from the sun, which is what peels a character off the floor they are
   * standing on. One extra light for the separation that no amount of shading gives
   * you, because the problem was never the shading: it was that the shaded side of
   * a character and the ground behind it were the same brightness.
   */
  rimDirection: [-0.62, 0.5, -0.85] as const,
  rimIntensity: 0.6,
  rimIntensityRain: 0.3,
  ambientIntensity: 0.42,
  ambientIntensityRain: 0.36,
  hemisphereIntensity: 0.7,
  /** shadow map resolution, and the half-width (m) of the orthographic shadow box. */
  shadowMapSize: 2048,
  shadowSpanM: 34,
  shadowNearM: 1,
  shadowFarM: 90,
  /** pushes shadow acne off surfaces lit at a glancing angle. */
  shadowBias: -0.0008,
  shadowNormalBias: 0.03,
} as const;

/** The gradient sky dome, and the bank of cloud drifting inside it. */
export const SKY = {
  radiusM: 220,
  segments: 24,
  /** where the horizon and mid tones sit in the gradient (0 = ground, 1 = zenith). */
  horizonStop: 0.46,
  midStop: 0.66,
  /** texture height (px) of the one-pixel-wide gradient strip the dome is painted with. */
  texturePx: 128,
  /** distance fog, so the far side of the arena softens into the horizon. */
  fogNearM: 55,
  fogFarM: 190,
  /** the drifting cloud bank: how many, how high, and the ring they sit on (m). */
  clouds: { count: 14, minRadiusM: 60, maxRadiusM: 130, minHeightM: 16, maxHeightM: 46 },
  /** one cloud's size (m) and how fast the whole bank turns (rad/s). */
  cloudSizeM: 15,
  cloudDriftRate: 0.006,
} as const;

/**
 * The arena as a PLACE: a thick round island floating in the sky rather than a flat
 * disc painted on the void. Everything is sized off the stage radius, so a bigger
 * stage gets a bigger island for free.
 */
export const PLATFORM = {
  /** how far the island sticks out past the playable wall, and how deep it goes (m). */
  overhangM: 2.4,
  depthM: 3.6,
  /** the tapered underside: how much narrower the bottom is than the top. */
  taper: 0.62,
  /** the point the island tapers away to underneath (m) — it is floating, after all. */
  tipDepthM: 5,
  /** the coloured band running round the lip: its height and how far it stands proud (m). */
  rimHeightM: 0.36,
  rimOutM: 0.14,
  /** the low wall players are clamped by — chunky enough to read as a boundary (m). */
  wallHeightM: 0.9,
  wallThicknessM: 0.5,
  /** rounded corner posts spaced round that wall. */
  postCount: 24,
  postRadiusM: 0.3,
  postHeightM: 1.3,
  /** how many segments a platform ring gets — smooth, but not free. */
  segments: 64,
} as const;

/**
 * The floor: WEATHERED STONE FLAGS, painted procedurally rather than shipped.
 *
 * The old floor was a two-tone check — clean, readable, and completely flat. Real
 * stone is none of those things, and the four things that make it stone are all
 * cheap to paint: every flag is a slightly DIFFERENT tone, each one has a lit top
 * edge and a shaded bottom edge (a bevel is what gives a painted tile thickness),
 * the mortar between them is a dark irregular gap rather than a ruled line, and the
 * whole thing is speckled with wear.
 *
 * A 2×2 block of flags is painted and then repeated, so the pattern only obviously
 * repeats every four tiles instead of every one.
 */
export const FLOOR = {
  /**
   * How many 2×2 flag blocks fit across the whole arena — higher = smaller flags.
   *
   * The arena is 48m across and the plaza 32m, so this is the number that decides
   * whether a flagstone is something you could stand on (about a metre) or a slab
   * the size of a car. Fifteen puts it at roughly 1.1m in the plaza and 1.6m in a
   * match, which is a paving stone in both.
   */
  repeats: 15,
  /** texture resolution (px) of the block that gets repeated. */
  texturePx: 512,
  /** the mortar gap between flags, as a fraction of one flag. */
  mortarWidth: 0.05,
  /** how ragged the mortar line is, as a fraction of a flag — 0 would be a ruled grid. */
  mortarJitter: 0.014,
  /** the lit top bevel and the shaded bottom one, as a fraction of a flag. */
  bevelWidth: 0.055,
  /** how far each flag's own tone strays from the base stone (0–1). */
  toneVariance: 0.2,
  /** wear: how many speckles per flag, and how big they get (fraction of a flag). */
  speckleCount: 140,
  speckleMaxSize: 0.02,
  /** hairline cracks worn into the stone: how many per block, and how long. */
  crackCount: 5,
  crackLength: 0.42,
  crackSteps: 7,
} as const;

/**
 * Cartoon grass, growing through the stone.
 *
 * Nothing says "outdoors" like something GROWING in the floor. The patches are
 * painted alpha decals laid flat where the flags are worn out (round the wall and
 * scattered through the middle), plus a few real blades standing up out of them —
 * the decals do the colour, the blades do the silhouette, and neither is expensive.
 */
export const GRASS = {
  /** the painted patch: canvas size, how many tufts are drawn into one, how big. */
  texturePx: 256,
  /** ONE standing tuft, painted for the crossed quads: canvas, blades, and their splay */
  tuftTexturePx: 64,
  bladesPerTuft: 5,
  tuftSplay: 0.9,
  tuftsPerPatch: 54,
  bladeSpread: 0.9,
  /** patches scattered over the arena floor: how many, and the size range (m). */
  patchCount: 30,
  minPatchM: 2.2,
  maxPatchM: 4.6,
  /** patches only grow outside this fraction of the radius — the middle is swept clean. */
  minRadiusRatio: 0.3,
  maxRadiusRatio: 0.99,
  /**
   * Standing blades, and the thing that decides whether grass reads as GRASS: they
   * grow inside the painted patches, `bladesPerPatch` to each one, rather than being
   * scattered evenly over the arena. Sprinkled evenly they are green specks on a
   * stone floor — litter. Clustered where the paint already is, the same meshes read
   * as tufts coming up through the cracks, which is the whole idea.
   */
  bladesPerPatch: 11,
  bladeSpreadRatio: 0.66,
  bladeWidthM: 0.34,
  bladeHeightM: 0.3,
  /** how far off the floor the decals sit, and the blades' sway (rad and rate). */
  liftM: 0.008,
  swayRad: 0.14,
  swayRate: 1.4,
} as const;

/**
 * The backdrop: a stylised forest and village ringing the arena, instead of a void.
 *
 * It is drawn as three RINGS at different distances — near trees, a village, far
 * hills — each one paler and hazier than the last. That is the whole trick behind
 * the "depth of field" the brief asks for: real DOF is a post-processing pass and a
 * dependency we do not have, but a cartoon does not want a blur anyway. It wants the
 * distance to go pale and lose its detail, which is what aerial perspective is, and
 * the scene fog already does half of it for free.
 *
 * Every ring is instanced, so the whole world outside the arena is a handful of
 * draw calls.
 */
export const BACKDROP = {
  /** the near treeline: how many, how far out (m) and the size of one tree (m). */
  trees: { count: 46, radiusM: 46, jitterM: 9, minHeightM: 5, maxHeightM: 11 },
  /** a tree is a trunk with three tiers of foliage stacked into a cone. */
  treeTiers: 3,
  treeTrunkRatio: 0.3,
  treeCanopyRatio: 0.62,
  /** the village behind the trees: cottages with pitched roofs, ringed further out. */
  village: { count: 11, radiusM: 68, jitterM: 7, minWidthM: 5, maxWidthM: 8.5 },
  cottageHeightRatio: 0.72,
  roofHeightRatio: 0.6,
  roofOverhang: 1.18,
  /** far hills: big soft blobs on the horizon, well inside the fog. */
  hills: { count: 9, radiusM: 128, minRadiusM: 22, maxRadiusM: 40, sinkRatio: 0.55 },
  /**
   * How much each ring is washed out toward the sky colour (0 = its own colour, 1 =
   * gone). This is the aerial perspective, applied as a tint rather than a blur.
   */
  hazeNear: 0.16,
  hazeMid: 0.42,
  hazeFar: 0.72,
  /**
   * The plain everything out there stands on, and how far BELOW the arena floor it
   * sits (m).
   *
   * The drop is what turns the island into a raised stone plateau instead of a slab
   * hanging in space: the arena looks down on the countryside, the countryside runs
   * off to the fog, and the island's tapered underside is safely buried out of
   * sight beneath it.
   */
  groundDropM: 3,
  groundRadiusM: 165,
  groundSegments: 48,
} as const;

/**
 * The shrinking safe zone, drawn as a wall of light rather than a line on the floor
 * — you can see it coming from anywhere in the arena, which is the whole point.
 */
export const ZONE_FX = {
  wallHeightM: 6,
  wallOpacity: 0.24,
  /** the bright band where the wall meets the floor. */
  edgeHeightM: 0.16,
  /** how fast the wall pulses, and by how much. */
  pulseRate: 1.6,
  pulseAmount: 0.07,
  segments: 64,
} as const;

/**
 * The AUTHORED character: which `.glb` is worn, how big it is drawn, and how its
 * canned clips are blended into a walk.
 *
 * The models are KayKit (CC0), stripped to the clips the game plays by
 * `tools/model-pipeline/strip-clips.mjs` and served out of `public/models/`. Every
 * one of them rides the SAME 41-bone rig, which is what lets one number scale all
 * of them and one bone name find every hand.
 */
export const MODEL = {
  /** where `strip-clips.mjs` puts its output, as the browser sees it */
  dir: "/models/",
  /** the character everybody wears until Phase 08 lets them choose one */
  defaultId: "Knight",
  /**
   * ONE scale for every character — deliberately not a per-character height
   * normalisation.
   *
   * They all ride the same rig, so they are the same person underneath and a Mage
   * measures taller only because of his hat. Normalising each model to a target
   * height would shrink his BODY to make room for that hat, and the roster would
   * quietly stop being one cast standing on one floor. This number takes the pack's
   * own proportions to roughly the 2.05m the camera, the arena and the nameplate
   * were all built around.
   */
  scale: 0.85,
  /** how long the mixer takes to cross-fade between two locomotion clips (seconds) */
  fadeSeconds: 0.18,
  /**
   * How fast each locomotion clip was AUTHORED to travel (m/s at `timeScale` 1).
   *
   * The clip is then time-scaled by the character's real speed over this, which is
   * the same distance-driven idea the hand-written walk used: the feet keep up with
   * a player being interpolated, or slid across a rain-slicked floor by knockback,
   * instead of skating along at a fixed cadence.
   */
  walkClipSpeed: 1.35,
  runClipSpeed: 3.4,
  /** slower than this (m/s) and the character is simply standing there */
  idleAboveSpeed: 0.12,
  /** faster than this (m/s) the walk gives way to the run */
  runAboveSpeed: 2.9,
  /** how far the clip's playback may be pushed before it reads as a fast-forward */
  minTimeScale: 0.6,
  maxTimeScale: 1.8,
  /**
   * The weapons and shields the pack builds into a character.
   *
   * They are hidden rather than deleted: the hammer is the ONLY weapon in this
   * game, and a Knight who spawns holding a longsword he can never swing reads as
   * a bug. Hats and helmets are left alone — those are the character.
   */
  builtInGear:
    /Sword|Shield|Staff|Wand|Dagger|Knife|Throwable|Crossbow|Spellbook|Quiver|Blade|Axe|Arrow|Mug|Turret/i,
  /**
   * The one mesh on a character that casts a real shadow.
   *
   * Everything with `castShadow` is drawn TWICE — once into the shadow map, once for
   * the camera — so a character built from eight meshes costs sixteen draws before
   * anything else. At 25 players the shadow map is the first thing to cost real
   * frames on a phone, and a head, a cape, an arm or a leg never casts a shadow the
   * torso was not already casting at this camera height. Every character is grounded
   * by its painted contact blob anyway, which is sharper than the map and free.
   *
   * If a future character has no mesh matching this, every mesh casts rather than
   * none — a shadowless character is a bug you notice late.
   */
  shadowCaster: /_Body$/i,
  /** `GLTFLoader` strips dots from node names, so `handslot.r` arrives as this */
  handSlotBone: "handslotr",
} as const;

/**
 * The clips the stripped `.glb` still carries.
 *
 * A closed set of strings that gets compared, so it is a named const rather than a
 * literal typed out at each call site — but a PRESENTATION one: these are asset
 * names, they never go on the wire, and the server has never heard of them.
 */
export const MODEL_CLIP = {
  Idle: "Idle",
  Walk: "Walking_A",
  Run: "Running_A",
  Swing: "2H_Melee_Attack_Chop",
  Hit: "Hit_A",
  Death: "Death_A",
  /** the frozen last frame of `Death_A` — a POSE, so its duration is zero */
  DeathPose: "Death_A_Pose",
  Cheer: "Cheer",
  /** the airborne pose a ghost drifts in */
  Float: "Jump_Idle",
} as const;

export type ModelClip = (typeof MODEL_CLIP)[keyof typeof MODEL_CLIP];

/**
 * The cute low-poly character, as measured anchor points (metres, model space).
 *
 * Every mesh — body parts, hats, glasses, backpacks, the held hammer — positions
 * itself off THIS, so re-proportioning the character moves the cosmetics with it
 * instead of leaving a crown floating where the old head used to be.
 */
export const RIG = {
  /**
   * A big round head on a small body — the chibi ratio every cute character in the
   * genre is built on. The head is where all the personality is, so it gets the
   * room.
   */
  head: { y: 1.5, radius: 0.5 },
  /**
   * The hair, in four pieces, all measured from the CENTRE OF THE HEAD.
   *
   * A bald sphere is the single thing that made the old character read as a doll:
   * every silhouette was the same circle. Hair is what breaks that outline, and the
   * pieces that break it most are the ones that MOVE — the fringe swings, the side
   * locks trail a turn, and the cowlick never quite settles.
   */
  hair: {
    /** how far off the skull the two shells sit */
    shellScale: 1.05,
    /**
     * How far down from the crown the cap comes (radians). It stops just above the
     * brow line, because the brows are half of every expression the face has.
     */
    capThetaRad: 0.98,
    /** the cap is stretched forward, so its front edge juts over the brow as a fringe */
    capJut: 1.08,
    /** the back shell carries on past the equator, and wraps this far round the sides */
    backThetaRad: 1.78,
    backWidthRad: 3.7,
    /** a fringe swept over one side of the forehead: where, how tilted, and how big */
    fringe: { x: 0.12, y: 0.3, z: 0.22, tiltRad: 0.35, scale: [0.62, 0.3, 0.5] as const },
    /** a lock down each side of the face, hung from the temple so it can swing */
    lock: { x: 0.47, y: 0.14, z: -0.02, radiusM: 0.09, lengthM: 0.22, restTiltRad: 0.16 },
    /** the cowlick: one stray tuft that bounces a beat behind everything else */
    cowlick: { y: 0.46, z: -0.06, radiusM: 0.035, lengthM: 0.24, tiltRad: -0.5 },
  },
  /** the rounded "bean" torso — a sphere squashed a little on the vertical */
  body: { y: 0.76, radius: 0.41, squash: 0.86 },
  /**
   * The clothes.
   *
   * The body used to be one flat-coloured bean, which is why it read as a jelly
   * bean rather than as somebody dressed for a party. Four bands of trim — a
   * collar, a chest panel, a belt and a flared hem — cost four meshes and turn the
   * same bean into an outfit, and each one also draws a line ACROSS the body, which
   * is what gives a round shape any sense of depth at all.
   */
  outfit: {
    /**
     * The placket down the front of the tunic. Narrow on purpose: a wide panel
     * across a round chest reads as a bib, where a strip down the middle reads as
     * the front of a jacket and gives the body a centre line to be round about.
     */
    bib: { y: 0.88, z: 0.29, widthM: 0.16, heightM: 0.34, depthM: 0.12, cornerM: 0.06 },
    /** the belt round the waist, and the buckle on the front of it */
    belt: { y: 0.6, radiusM: 0.378, heightM: 0.11 },
    buckle: { y: 0.6, z: 0.37, sizeM: 0.11, depthM: 0.05 },
    /** the flared hem hanging off the waist — an open cone, so the legs swing inside it */
    skirt: { y: 0.5, topRadiusM: 0.38, bottomRadiusM: 0.53, heightM: 0.27, sides: 20 },
  },
  /**
   * The scarf: a ring round the neck, a knot at the throat, and a two-segment tail
   * off the back.
   *
   * The ring is also the tunic's COLLAR — one piece doing both jobs, because a
   * collar and a scarf at the same neck is one ring too many. It earns the rest of
   * its meshes by never being still: standing about it drifts, walking it streams,
   * turning it swings wide, and a hammer blow snaps it forward. It is the cheapest
   * way to put wind and weight into a character that has neither.
   */
  scarf: {
    ring: { y: 1.12, radiusM: 0.205, thicknessM: 0.055 },
    knot: { y: 1.09, z: 0.19, radiusM: 0.08 },
    tail: { y: 1.06, z: -0.14, widthM: 0.17, segmentM: 0.28, thicknessM: 0.04, restTiltRad: 0.5 },
  },
  /**
   * Long noodle arms hanging from the shoulder pivot, so the swing rotates about
   * the right place — and so they have some flop in them when the body moves.
   */
  arm: { x: 0.43, shoulderY: 0.98, length: 0.5, radius: 0.115, restSpreadRad: 0.2 },
  /** the ball of the shoulder, which is what stops an arm reading as a stuck-on stick */
  shoulder: { radiusM: 0.148 },
  /** the sleeve cuff, measured down the arm from the shoulder */
  cuff: { dropM: 0.33, radiusM: 0.138, heightM: 0.08 },
  /** big mitten hands: the ball on the end of an arm, as a multiple of its radius */
  handScale: 1.5,
  /** stubby legs, hung from hips tucked up inside the bean */
  leg: { x: 0.17, hipY: 0.46, length: 0.3, radius: 0.14 },
  /** big rounded shoes, so the character stands on something and lands on it */
  foot: { length: 0.4, width: 0.29, height: 0.19, forwardM: 0.08 },
  /** the boot: a cuff round the ankle and a sole under the shoe, both in trim colour */
  boot: { cuffRadiusM: 0.168, cuffHeightM: 0.09, soleHeightM: 0.06 },
  /**
   * The face is PAINTED, not modelled: one curved plate hugging the front of the
   * head, carrying the eyes, brows, mouth and blush as a texture (`textures.ts`).
   * That is what lets it blink and wince for the cost of one mesh — with 25 players
   * on a phone, a dozen little face meshes each is not a trade worth making.
   */
  facePlate: { phiLength: 2.1, thetaLength: 2, liftM: 0.008 },
  /** where the painted eyes sit — the anchor an eyepatch or a monocle lines up with */
  eye: { x: 0.19, y: 1.54, z: 0.42, radius: 0.1 },
  /** brim/base height of a hat, i.e. the top of the skull */
  hatY: 1.97,
  /** where glasses and visors sit on the face */
  face: { y: 1.5, z: 0.47 },
  /** where a cape/backpack/wings hang off the back */
  back: { y: 0.92, z: -0.36 },
  /**
   * How far the pommel hangs below the fist. The hammer is hung off the ARM's own
   * tip rather than a hand anchor of its own — an anchor beside the arm drifts away
   * from it the moment the arm splays or swings, and a hammer floating next to a
   * hand is the one thing that would give the whole character away.
   */
  hand: { gripDropM: 0.1 },
  /**
   * The head radius the cosmetics were modelled against. Hats and glasses carry
   * absolute measurements, so they are worn at `head.radius / cosmeticBaseRadius` —
   * re-proportioning the character then takes the whole wardrobe with it, instead
   * of leaving a crown three sizes too small on a head that grew.
   */
  cosmeticBaseRadius: 0.44,
  /** total standing height — what the name tag and FX clear */
  heightM: 2.05,
} as const;

/**
 * Level of detail, by distance from the camera.
 *
 * A character is ~34 meshes up close and ~20 further off: the chest panel, the
 * buckle, the cuffs, the soles and the loose hair simply are not built for anybody
 * you cannot see them on.
 *
 * This is what makes the richer character affordable at 25 players. The phone in
 * somebody's hand only ever has a handful of people close to it, and the Host's
 * camera — the one that really does see all 25 — is far enough away that everybody
 * on it is cheap.
 *
 * The two distances are deliberately different: a player standing exactly on one
 * line would otherwise rebuild their own trim every frame.
 */
export const LOD = {
  /** closer than this (m) a character is drawn with all its trim... */
  detailInM: 13,
  /** ...and it is dropped again once they are this far away */
  detailOutM: 15.5,
} as const;

/**
 * The painted face, in DESIGN pixels — the coordinates the drawing code in
 * `three/textures.ts` works in, on a square canvas that is then wrapped over the
 * front of the head.
 *
 * Keeping them here rather than inline in the drawing means the face can be
 * re-proportioned (bigger eyes, higher brows, more blush) without reading a line of
 * canvas code — which is exactly the knob you reach for when a character does not
 * look cute enough yet.
 */
export const FACE = {
  /** the canvas the face is drawn on, and the grid its coordinates are in */
  texturePx: 256,
  designPx: 256,
  centreX: 128,
  /** the eyes: how far apart, how high, and how big the white behind them is */
  eyeSpreadX: 44,
  eyeY: 114,
  eyeRx: 33,
  eyeRy: 41,
  /**
   * The iris, in three layers: a coloured disc, a dark pupil in the middle of it,
   * and a brighter pool at the bottom where light has come through from the other
   * side. That last one is the whole trick — it is the difference between an eye
   * and a dot.
   */
  irisR: 27,
  irisDrop: 5,
  pupilR: 13,
  glowR: 14,
  glowDrop: 11,
  /** the catchlights: a big one up and left, a small one opposite it */
  shineOffset: 12,
  shineR: 9,
  sparkOffset: 10,
  sparkR: 4.5,
  /** the lash line over each eye, and how far it flicks out past the corner */
  lashWidth: 9,
  lashFlick: 12,
  /** shut eyes, drawn as a raised curve rather than a flat line */
  lidWidth: 11,
  lidLift: 8,
  /** the spiral a knocked-out player's eyes turn into: how many turns, how wide, how smooth */
  spiralTurns: 1.8,
  spiralSpread: 0.85,
  spiralSteps: 26,
  /** the brows — sat close over the eyes; their tilt is the whole expression */
  browY: 60,
  browW: 40,
  browH: 9,
  browTiltRad: 0.18,
  /** how far the brows drop when the character means it — mid-swing */
  browFierceDrop: 8,
  /** the smile: how wide, how far it drops, and where it sits */
  mouthY: 172,
  mouthW: 58,
  mouthDrop: 30,
  /** the open mouth: wide and round for a battle cry, small and pinched for a wince */
  shoutScale: 1.15,
  owScale: 0.85,
  /** blush, high on each cheek */
  blushY: 154,
  blushSpreadX: 88,
  blushRx: 27,
  blushRy: 16,
  blushAlpha: 0.55,
} as const;

/**
 * Toon shading, as a gradient RAMP the character's materials are lit through.
 *
 * `meshToonMaterial` reads a 1D texture instead of a smooth falloff, so the light
 * on a face steps between a few flat tones rather than smearing between them —
 * which is exactly how a drawn character is shaded, and why the world (still lit
 * with ordinary PBR) reads as the place these people are standing in rather than as
 * more of the same material.
 *
 * Four steps: the shadow side, two mid tones, and the lit side.
 */
export const TOON = {
  steps: [0.42, 0.68, 0.86, 1] as const,
} as const;

/**
 * The painted swing SMEAR (`three/textures.ts`), in the square canvas it is drawn
 * on. Everything is a fraction of that canvas, so the crescent can be re-drawn at
 * any resolution without moving.
 */
export const SLASH = {
  texturePx: 256,
  /** how far round the crescent sweeps (radians) and how far out from the middle it sits */
  sweepRad: 2.6,
  radius: 0.62,
  /** how fat the smear is at its leading edge, and the fraction of that left at the tail */
  widthRatio: 0.3,
  tailWidth: 0.18,
  /** how fast the tail comes up to full brightness, and where the soft core ends */
  leadFade: 2.4,
  coreStop: 0.45,
  /** how many dots the arc is laid down as — the taper's resolution */
  steps: 44,
} as const;

/** The painted impact STAR: a blown-out core with alternating long and short rays. */
export const BURST = {
  texturePx: 128,
  rays: 12,
  longRay: 0.98,
  shortRay: 0.58,
  /** how wide a ray is at its base, as a fraction of the gap between two of them */
  rayWidth: 0.55,
  /** the core, as a fraction of the canvas, and where its soft edge begins */
  coreRadius: 0.5,
  coreStop: 0.4,
} as const;

/**
 * The soft blob under every character.
 *
 * One transparent disc beats a shadow map for grounding a cartoon character, it
 * costs nothing at 25 players, and it keeps working on the phones where the real
 * shadows are the first thing we would turn down.
 */
export const BLOB_SHADOW = {
  radiusM: 0.66,
  opacity: 0.32,
  /**
   * The ring drawn round YOUR OWN blob, in your own colour — how you find yourself
   * in a crowd of 25. It replaces the glow the body used to wear, which fought with
   * the tint it was glowing through and washed out the colour it was pointing at.
   */
  selfRing: { innerM: 0.68, outerM: 0.82, opacity: 0.8 },
  /** how far off the floor it floats (m) — above the tiles, under everything else. */
  liftM: 0.02,
  /** height (m) at which the blob has shrunk and faded away entirely. */
  fadeHeightM: 2.2,
  texturePx: 64,
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
  legSwingRad: 1.05,
  armSwingRad: 0.75,
  /** how far the arms lift away from the body as the character gets going (radians) */
  armSpreadRad: 0.24,
  /** vertical bounce and forward lean at full speed */
  bobM: 0.085,
  leanRad: 0.16,
  /** the roll and the yaw the torso trades off against the legs each stride */
  swayRad: 0.07,
  twistRad: 0.13,
  /** the squash on each footfall — the thing that makes a walk land rather than glide */
  footfallSquash: 0.055,
  /** idle breathing: rate (Hz-ish) and how much the torso swells */
  idleRate: 1.7,
  idleScale: 0.035,
  /** idle sway: the slow weight shift of somebody standing about waiting */
  idleSwayRate: 0.85,
  idleSwayRad: 0.04,
  /** blink: roughly this often (ms), varied by this much, and this long shut (ms) */
  blinkEveryMs: 3600,
  blinkJitterMs: 3000,
  blinkMs: 120,
  /** how long the wince stays on after a hit (ms) — longer than the body's squash */
  hurtFaceMs: 600,
  /**
   * Head lag: the head keeps its old heading for a beat when the body turns, then
   * catches up. It is the cheapest trick in animation and the one that does most to
   * stop a character reading as a single rigid object being slid around.
   */
  headLagRad: 0.5,
  headLagRate: 7,
  /** the slow head tilt of somebody standing about with nothing to do */
  idleTiltRad: 0.06,
  idleTiltRate: 0.6,
  /**
   * The foot rolls onto its toe as it leaves the floor and lands flat again. It is
   * the difference between walking and a pair of shoes being waved about, and it is
   * one extra rotation on a joint that already exists.
   */
  footRollRad: 0.55,
  /**
   * Secondary motion — the hair and the scarf.
   *
   * Neither is animated by the walk cycle: both are DRAGGED by it. They are pulled
   * by how fast the body is moving and how hard it just turned, then eased back to
   * rest, which is why they keep going for a beat after the character has stopped.
   * Nothing else on the rig does as much to make it look like a thing that is alive
   * rather than a thing being moved.
   */
  hairLagRad: 0.42,
  hairLagRate: 8,
  scarfLagRad: 0.85,
  scarfLagRate: 5,
  /** how far the scarf streams out behind at full speed, and the wave running down it */
  scarfStreamRad: 1.15,
  scarfWaveRate: 3.4,
  scarfWaveRad: 0.18,
  /** the cowlick bounces on its own clock — looser and faster than anything else */
  cowlickRate: 2.6,
  cowlickRad: 0.22,
  /** how fast the measured speed follows the real one (exponential rate) */
  speedEaseRate: 9,
  /** speed (m/s) that counts as a full-tilt run for animation blending */
  fullSpeed: MOVE_SPEED,
  /** below this speed (m/s) the character is treated as standing still */
  idleSpeed: 0.15,
} as const;

/**
 * The hammer, as a model rather than a stick with a box on it: a tapered haft with
 * a wrapped grip and a pommel, and a banded head with a proper striking face.
 *
 * Scale is the only thing that differs between the one in your hand and the one
 * bobbing on the floor, so the two can never drift apart.
 */
export const HAMMER = {
  /** the haft: tapering towards the head, with a wrapped grip and a capped pommel */
  haft: { lengthM: 0.62, topRadiusM: 0.05, bottomRadiusM: 0.066, sides: 8 },
  grip: { startM: 0.04, lengthM: 0.26, radiusM: 0.08, sides: 8 },
  pommel: { radiusM: 0.088, heightM: 0.07, sides: 8 },
  /** the collar the haft disappears into where it meets the head */
  collar: { radiusM: 0.1, heightM: 0.09, sides: 8 },
  /**
   * THE HEAD, and the reason this file has a list of numbers in it.
   *
   * It is a LATHE: a profile turned about the axis the hammer strikes along, which
   * gets the chamfered striking faces, the waist and the swell of a cast-metal head
   * out of ONE mesh. The old head was a rounded box with a box band round it — two
   * meshes to say "block", and a silhouette that gave nothing away about which end
   * hits you.
   *
   * The pairs are `[distance along the axis, radius]`, running from one face to the
   * other; both ends close at radius 0 so the shape is solid.
   *
   * That axis lies ACROSS the swing (sideways, +x) rather than along it. It is the
   * difference between a mallet and an axe, and it is decided by where the camera
   * is: the arm swings the hammer over in the yz plane, so a head pointing the same
   * way is seen END-ON — a grey disc — from the one angle that matters, which is
   * directly behind the player. Turned across, the whole width of it sweeps down
   * the screen.
   */
  head: {
    profile: [
      [-0.22, 0],
      [-0.22, 0.132],
      [-0.212, 0.172],
      [-0.188, 0.191],
      [-0.115, 0.186],
      [0, 0.156],
      [0.115, 0.186],
      [0.188, 0.191],
      [0.212, 0.172],
      [0.22, 0.132],
      [0.22, 0],
    ] as const,
    segments: 14,
  },
  /** the band round the head's waist, sunk into it rather than stuck on top */
  band: { radiusM: 0.172, lengthM: 0.11, sides: 14 },
  /**
   * How the hammer is carried when nobody is swinging it: shouldered — tipped back
   * and out away from the body, so it frames the character instead of standing up
   * through its face. `[x, z]` radians, added to whatever the swing is doing.
   */
  restTilt: { backRad: -0.5, outRad: 0.66 },
  /** the star that twinkles off a golden head: how big (m), and how fast it turns. */
  sparkleM: 0.17,
  sparkleRate: 2.6,
} as const;

/**
 * Combat FX that live in the 3D world rather than the HUD.
 *
 * A hammer blow is the game, so it is drawn as four things landing at once: the
 * victim SQUASHES and FLASHES white, a STAR pops at the point of contact, SPARKS
 * are thrown out of it, and a RING punches outward along the ground. Any one of
 * them on its own reads as a glitch; together they read as a hit.
 */
export const COMBAT_FX = {
  /** how long a hit squashes the victim, and by how much */
  squashMs: 260,
  squashAmount: 0.3,
  /** the white the victim flashes on the frame of contact: how long, and how hard */
  flashMs: 170,
  flashAmount: 0.9,
  /** the expanding impact ring: how long it lives and how big it gets (m) */
  burstMs: 340,
  burstRadiusM: 1.5,
  /** the star that pops where the head lands: how long it lives, how big (m), how far it turns */
  starMs: 240,
  starM: 1.3,
  starSpinRad: 0.9,
  /**
   * The smear the head leaves through the air. It lives exactly as long as the blow
   * that made it, so all it needs is a SIZE (m) — the painted crescent is drawn
   * centred on the SHOULDER, so the quad has to be wide enough to reach the hammer
   * head at the far end of the arm.
   *
   * The quad is BILLBOARDED — turned to face the camera and then spun in its own
   * plane to point where the hammer is. A smear is a drawn effect, not an object in
   * the world: pinned into the arc in 3D it vanishes the moment you are looking
   * along that arc, which from a camera parked behind the player is most of the
   * time.
   *
   * `trailPhaseRad` is where the crescent points when the arm points straight ahead
   * (a quarter turn: the painted crescent's own middle runs along the texture's x).
   * `trailSweepGain` is how much of the arm's sweep it echoes — a shade over 1, so
   * the smear reaches a little past the arm on both sides, the way a drawn one does.
   */
  trailSizeM: 3.2,
  trailPhaseRad: 0,
  trailSweepGain: 1.3,
  /** the puff of dust kicked up in front of the feet as the blow lands */
  dustMs: 340,
  dustRadiusM: 1.2,
  /** how long a defeated player's poof of dust hangs around (ms) */
  poofMs: 700,
  /**
   * SPARKS — the thing a hammer on stone actually throws, and the one piece of the
   * impact that has to look like it has physics behind it.
   *
   * One `Points` buffer per character, `count` particles, fired out of the point of
   * contact on a cone and then pulled down by gravity. They are the only FX here
   * that MOVE independently rather than scaling a quad, which is exactly why they
   * sell the hit: everything else is a picture of an impact, the sparks are debris
   * from one.
   */
  sparkCount: 26,
  sparkMs: 520,
  /** how fast they leave (m/s), how much that varies, and the gravity on them (m/s²) */
  sparkSpeed: 7,
  sparkSpeedJitter: 4.5,
  sparkGravity: 16,
  /** the cone they are thrown into: mostly sideways and up, never straight down */
  sparkConeRad: 1.15,
  sparkRiseRatio: 0.55,
  /** how big one spark is drawn (px at one metre) and how far it shrinks as it dies */
  sparkSizePx: 26,
  sparkFadePower: 2,
  /**
   * The CRACKS a ground smash leaves in the flags: a painted radial star of
   * fractures, snapped onto the floor where the hammer landed and fading out over a
   * couple of seconds.
   *
   * It is the one impact effect that OUTLIVES the impact, which is why it matters —
   * a fight leaves a floor that has been fought on.
   */
  crackMs: 2200,
  crackRadiusM: 1.9,
  /** how quickly it snaps out to full size (fraction of its life) before it just fades */
  crackGrowth: 0.05,
  crackOpacity: 0.85,
  /** how far off the floor a fracture decal floats (m) — over the flags, under everything */
  crackLiftM: 0.014,
  /** how far along the hammer's reach the head actually lands, as a fraction of it */
  crackReachRatio: 0.62,
  /** how many cracks can be on the floor at once — the oldest is recycled */
  crackPool: 14,
  /** the painted fracture star (`three/textures.ts`): canvas size and its shape */
  crackTexturePx: 256,
  crackArms: 7,
  crackSteps: 9,
  /** how far a fracture can wander per step (rad), and how often it splits */
  crackWander: 0.75,
  crackBranchChance: 0.34,
  /** the soft dot every spark and dust mote is drawn with */
  dotTexturePx: 64,
} as const;

/**
 * Rising DUST — the fine stuff hanging in the air over a stone arena.
 *
 * One `Points` cloud that drifts slowly upward and wraps round when it reaches the
 * top, parented to nothing and centred on the camera. It costs one draw call and it
 * is the difference between "characters composited onto a floor" and "characters
 * standing in a place with air in it".
 */
export const AMBIENT_DUST = {
  count: 160,
  /** the box the motes live in, centred on the camera (m) */
  radiusM: 26,
  ceilingM: 7,
  /** how fast they rise and drift sideways (m/s) */
  riseSpeed: 0.32,
  driftSpeed: 0.18,
  sizePx: 12,
  opacity: 0.4,
} as const;

/**
 * TARGETING: the ring under whoever your next swing would land on, and the reticle
 * over their head.
 *
 * The server decides who a swing hits; this only draws the same test the server will
 * run — everyone inside your hammer's reach and arc, nearest first. It is purely a
 * read of information the player already has, so a wrong guess costs nothing but a
 * ring in the wrong place for one frame.
 */
export const TARGETING = {
  /** the selection ring on the floor: size (m), how fast it spins and pulses */
  ringInnerM: 0.72,
  ringOuterM: 0.94,
  spinRate: 0.6,
  pulseRate: 3.2,
  pulseAmount: 0.08,
  opacity: 0.9,
  /** how fast the ring slides from the old target to a new one (exponential rate) */
  easeRate: 14,
  /** the reticle floating over the target's head: how high (m) and how big (m) */
  reticleY: 2.35,
  reticleM: 0.72,
  reticleSpinRate: -0.9,
  /** the painted reticle: canvas size, its corner brackets and the ring behind them */
  texturePx: 128,
  bracketSweepRad: 0.55,
  bracketWidth: 0.09,
  bracketRadius: 0.82,
  ringRadius: 0.5,
  ringWidth: 0.05,
} as const;

/**
 * The floating DAMAGE NUMBERS.
 *
 * A fixed POOL of overlay tags, recycled oldest-first and animated imperatively —
 * never through React state. A blow lands several times a second per player and
 * there can be a dozen fights at once; re-rendering a component tree for each one is
 * the one thing this must not do.
 *
 * Big numbers are drawn bigger and hotter than small ones, so a golden-hammer hit
 * for 250 does not read the same as a fast tap for 2 — which is most of what makes
 * damage numbers worth having at all.
 */
export const DAMAGE_FX = {
  /** how many numbers can be in the air at once, and how long one lives (ms) */
  pool: 16,
  lifeMs: 900,
  /** how far it floats up (m) and how far it drifts sideways from the hit (m) */
  riseM: 1.3,
  spreadM: 0.5,
  /** where it starts, relative to the victim's feet (m) */
  startY: 1.5,
  /** the pop: it overshoots to this scale and settles back over this fraction of its life */
  popScale: 1.45,
  popPhase: 0.22,
  /** it holds full opacity for this fraction of its life, then fades out */
  holdPhase: 0.5,
  /** font size (px) for the smallest hit, and for one at or above `bigDamage` */
  minSizePx: 17,
  maxSizePx: 40,
  /** damage at which a number is drawn at full size and in the hot colour */
  bigDamage: 60,
  /** how the overlay tag scales with distance (drei `distanceFactor`) */
  distanceFactor: 11,
} as const;

/**
 * The floating NAMEPLATE over each player: the name, and a segmented HP bar.
 *
 * The bar is drawn in three layers on purpose. The dark track is the MAX — you can
 * see how much someone has left as a fraction of what they started with. The pale
 * segment behind the fill is the DAMAGE just taken, which drains away a beat later,
 * so a hit is legible as a hit rather than as a bar that is quietly a bit shorter.
 * The bright segment is what they actually have.
 */
export const NAMEPLATE = {
  /**
   * How high it floats (m), and how it scales with distance (drei `distanceFactor`).
   *
   * It has to clear the tallest HAT, not the head — the character is 2.05m and the
   * top hat puts another half metre on that, so a plate sized to the skull lands on
   * the brim.
   */
  y: 3.05,
  distanceFactor: 13,
  /** the bar (px in the overlay), and how round its ends are */
  barWidth: 62,
  barHeight: 9,
  barRadius: 5,
  /** how fast the pale "damage taken" segment drains back to the real HP (per second) */
  drainRate: 1.6,
  /** the drain waits this long (ms) after a hit before it starts, so the loss registers */
  drainDelayMs: 320,
  /** the plate flashes this hard when its owner is hit, over this long (ms) */
  hitFlash: 0.85,
  hitFlashMs: 260,
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
  column: { offsetM: 2.2, heightM: 6.4, radiusM: 0.5 },
  /** banners hang from the columns: size and how far they drop (m) */
  banner: { widthM: 1.6, heightM: 3, offsetM: 1.6, topM: 5.4 },
  /** the pointed tail at the bottom of a banner (m) */
  bannerTailM: 0.44,
  /** braziers: how far out, how tall, and the size of the flame (m) */
  torch: { offsetM: 3.4, heightM: 2.4, flameM: 0.42 },
  /** the haze around a brazier's flame: how big (m) and how strong */
  torchGlow: { radiusM: 0.85, opacity: 0.22 },
  /** tiered spectator seating: how many rings, how far apart and how much each rises */
  stands: { tiers: 4, stepOutM: 2.1, stepUpM: 0.9, startOffsetM: 4.4 },
  /** the crowd packed into them: how many per tier, and how big one spectator is (m) */
  crowdPerTier: 44,
  crowdSizeM: 0.38,
  /** how far the crowd bobs and how fast — a stadium is never still */
  crowdBobM: 0.12,
  crowdBobRate: 2.1,
  /** cloud slabs for the floating stages: the ring they drift on (m) */
  cloud: { minRadiusM: 18, maxRadiusM: 42, minHeightM: -14, maxHeightM: 10, sizeM: 6 },
  /** how fast a torch flame flickers, and how much */
  flameFlickerRate: 9,
  flameFlickerAmount: 0.18,
} as const;

/**
 * The waiting-room plaza's own dressing. It is the first 3D thing anybody sees at
 * the party, so it gets planters, bunting and balloons rather than an empty disc.
 */
export const PLAZA_FX = {
  /** planters of shrubs and trees ringing the plaza */
  planter: { count: 8, offsetM: 1.5, radiusM: 1.1, heightM: 0.5 },
  tree: { trunkRadiusM: 0.17, trunkHeightM: 1.2, leafRadiusM: 0.8, leafTiers: 3 },
  /** balloons on strings, bobbing over the plaza edge */
  balloon: { count: 12, offsetM: 0.6, minHeightM: 3.6, maxHeightM: 5.4, radiusM: 0.44 },
  balloonBobM: 0.24,
  balloonBobRate: 0.85,
  /** bunting strung right round the plaza wall, and the rope it hangs from */
  bunting: { flagCount: 44, offsetM: 0.25, heightM: 2.6, sizeM: 0.38, ropeM: 0.03 },
  /** the medallion painted in the middle of the floor, as a fraction of the radius */
  medallion: { inner: 0.14, outer: 0.22 },
  /**
   * Confetti scattered over the plaza floor. Smaller and fainter than it used to be:
   * the floor underneath it is weathered stone now rather than a flat pastel check,
   * and big bright discs on top of that stopped reading as confetti and started
   * reading as litter.
   */
  confetti: { count: 54, minRadiusRatio: 0.18, maxRadiusRatio: 0.94, sizeM: 0.15 },
} as const;

export const AVATAR = {
  /**
   * How long a swing takes: a fraction of THAT HAMMER'S OWN cooldown, clamped to a
   * length the eye can read.
   *
   * A fixed 340ms was the same animation for every weapon, and it ran past the fast
   * hammer's 220ms cooldown — so holding attack restarted the arm mid-arc and the
   * whole thing turned to mush. Deriving it from the cooldown instead means the
   * fast hammer flicks, the heavy one is a slow haymaker you can see coming, and
   * the animation can never outlast the swing it is animating.
   */
  swingOfCooldown: 0.88,
  swingMinMs: 190,
  swingMaxMs: 620,
  /**
   * The beats of a swing, as fractions of its length: the wind-up finishes, the
   * blow lands, and the pose is HELD to `swingHold` before it unwinds.
   *
   * That hold is hit-stop — three or four frozen frames on the frame of contact.
   * It is the oldest trick in fighting games and it costs one `if`: without it the
   * arm passes through the target, with it the arm HITS something.
   */
  swingWindup: 0.3,
  swingStrike: 0.5,
  swingHold: 0.6,
  /**
   * The shape of the blow: the arm LIFTS from hanging at the side to swinging out
   * in front, then sweeps ROUND the body (radians).
   *
   * A vertical chop was the obvious first answer and the wrong one. The camera sits
   * behind the player, so an arc that travels straight down travels straight AWAY —
   * edge-on, foreshortened to nothing, and its smear invisible. A sweep round the
   * body crosses the screen instead, and it is also the shape of the thing the
   * server actually tests: a cone `arcDeg` wide around your facing.
   */
  swingRaiseRad: -1.5,
  swingStrikeRaiseRad: -1.15,
  /** how far round the body the arm winds back, and how far it carries through */
  swingBackRad: 1.2,
  swingThroughRad: 1.05,
  /**
   * The hammer's own whip. The head is heavy and the wrist is not rigid: it trails
   * the arm as the arm accelerates and comes over the top of it as the arm stops.
   * Drag and overlap — the thing that makes a swung weapon feel like it has mass
   * rather than being welded to a fist.
   */
  swingWhipRad: 0.55,
  /** the crouch on the wind-up, the hop as the blow lands, and the lunge into it (m) */
  swingCrouchM: 0.055,
  swingHopM: 0.09,
  swingLungeM: 0.2,
  /** the torso twist through the blow, and how far the head turns to look at it */
  swingTwistRad: 0.62,
  swingHeadRad: 0.32,
  /** the free arm throws itself back as a counterweight, and the feet take a stance */
  swingFreeArmRad: 0.7,
  swingStanceRad: 0.32,
  /** height (m) of the prank emoji, above the nameplate (`NAMEPLATE.y`). */
  prankTagY: 3.2,
  /** how long a 🍌/💣 hangs over the victim (ms). */
  prankFxMs: 1200,
  /** dimming applied to a player whose seat is held open for a reconnect. */
  disconnectedOpacity: 0.45,
} as const;

/**
 * THE DRESSING ROOM — a cosy room with a full-length mirror in it, rather than a
 * camera swung round at the character standing in the plaza.
 *
 * The whole scene is measured in metres from the middle of the mirror's foot, so it
 * frames itself off `DRESSING_CAMERA` and never needs hand-placing. It is drawn in
 * the SAME canvas as the world (the plaza is unmounted while it is open), which is
 * why a second WebGL context and a second copy of every texture never happen.
 */
export const DRESSING_ROOM = {
  /** the room shell: how wide, how deep, how tall (m) */
  widthM: 9,
  depthM: 7,
  heightM: 3.4,
  /** the wainscot panelling along the bottom of the walls, and its cap rail (m) */
  wainscotM: 1.05,
  railM: 0.09,
  /** the rug the character stands on (m) */
  rug: { radiusM: 1.9, ringM: 0.24, liftM: 0.004 },
  /**
   * The mirror: an ornate full-length oval in a turned frame, with the character
   * standing in it. It leans back a little, the way a real cheval mirror does.
   */
  mirror: {
    widthM: 1.7,
    heightM: 2.8,
    /** how thick the frame is round the glass, and the bevel inside it (m) */
    frameM: 0.16,
    bevelM: 0.05,
    /** the arched top: how far above the glass the crest rises (m) */
    crestM: 0.34,
    /** the feet it stands on: how far apart and how tall (m) */
    footSpreadM: 0.78,
    footM: 0.14,
    tiltRad: 0.05,
  },
  /** the character on its turntable: how fast a drag spins it, and how fast it eases */
  turntable: { dragRadPerPx: 0.011, easeRate: 6, idleSpinRate: 0.16 },
  /** shelves on the back wall: how many, how high the first one is, and the gap (m) */
  shelves: { count: 2, startY: 1.55, stepY: 0.72, widthM: 2.4, depthM: 0.34, thickM: 0.07 },
  /** what stands on them — books, pots and rolled maps, laid out along the shelf */
  props: { bookCount: 7, potCount: 2, scrollCount: 3 },
  /** the potted plant beside the mirror: pot and leaf sizes (m) */
  plant: { potRadiusM: 0.3, potHeightM: 0.42, leafCount: 7, leafM: 0.46 },
  /** the window on the side wall, and the warm shaft of light it throws in */
  window: { widthM: 1.5, heightM: 1.7, sillY: 1.35, barM: 0.06 },
  /** the wardrobe's own lighting — warm key from the window, cool fill from the room */
  keyIntensity: 1.35,
  fillIntensity: 0.55,
  ambientIntensity: 0.7,
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
  /**
   * Hold-to-swing repeat rate, as a fraction of THAT HAMMER'S cooldown. A shade
   * under 1 so a held button is always ready the instant the cooldown lifts, and
   * never so far under that the swing animation is restarted mid-blow. The server
   * still gates the real cooldown either way.
   */
  swingRepeatOfCooldown: 0.9,
  /** how often a cooldown dial (the ghost's prank buttons) refreshes (ms). */
  cooldownPollMs: 100,
} as const;

export const JOYSTICK = {
  sizePx: 118,
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
  boundaryWidthM: 0.34,
  /** pickup bob/spin speeds and float height. */
  pickupSpinRate: 2,
  pickupBobRate: 3,
  pickupBobAmplitudeM: 0.16,
  pickupHeightM: 1,
  /** how big the hammer lying on the floor is next to the one in a hand. */
  pickupHammerScale: 0.92,
  /** the glow disc under a pickup, and how fast it pulses. */
  pickupGlowM: 0.9,
  pickupGlowRate: 2.4,
} as const;
