import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  Quaternion,
  Vector3,
  type Camera,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type Points,
} from "three";
import {
  DEFAULT_COLOR_INDEX,
  DEFAULT_HAMMER,
  HAMMERS,
  HP_MAX,
  HammerKind,
  PLAYER_COLORS,
  approach,
  clamp,
  clamp01,
  type PrankKind,
} from "@hammer/shared";
import { usePlayerField } from "../store";
import { sampleOther } from "../net/movement";
import { diedAt, hitAt, markCrack, prankAt, swingAt } from "../runtime/combatFx";
import {
  ANIM,
  AVATAR,
  BLOB_SHADOW,
  COMBAT_FX,
  GHOST_FX,
  HAMMER,
  MODEL,
  MODEL_CLIP,
  NAMEPLATE,
  RIG,
  type ModelClip,
} from "../config/view";
import { PRANK_COPY } from "../config/copy";
import { IMPACT_COLORS, hammerStyle, hpColor, hpRatio } from "../config/theme";
import { ModelCharacter, type ModelCharacterHandles } from "./ModelCharacter";
import { locomotionClip, locomotionTimeScale } from "./locomotion";
import { Sparks, animateSparks } from "./Impact";
import { burstTexture, slashTexture } from "./textures";
import { HammerModel } from "./Hammer";
import type { SelfTransform } from "./types";

/**
 * One player in the world: the rig, and everything that makes it move.
 *
 * Your own avatar follows the CLIENT-PREDICTED transform (`self`); everyone else is
 * sampled ~100ms in the past out of the interpolation buffer. Every animation here
 * is local FX driven off that motion and off broadcast timestamps — the walk cycle,
 * the swing, the hit, the ghost float and the death poof are all things the client
 * works out for itself, and none of it is synced by design.
 *
 * Two ideas do most of the work:
 *
 *   - **The walk is driven by DISTANCE TRAVELLED**, not by a timer. The clips are
 *     canned now rather than hand-written, so this survives as the mixer's
 *     `timeScale`: playback is the body's real speed over the speed the clip was
 *     authored for. The legs keep up whether the player is walking, being
 *     interpolated toward a new position, or sliding across a rain-slicked floor.
 *   - **The blow's FX are the client's own business.** The squash, the smear, the
 *     star, the ring, the dust, the sparks and the floor fracture are all worked
 *     out here from broadcast timestamps and never synced.
 *
 * The swing, hit and death ANIMATIONS are Phase 07 — the model's own clips will
 * replace the four-beat arm the primitives used, time-scaled so the contact frame
 * lands on the server's hit moment. Until then the character walks, stands and
 * carries its hammer, and everything else on screen is unchanged.
 */
export function PlayerAvatar({
  id,
  isMe,
  hideTags,
  ghostView,
  self,
}: {
  id: string;
  isMe: boolean;
  /** true in the plaza: players don't see each other's names there. */
  hideTags: boolean;
  /** true when this client is allowed to see the dead (the Host, and other ghosts). */
  ghostView: boolean;
  self: MutableRefObject<SelfTransform>;
}) {
  const root = useRef<Group>(null);
  const rig = useRef<ModelCharacterHandles>(null);
  /** the hammer's own group, re-parented onto the model's right-hand bone */
  const hammer = useRef<Group>(null);
  const trail = useRef<Mesh>(null);
  const star = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const dust = useRef<Mesh>(null);
  const poof = useRef<Mesh>(null);
  const sparks = useRef<Points>(null);
  const prankTag = useRef<HTMLDivElement>(null);
  /** the nameplate's pale "just lost this much" segment, drained imperatively */
  const drainBar = useRef<HTMLDivElement>(null);
  const drain = useRef(1);

  /** smoothed ground speed (m/s) — what picks the clip and how fast it plays */
  const speed = useRef(0);
  /** last sampled position, for measuring that speed */
  const previous = useRef<{ x: number; z: number } | null>(null);
  /** the locomotion clip currently faded in, so a cross-fade only happens on a change */
  const playing = useRef<ModelClip | null>(null);
  /** the swing we have already cracked the floor for — one fracture per blow, not one per frame */
  const crackedFor = useRef(0);
  /** this frame's HP ratio, so the drain animation can read it without a re-render */
  const ratioNow = useRef(1);

  const name = usePlayerField(id, (p) => p?.name ?? "");
  const hp = usePlayerField(id, (p) => p?.hp ?? HP_MAX);
  const alive = usePlayerField(id, (p) => p?.alive ?? true);
  const connected = usePlayerField(id, (p) => p?.connected ?? true);
  const hammerKind = usePlayerField(id, (p) => p?.hammer ?? DEFAULT_HAMMER);
  /** what that hammer looks like — including the colour it smears through the air */
  const weapon = hammerStyle(hammerKind);
  /**
   * The player's own colour.
   *
   * It no longer touches the BODY. Once players pick their own character a tint
   * fights the character it is painted over — a green Vampire is not a Vampire — so
   * identity moved to the floor ring and the nameplate, and this is what colours
   * them. The rest of the wardrobe waits for Phase 08.
   */
  const colorIndex = usePlayerField(id, (p) => p?.colorIndex ?? DEFAULT_COLOR_INDEX);
  const tint = PLAYER_COLORS[colorIndex] ?? PLAYER_COLORS[0];

  /**
   * Hang the hammer off the model's right hand.
   *
   * The pack parents every loose piece straight to a bone, so this is re-parenting
   * and nothing more — but the bone lives under a model scaled by `MODEL.scale`,
   * and the hammer was modelled at world size. Undoing the bone's world scale is
   * what keeps a mallet a mallet instead of a toy or a lamppost.
   */
  useEffect(() => {
    const slot = rig.current?.handSlot;
    const held = hammer.current;
    if (!slot || !held) return;

    slot.getWorldScale(HAND_SCALE);
    held.scale.setScalar(HAND_SCALE.x > 0 ? 1 / HAND_SCALE.x : 1);
    slot.add(held);
    return () => {
      slot.remove(held);
    };
  }, [alive, hammerKind]);

  useFrame((state, dt) => {
    const group = root.current;
    if (!group) return;

    const pose = isMe ? self.current : sampleOther(id, performance.now());
    if (pose) {
      group.position.x = pose.x;
      group.position.z = pose.z;
      group.rotation.y = pose.dir;
      speed.current +=
        (measureSpeed(previous, pose, dt) - speed.current) * approach(ANIM.speedEaseRate, dt);
    }

    const now = performance.now();
    const time = state.clock.elapsedTime;

    // a ghost floats instead of walking, and never swings
    const floating = !alive;
    const swing = floating ? null : swingPose(swingAt[id], now, hammerKind);

    animateLocomotion(rig.current, playing, floating ? 0 : speed.current, floating, dt);

    group.position.y = floating
      ? GHOST_FX.hoverM + Math.sin(time * GHOST_FX.bobRate) * GHOST_FX.bobM
      : 0;

    animateShadow(rig.current, group.position.y);
    animateTrail(trail.current, swing, state.camera);
    animateStar(star.current, hitAt[id], now, state.camera);
    animateRing(ring.current, hitAt[id], now, group.position.y);
    animateDust(dust.current, swing, group.position.y);
    animatePoof(poof.current, diedAt[id], now, group.position.y);
    animatePrank(prankTag.current, prankAt[id], now);
    animateDrain(drainBar.current, drain, ratioNow.current, hitAt[id], now, dt);
    // sparks fly off the chest, which is where a hammer arrives at this height
    animateSparks(sparks.current, hitAt[id], now, RIG.body.y);

    // the floor takes a fracture on the frame the blow lands — once per swing, and
    // out in FRONT of the player, where the head actually came down
    if (swing && swing.effort > 0 && crackedFor.current !== swingAt[id]) {
      crackedFor.current = swingAt[id];
      const reach = swingReach(hammerKind);
      markCrack(
        group.position.x + Math.sin(group.rotation.y) * reach,
        group.position.z + Math.cos(group.rotation.y) * reach,
      );
    }
  });

  const ratio = hpRatio(hp, HP_MAX);
  ratioNow.current = ratio;
  const ghost = !alive;
  // the dead are invisible to the living — only the Host and other ghosts see them
  if (ghost && !ghostView) return null;

  return (
    <group ref={root}>
      <ModelCharacter
        ref={rig}
        isMe={isMe}
        ringColor={tint}
        ghost={ghost}
        ghostOpacity={isMe ? GHOST_FX.selfOpacity : GHOST_FX.opacity}
      />

      {/* the hammer rides in the right hand; a ghost has put it down */}
      {!ghost && <HeldHammer groupRef={hammer} kind={hammerKind} />}
      {!ghost && <SwingTrail meshRef={trail} color={weapon.trail} />}
      <HitStar meshRef={star} />
      <ShockRing meshRef={ring} />
      {!ghost && <StrikeDust meshRef={dust} />}
      {!ghost && <Sparks meshRef={sparks} />}
      <DeathPoof meshRef={poof} />

      {!hideTags && (
        <Html
          position={[0, NAMEPLATE.y, 0]}
          center
          distanceFactor={NAMEPLATE.distanceFactor}
          zIndexRange={[10, 0]}
          className="pointer-events-none"
        >
          {/*
            The nameplate. The bar is three layers on purpose: a dark TRACK that is
            the player's maximum, a pale DAMAGE segment that drains away a beat after
            a hit (so a blow reads as a blow rather than as a bar that is quietly a
            bit shorter), and the bright FILL of what they actually have left. The
            number is on the end of it, because "half a bar" of six hundred is a very
            different thing to know than "300".
          */}
          <div className="plate" style={{ opacity: connected ? 1 : AVATAR.disconnectedOpacity }}>
            <span className="plate__name">{alive ? name : `👻 ${name}`}</span>
            {alive && (
              <span className="plate__hp">
                <span
                  className="plate__track"
                  style={{ width: NAMEPLATE.barWidth, height: NAMEPLATE.barHeight }}
                >
                  <i ref={drainBar} className="plate__drain" style={{ width: `${ratio * 100}%` }} />
                  <i
                    className="plate__fill"
                    style={{ width: `${ratio * 100}%`, background: hpColor(ratio) }}
                  />
                </span>
                <b className="plate__num">{Math.ceil(hp)}</b>
              </span>
            )}
          </div>
        </Html>
      )}

      <Html
        position={[0, AVATAR.prankTagY, 0]}
        center
        distanceFactor={16}
        zIndexRange={[11, 0]}
        className="pointer-events-none"
      >
        <div ref={prankTag} className="text-3xl" style={{ opacity: 0 }} />
      </Html>
    </group>
  );
}

// ── Animation ────────────────────────────────────────────────────────────────

/** Scratch for un-turning a billboard out of the character it is parented to. */
const FACING = new Quaternion();

/**
 * Turn a flat quad to face the camera.
 *
 * The camera's rotation is a WORLD one and these quads hang off a character who has
 * been turned to face wherever they are walking, so that turn has to be taken back
 * out again first.
 */
function faceCamera(mesh: Mesh, camera: Camera): void {
  if (!mesh.parent) {
    mesh.quaternion.copy(camera.quaternion);
    return;
  }
  mesh.parent.getWorldQuaternion(FACING);
  mesh.quaternion.copy(FACING).invert().multiply(camera.quaternion);
}

/** How far through a fixed-length FX we are: 0→1, or -1 once it has finished. */
function pulse(startedAt: number | undefined, now: number, durationMs: number): number {
  if (!startedAt) return -1;
  const progress = (now - startedAt) / durationMs;
  return progress >= 0 && progress <= 1 ? progress : -1;
}

/** Ground speed (m/s) between this frame's pose and the last one. */
function measureSpeed(
  previous: MutableRefObject<{ x: number; z: number } | null>,
  pose: { x: number; z: number },
  dt: number,
): number {
  const last = previous.current;
  previous.current = { x: pose.x, z: pose.z };
  if (!last || dt <= 0) return 0;
  return Math.hypot(pose.x - last.x, pose.z - last.z) / dt;
}

/** Scratch for reading the world scale of the bone the hammer hangs from. */
const HAND_SCALE = new Vector3();

/**
 * Stand, walk, run or float — and advance the clock that plays it.
 *
 * The cross-fade only fires when the CLIP changes, never per frame: fading an
 * action into itself every frame would leave the mixer permanently mid-blend and
 * the character permanently half-posed. Within a clip, speed is expressed as
 * playback rate instead, which is what keeps the feet on the floor.
 */
function animateLocomotion(
  rig: ModelCharacterHandles | null,
  playing: MutableRefObject<ModelClip | null>,
  speed: number,
  floating: boolean,
  dt: number,
): void {
  if (!rig?.mixer) return;

  const wanted = floating ? MODEL_CLIP.Float : locomotionClip(speed);
  const action = rig.action(wanted);

  if (action && playing.current !== wanted) {
    const previous = playing.current && rig.action(playing.current);
    action.reset().fadeIn(previous ? MODEL.fadeSeconds : 0).play();
    if (previous) previous.fadeOut(MODEL.fadeSeconds);
    playing.current = wanted;
  }
  if (action) action.timeScale = floating ? 1 : locomotionTimeScale(wanted, speed);

  rig.mixer.update(dt);
}

// ── The swing ────────────────────────────────────────────────────────────────

/** Everything a swing is doing to a body on one frame. */
interface SwingPose {
  /** how far the arm has lifted from hanging at the side (radians; negative is forward) */
  raise: number;
  /** how far round the body it has swept (radians; + is wound back, - is followed through) */
  sweep: number;
  /** the hammer's own lag: behind the arm while it accelerates, past it as it stops */
  whip: number;
  /** the wind-up, 0→1→0: the crouch and the turn away before the blow */
  wind: number;
  /** the blow itself, 0→1→0: the lunge, the hop, the twist and the shout */
  effort: number;
}

/**
 * How long a swing with this hammer takes (ms): a fraction of ITS OWN cooldown, so
 * the animation can never outlast the swing it is animating.
 */
function swingLength(kind: string): number {
  const hammer = HAMMERS[kind as HammerKind] ?? HAMMERS[DEFAULT_HAMMER];
  return clamp(hammer.cooldownMs * AVATAR.swingOfCooldown, AVATAR.swingMinMs, AVATAR.swingMaxMs);
}

/**
 * The swing, in four beats: lift the hammer up and wind it back, sweep it round
 * and through, HOLD on the frame it lands, then unwind.
 *
 * A single sine looks like a wave; this looks like a blow. The wind-up is what makes
 * it readable (you can see it coming), the acceleration into the strike is what
 * gives it weight, and the hold is what makes it hit something rather than pass
 * through it.
 */
function swingPose(startedAt: number | undefined, now: number, kind: string): SwingPose | null {
  const progress = pulse(startedAt, now, swingLength(kind));
  if (progress < 0) return null;

  const { swingWindup, swingStrike, swingHold } = AVATAR;

  if (progress < swingWindup) {
    // the arm comes up and winds back, decelerating into the top of the wind-up
    const t = progress / swingWindup;
    const ease = 1 - (1 - t) * (1 - t);
    return {
      raise: AVATAR.swingRaiseRad * ease,
      sweep: AVATAR.swingBackRad * ease,
      // the head is still catching up with an arm accelerating away from it
      whip: -AVATAR.swingWhipRad * ease,
      wind: ease,
      effort: 0,
    };
  }

  if (progress < swingStrike) {
    // round and through, accelerating all the way into the blow
    const t = (progress - swingWindup) / (swingStrike - swingWindup);
    const drive = t * t;
    return {
      raise: AVATAR.swingRaiseRad + (AVATAR.swingStrikeRaiseRad - AVATAR.swingRaiseRad) * drive,
      sweep: AVATAR.swingBackRad + (-AVATAR.swingThroughRad - AVATAR.swingBackRad) * drive,
      // trailing the arm at first, then coming over the top of it as the arm stops
      whip: AVATAR.swingWhipRad * (1 - 2 * drive),
      wind: 1 - drive,
      effort: drive,
    };
  }

  const struck: SwingPose = {
    raise: AVATAR.swingStrikeRaiseRad,
    sweep: -AVATAR.swingThroughRad,
    whip: -AVATAR.swingWhipRad,
    wind: 0,
    effort: 1,
  };
  // hit-stop: three or four frames frozen exactly where the blow landed
  if (progress < swingHold) return struck;

  const t = (progress - swingHold) / (1 - swingHold);
  const settle = (1 - t) * (1 - t);
  return {
    raise: struck.raise * settle,
    sweep: struck.sweep * settle,
    whip: struck.whip * settle,
    wind: 0,
    effort: settle,
  };
}

// ── Impact ───────────────────────────────────────────────────────────────────

/**
 * Keep the contact shadow on the FLOOR while the body moves: it is parented to the
 * character, so it has to cancel out whatever height the body is at, and shrink
 * away as a ghost floats off.
 */
function animateShadow(rig: ModelCharacterHandles | null, bodyY: number): void {
  if (!rig?.shadow) return;
  rig.shadow.position.y = BLOB_SHADOW.liftM - bodyY;
  const size = 1 - clamp01(bodyY / BLOB_SHADOW.fadeHeightM);
  rig.shadow.scale.set(size, 1, size);
}

/**
 * The smear the hammer leaves behind.
 *
 * The crescent is painted (`slashTexture`) with its own taper and fade already in
 * it, so all this has to do is point it where the hammer is: parked at the shoulder
 * the arc turns about, BILLBOARDED to the camera, and spun in its own plane to
 * follow the sweep. That last part is why it is a billboard and not a quad pinned
 * into the arc: a smear pinned in 3D vanishes the moment you look along the arc,
 * which from a camera parked behind the player would be most of the time.
 *
 * It appears on the STRIKE only — `effort` is zero through the wind-up — because a
 * smear is speed, and during the wind-up nothing has moved fast yet.
 */
function animateTrail(mesh: Mesh | null, swing: SwingPose | null, camera: Camera): void {
  if (!mesh) return;

  if (!swing || swing.effort <= 0) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  faceCamera(mesh, camera);
  // then spun in its own plane to point where the hammer is
  mesh.rotateZ(COMBAT_FX.trailPhaseRad + swing.sweep * COMBAT_FX.trailSweepGain);
  (mesh.material as MeshBasicMaterial).opacity = swing.effort * 0.9;
}

/**
 * The star that pops where a blow lands. It is a painted quad, so it is turned to
 * face the camera every frame — a flat sprite seen edge-on is no FX at all.
 */
function animateStar(
  mesh: Mesh | null,
  startedAt: number | undefined,
  now: number,
  camera: Camera,
): void {
  if (!mesh) return;
  const progress = pulse(startedAt, now, COMBAT_FX.starMs);
  const material = mesh.material as MeshBasicMaterial;

  if (progress < 0) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  faceCamera(mesh, camera);
  mesh.rotateZ(progress * COMBAT_FX.starSpinRad);
  // snaps out to full size and then fades away rather than shrinking back
  const size = COMBAT_FX.starM * (0.35 + Math.min(1, progress * 3) * 0.65);
  mesh.scale.set(size, size, size);
  material.opacity = 1 - progress * progress;
}

/** The ring that punches outward along the ground from whoever just took a hit. */
function animateRing(
  mesh: Mesh | null,
  startedAt: number | undefined,
  now: number,
  bodyY: number,
): void {
  if (!mesh) return;
  const progress = pulse(startedAt, now, COMBAT_FX.burstMs);
  const material = mesh.material as MeshBasicMaterial;

  if (progress < 0) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.y = BLOB_SHADOW.liftM * 2 - bodyY;
  const size = 0.35 + progress * COMBAT_FX.burstRadiusM;
  mesh.scale.set(size, size, size);
  material.opacity = 1 - progress;
}

/**
 * The puff kicked up in front of the feet as a blow lands.
 *
 * It fires on the SWING rather than on a hit, because that is what the client
 * actually knows: whether the blow connected is the server's business, and a hammer
 * hitting the floor still hits the floor.
 */
function animateDust(mesh: Mesh | null, swing: SwingPose | null, bodyY: number): void {
  if (!mesh) return;
  const material = mesh.material as MeshBasicMaterial;

  mesh.visible = true;
  if (!swing) return;
  mesh.position.y = BLOB_SHADOW.liftM * 2 - bodyY;
  const size = 0.3 + (1 - swing.effort) * COMBAT_FX.dustRadiusM;
  mesh.scale.set(size, size, size);
  material.opacity = swing.effort * 0.5;
}

/**
 * The puff of dust a defeated player leaves on the floor. It rides on the ground
 * rather than the body, because the body has already floated off as a ghost.
 */
function animatePoof(
  mesh: Mesh | null,
  startedAt: number | undefined,
  now: number,
  /** the body's current height — cancelled out, so the puff stays on the ground */
  bodyY: number,
): void {
  if (!mesh) return;
  const progress = pulse(startedAt, now, COMBAT_FX.poofMs);
  const material = mesh.material as MeshBasicMaterial;

  if (progress < 0) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  const size = 0.5 + progress * 2.4;
  mesh.scale.set(size, size, size);
  mesh.position.y = 0.1 + progress * 0.4 - bodyY;
  material.opacity = (1 - progress) * 0.8;
}

/**
 * Drain the nameplate's pale "just lost this much" segment down onto the real HP.
 *
 * It holds for `drainDelayMs` after the hit and then slides, which is the whole
 * point: the eye needs a beat to see WHERE the bar used to be before it is allowed
 * to move. A bar that simply jumps to its new length tells you the number changed; a
 * bar with a segment draining out of it tells you how much.
 */
function animateDrain(
  bar: HTMLDivElement | null,
  held: MutableRefObject<number>,
  ratio: number,
  hitAt: number | undefined,
  now: number,
  dt: number,
): void {
  if (!bar) return;

  // healing (or a fresh match) snaps straight up — there is nothing to mourn
  if (ratio >= held.current) held.current = ratio;
  else if (!hitAt || now - hitAt > NAMEPLATE.drainDelayMs) {
    held.current = Math.max(ratio, held.current - NAMEPLATE.drainRate * dt);
  }
  bar.style.width = `${held.current * 100}%`;
}

/** How far in front of a player this hammer's head comes down (m). */
function swingReach(kind: string): number {
  const hammer = HAMMERS[kind as HammerKind] ?? HAMMERS[DEFAULT_HAMMER];
  return hammer.reach * COMBAT_FX.crackReachRatio;
}

/** Float a 🍌/💣 over a pranked player, fading out over `AVATAR.prankFxMs`. */
function animatePrank(
  tag: HTMLDivElement | null,
  prank: { t: number; kind: PrankKind } | undefined,
  now: number,
): void {
  if (!tag) return;
  const age = prank ? now - prank.t : Number.POSITIVE_INFINITY;
  if (age < AVATAR.prankFxMs && prank) {
    tag.textContent = PRANK_COPY[prank.kind].emoji;
    tag.style.opacity = String(1 - age / AVATAR.prankFxMs);
    tag.style.transform = `translateY(${-age / 40}px)`;
  } else if (tag.style.opacity !== "0") {
    tag.style.opacity = "0";
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

/**
 * The hammer, ready to be hung off the model's right hand.
 *
 * It is rendered here rather than inside `ModelCharacter` because a hammer is not
 * part of the character — it is picked up, swapped and dropped — but it is MOUNTED
 * onto the hand bone by the effect above, which is where the pack puts every other
 * loose piece. The group is the wrist: Phase 07's swing clip moves the arm, and
 * anything the hammer needs to do on top of that happens in here.
 */
const HeldHammer = ({
  groupRef,
  kind,
}: {
  groupRef: MutableRefObject<Group | null>;
  kind: string;
}) => (
  <group ref={groupRef} rotation={[HAMMER.restTilt.backRad, 0, -HAMMER.restTilt.outRad]}>
    <HammerModel kind={kind} />
  </group>
);

/**
 * The painted crescent, parked in front of the chest — the middle of the arc the
 * hammer travels — and billboarded by `animateTrail`. The crescent is painted a way
 * out from the middle of its own texture, so the quad has to be wide enough to put
 * it where the hammer head goes.
 */
const SwingTrail = ({
  meshRef,
  color,
}: {
  meshRef: MutableRefObject<Mesh | null>;
  color: string;
}) => (
  <mesh ref={meshRef} visible={false} position={[0, RIG.arm.shoulderY, RIG.body.radius]}>
    <planeGeometry args={[COMBAT_FX.trailSizeM, COMBAT_FX.trailSizeM]} />
    <meshBasicMaterial
      map={slashTexture()}
      color={color}
      transparent
      opacity={0}
      side={2}
      depthWrite={false}
    />
  </mesh>
);

/** The impact star, scaled up, spun and faded by `animateStar`. */
const HitStar = ({ meshRef }: { meshRef: MutableRefObject<Mesh | null> }) => (
  <mesh ref={meshRef} visible={false} position={[0, RIG.body.y, 0]}>
    <planeGeometry args={[1, 1]} />
    <meshBasicMaterial
      map={burstTexture()}
      color={IMPACT_COLORS.star}
      transparent
      opacity={0}
      depthWrite={false}
    />
  </mesh>
);

/** The ground ring, scaled up and faded out by `animateRing`. */
const ShockRing = ({ meshRef }: { meshRef: MutableRefObject<Mesh | null> }) => (
  <mesh ref={meshRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[0.62, 0.8, 28]} />
    <meshBasicMaterial
      color={IMPACT_COLORS.ring}
      transparent
      opacity={0}
      side={2}
      depthWrite={false}
    />
  </mesh>
);

/** The dust kicked up in front of the feet, in the direction of the blow. */
const StrikeDust = ({ meshRef }: { meshRef: MutableRefObject<Mesh | null> }) => (
  <mesh
    ref={meshRef}
    visible={false}
    rotation={[-Math.PI / 2, 0, 0]}
    position={[0, 0, RIG.arm.length]}
  >
    <ringGeometry args={[0.3, 0.62, 20]} />
    <meshBasicMaterial
      color={IMPACT_COLORS.dust}
      transparent
      opacity={0}
      side={2}
      depthWrite={false}
    />
  </mesh>
);

/** The floor-level puff, scaled up and faded out by `animatePoof`. */
const DeathPoof = ({ meshRef }: { meshRef: MutableRefObject<Mesh | null> }) => (
  <mesh ref={meshRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[0.35, 1, 24]} />
    <meshBasicMaterial
      color={IMPACT_COLORS.dust}
      transparent
      opacity={0}
      side={2}
      depthWrite={false}
    />
  </mesh>
);
