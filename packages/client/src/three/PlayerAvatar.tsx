import { useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  Quaternion,
  type Camera,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type MeshToonMaterial,
  type Points,
} from "three";
import {
  DEFAULT_BACK_INDEX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_FACE_INDEX,
  DEFAULT_HAIR_INDEX,
  DEFAULT_HAMMER,
  DEFAULT_HAT_INDEX,
  HAMMERS,
  HP_MAX,
  HammerKind,
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
  LOD,
  NAMEPLATE,
  RIG,
} from "../config/view";
import { PRANK_COPY } from "../config/copy";
import { IMPACT_COLORS, hammerStyle, hpColor, hpRatio } from "../config/theme";
import { Character, type CharacterHandles } from "./Character";
import { Sparks, animateSparks } from "./Impact";
import { FaceExpression, burstTexture, faceTexture, slashTexture } from "./textures";
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
 * Three ideas do most of the work:
 *
 *   - **The walk is driven by DISTANCE TRAVELLED**, not by a timer, so the legs
 *     always match the real speed — walking, being interpolated, or sliding across
 *     a rain-slicked floor after a hit.
 *   - **The swing is a four-beat blow**, not a wave: wind up, strike, HOLD on the
 *     frame of contact, recover. The hold is hit-stop, and it is the difference
 *     between an arm passing through a target and an arm hitting one.
 *   - **Everything loose lags.** The head, the hair and the scarf are dragged along
 *     behind the body rather than animated with it, which is what stops 25 people
 *     reading as 25 objects being slid around a floor.
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
  const rig = useRef<CharacterHandles>(null);
  const hammerArm = useRef<Group>(null);
  const hammerWrist = useRef<Group>(null);
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

  /** walk-cycle phase (radians), advanced by distance travelled */
  const stride = useRef(0);
  /** smoothed ground speed (m/s) — the blend factor for the whole walk animation */
  const speed = useRef(0);
  /** last sampled position, for measuring that speed */
  const previous = useRef<{ x: number; z: number } | null>(null);
  /** when this character next blinks — staggered per player, never in unison */
  const nextBlinkAt = useRef(scheduleBlink(0));
  /** how far the head, the hair and the scarf are still behind the body (radians) */
  const headLag = useRef(0);
  const hairLag = useRef(0);
  const scarfLag = useRef(0);
  /** the facing we drew last frame, for measuring that turn */
  const previousDir = useRef(0);
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
  const cosmetic = {
    colorIndex: usePlayerField(id, (p) => p?.colorIndex ?? DEFAULT_COLOR_INDEX),
    hairIndex: usePlayerField(id, (p) => p?.hairIndex ?? DEFAULT_HAIR_INDEX),
    hatIndex: usePlayerField(id, (p) => p?.hatIndex ?? DEFAULT_HAT_INDEX),
    faceIndex: usePlayerField(id, (p) => p?.faceIndex ?? DEFAULT_FACE_INDEX),
    backIndex: usePlayerField(id, (p) => p?.backIndex ?? DEFAULT_BACK_INDEX),
  };

  /**
   * Whether this character is close enough to be worth its fine detail. It is React
   * state rather than a `visible` flag because the cheapest mesh is the one that was
   * never built: far-off players simply do not have the parts. The two `LOD`
   * distances differ, so standing on the line cannot rebuild the trim every frame.
   */
  const [detail, setDetail] = useState(true);

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
      // everything loose keeps the OLD heading for a beat, then catches the body up
      const turned = angleDelta(previousDir.current, pose.dir);
      headLag.current -= turned;
      hairLag.current -= turned;
      scarfLag.current -= turned;
      previousDir.current = pose.dir;
    }
    headLag.current -= headLag.current * approach(ANIM.headLagRate, dt);
    hairLag.current -= hairLag.current * approach(ANIM.hairLagRate, dt);
    scarfLag.current -= scarfLag.current * approach(ANIM.scarfLagRate, dt);

    const now = performance.now();
    const time = state.clock.elapsedTime;
    const walk = clamp01(speed.current / ANIM.fullSpeed);
    stride.current += speed.current * ANIM.stepsPerMetre * dt * Math.PI * 2;

    // a ghost floats instead of walking, and never swings
    const floating = !alive;
    const swing = floating ? null : swingPose(swingAt[id], now, hammerKind);

    animateBody(rig.current, {
      walk,
      stride: stride.current,
      time,
      squash: pulse(hitAt[id], now, COMBAT_FX.squashMs),
      headLag: headLag.current,
      hairLag: hairLag.current,
      scarfLag: scarfLag.current,
      floating,
    });
    animateSwing(rig.current, hammerArm.current, hammerWrist.current, swing);

    group.position.y = floating
      ? GHOST_FX.hoverM + Math.sin(time * GHOST_FX.bobRate) * GHOST_FX.bobM
      : 0;

    animateFace(rig.current, nextBlinkAt, now, {
      hurt: pulse(hitAt[id], now, ANIM.hurtFaceMs) >= 0,
      fierce: !!swing && swing.effort > 0,
      ghost: floating,
    });
    animateFlash(rig.current, hitAt[id], now);
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

    // near enough to be worth its trim? (the gap between the two stops it flapping)
    const distance = state.camera.position.distanceTo(group.position);
    if (detail && distance > LOD.detailOutM) setDetail(false);
    else if (!detail && distance < LOD.detailInM) setDetail(true);
  });

  const ratio = hpRatio(hp, HP_MAX);
  ratioNow.current = ratio;
  const ghost = !alive;
  // the dead are invisible to the living — only the Host and other ghosts see them
  if (ghost && !ghostView) return null;

  return (
    <group ref={root}>
      <Character
        ref={rig}
        cosmetic={cosmetic}
        detail={detail}
        isMe={isMe}
        ghost={ghost}
        ghostOpacity={isMe ? GHOST_FX.selfOpacity : GHOST_FX.opacity}
      />

      {/* the hammer rides in the right hand; a ghost has put it down */}
      {!ghost && <HeldHammer armRef={hammerArm} wristRef={hammerWrist} kind={hammerKind} />}
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

/** The shortest way round from one heading to another (radians, -π…π). */
function angleDelta(from: number, to: number): number {
  const raw = (to - from) % (Math.PI * 2);
  if (raw > Math.PI) return raw - Math.PI * 2;
  if (raw < -Math.PI) return raw + Math.PI * 2;
  return raw;
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

/**
 * The walk cycle, the idle breath, the hit squash and everything that trails behind
 * them, all blended by how fast the character is actually moving. A ghost skips the
 * legs entirely and just drifts.
 *
 * What sells a cartoon walk is not the legs — it is everything the legs make the
 * rest of the body do: the bounce, the roll from foot to foot, the counter-twist of
 * the shoulders, the squash on each footfall, the toe rolling off the floor, and
 * the hair and scarf arriving a beat late.
 */
function animateBody(
  rig: CharacterHandles | null,
  {
    walk,
    stride,
    time,
    squash,
    headLag,
    hairLag,
    scarfLag,
    floating,
  }: {
    walk: number;
    stride: number;
    time: number;
    squash: number;
    headLag: number;
    hairLag: number;
    scarfLag: number;
    floating: boolean;
  },
): void {
  if (!rig) return;

  const swing = Math.sin(stride);
  const counterSwing = Math.sin(stride + Math.PI);
  /** one footfall per half-stride — the beat the bounce and the squash land on */
  const footfall = Math.abs(swing);
  const legLeft = swing * ANIM.legSwingRad * walk;
  const legRight = counterSwing * ANIM.legSwingRad * walk;

  if (rig.legLeft) rig.legLeft.rotation.x = legLeft;
  if (rig.legRight) rig.legRight.rotation.x = legRight;
  // the toe rolls off the floor behind and lifts a little in front
  if (rig.footLeft) rig.footLeft.rotation.x = footRoll(legLeft);
  if (rig.footRight) rig.footRight.rotation.x = footRoll(legRight);
  // the hammer arm's rotation is owned by the swing, so only the free arm walks
  if (rig.armLeft) {
    rig.armLeft.rotation.x = counterSwing * ANIM.armSwingRad * walk;
    rig.armLeft.rotation.z = -(RIG.arm.restSpreadRad + ANIM.armSpreadRad * walk);
  }

  if (rig.lean) {
    rig.lean.position.set(0, floating ? 0 : footfall * ANIM.bobM * walk, 0);
    rig.lean.rotation.x = floating ? Math.sin(time * 0.8) * 0.06 : ANIM.leanRad * walk;
    // rolling from one foot to the other; a ghost just sways instead
    rig.lean.rotation.z = floating
      ? Math.sin(time * 0.6) * 0.08
      : swing * ANIM.swayRad * walk +
        Math.sin(time * ANIM.idleSwayRate) * ANIM.idleSwayRad * (1 - walk);
  }

  if (rig.torso) {
    // idle breathing when still, a landing squash on each step, and a hard
    // squash-and-stretch on the frame you're hit
    const breath = Math.sin(time * ANIM.idleRate) * ANIM.idleScale * (1 - walk);
    const land = (1 - footfall) * ANIM.footfallSquash * walk;
    const hit = squash >= 0 ? Math.sin(squash * Math.PI) * COMBAT_FX.squashAmount : 0;
    const total = breath + land + hit;
    rig.torso.scale.set(1 + total, 1 - total, 1 + total);
    // the shoulders counter the hips, which is what stops a walk reading as a slide
    rig.torso.rotation.y = counterSwing * ANIM.twistRad * walk;
  }

  if (rig.head) {
    // the walk's own little wobble, plus the slow tilt of somebody standing idle
    rig.head.rotation.z =
      swing * 0.05 * walk + Math.sin(time * ANIM.idleTiltRate) * ANIM.idleTiltRad * (1 - walk);
    rig.head.rotation.y = clamp(headLag, -ANIM.headLagRad, ANIM.headLagRad) + swing * 0.05 * walk;
    rig.head.position.y = floating ? Math.sin(time * 1.1) * 0.03 : 0;
  }

  // the hair arrives after the head does, and is pushed back by the running
  if (rig.hair) {
    rig.hair.rotation.y = clamp(hairLag, -ANIM.hairLagRad, ANIM.hairLagRad);
    rig.hair.rotation.x = -ANIM.hairLagRad * walk * 0.5 + Math.abs(swing) * 0.04 * walk;
  }
  if (rig.cowlick) {
    rig.cowlick.rotation.x = Math.sin(time * ANIM.cowlickRate) * ANIM.cowlickRad * (0.4 + walk);
    rig.cowlick.rotation.z = Math.sin(time * ANIM.cowlickRate * 0.7) * ANIM.cowlickRad;
  }

  // the scarf streams out behind, with a wave running down its length
  const wave = Math.sin(time * ANIM.scarfWaveRate) * ANIM.scarfWaveRad * (0.3 + walk);
  if (rig.scarf) {
    rig.scarf.rotation.x = RIG.scarf.tail.restTiltRad + ANIM.scarfStreamRad * walk + wave;
    rig.scarf.rotation.z = clamp(scarfLag, -ANIM.scarfLagRad, ANIM.scarfLagRad);
  }
  if (rig.scarfTip) {
    // a beat behind the segment above it — one phase offset, and the tail is cloth
    rig.scarfTip.rotation.x =
      Math.sin(time * ANIM.scarfWaveRate - 1) * ANIM.scarfWaveRad * 2 * (0.3 + walk);
  }
}

/** How far the toe has rolled for a leg at this angle: hard off the back, softer in front. */
function footRoll(legAngle: number): number {
  return legAngle > 0 ? legAngle * ANIM.footRollRad : legAngle * ANIM.footRollRad * 0.35;
}

/** When this character should next blink — soon, but never in step with anyone else. */
function scheduleBlink(now: number): number {
  return now + ANIM.blinkEveryMs + Math.random() * ANIM.blinkJitterMs;
}

/**
 * What the face is doing: wincing if it was just hit, shouting through a swing,
 * seeing stars if it is dead, blinking on its own clock, and pleased with itself
 * the rest of the time.
 *
 * Swapping the plate's texture is the whole implementation. Nothing else on the
 * character costs so little and does so much for making it read as alive rather
 * than as a doll standing very still.
 */
function animateFace(
  rig: CharacterHandles | null,
  nextAt: MutableRefObject<number>,
  now: number,
  { hurt, fierce, ghost }: { hurt: boolean; fierce: boolean; ghost: boolean },
): void {
  const face = rig?.face;
  if (!face) return;

  // the ref is seeded before the clock is known, so the first blink re-bases off now
  if (nextAt.current < now - ANIM.blinkMs) nextAt.current = scheduleBlink(now);
  const blinking = now >= nextAt.current && now < nextAt.current + ANIM.blinkMs;
  if (now >= nextAt.current + ANIM.blinkMs) nextAt.current = scheduleBlink(now);

  const wanted = faceTexture(
    ghost
      ? FaceExpression.Dizzy
      : hurt
        ? FaceExpression.Hurt
        : fierce
          ? FaceExpression.Fierce
          : blinking
            ? FaceExpression.Blink
            : FaceExpression.Happy,
  );
  const material = face.material as MeshToonMaterial;
  // both textures are already compiled into the same material, so this is a swap,
  // not a shader rebuild — no `needsUpdate`, no hitch
  if (material.map !== wanted) material.map = wanted;
}

/** Blow the body and the head out to white for the few frames after a hit lands. */
function animateFlash(rig: CharacterHandles | null, hitAt: number | undefined, now: number): void {
  if (!rig) return;
  const progress = pulse(hitAt, now, COMBAT_FX.flashMs);
  const strength = progress < 0 ? 0 : (1 - progress) * COMBAT_FX.flashAmount;

  for (const mesh of [rig.bodyMesh, rig.headMesh]) {
    if (!mesh) continue;
    const material = mesh.material as MeshToonMaterial;
    if (material.emissiveIntensity !== strength) material.emissiveIntensity = strength;
  }
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

/** A swing at rest — arm down, nothing committed. */
const AT_REST: SwingPose = { raise: 0, sweep: 0, whip: 0, wind: 0, effort: 0 };

/**
 * Euler order for the two joints a swing drives.
 *
 * The arm has to be LIFTED and then SWEPT round, in that order. Three's default
 * 'XYZ' composes them the other way about, which sweeps an arm that is still
 * hanging straight down — a rotation about the axis it is already pointing along,
 * so nothing moves. 'YXZ' lifts first and sweeps the lifted arm, which is a swing.
 */
const SWEEP_ORDER = "YXZ";

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

/**
 * Put a swing onto the body.
 *
 * The arm and the hammer share the same angle and both pivot at the SHOULDER, so
 * the hammer stays in the hand all the way round instead of orbiting a point in
 * space; the whip is added at the wrist on top of that. Everything else here is the
 * body committing to the blow — the crouch, the lunge, the hop, the twist, the free
 * arm thrown back as a counterweight and the feet taking a stance — which is what
 * makes a cartoon character look like they meant it.
 */
function animateSwing(
  rig: CharacterHandles | null,
  arm: Group | null,
  wrist: Group | null,
  swing: SwingPose | null,
): void {
  const { raise, sweep, whip, wind, effort } = swing ?? AT_REST;

  // the hammer arm carries the whip ON TOP of the sweep: the head is left behind by
  // the arm and then comes past it, which is the entire weight of the thing
  if (arm) arm.rotation.set(raise, sweep + whip, RIG.arm.restSpreadRad, SWEEP_ORDER);
  if (wrist) wrist.rotation.x = HAMMER.restTilt.backRad;
  if (rig?.armRight) rig.armRight.rotation.set(raise, sweep, RIG.arm.restSpreadRad, SWEEP_ORDER);
  if (!swing) return;

  if (rig?.lean) {
    rig.lean.position.y += effort * AVATAR.swingHopM - wind * AVATAR.swingCrouchM;
    rig.lean.position.z += effort * AVATAR.swingLungeM;
  }
  // wound away from the target, then driven through it
  if (rig?.torso) rig.torso.rotation.y += (wind * 0.5 - effort) * AVATAR.swingTwistRad;
  if (rig?.head) rig.head.rotation.y += (wind * 0.4 - effort) * AVATAR.swingHeadRad;
  if (rig?.armLeft) rig.armLeft.rotation.x -= effort * AVATAR.swingFreeArmRad;
  if (rig?.legRight) rig.legRight.rotation.x += effort * AVATAR.swingStanceRad;
  if (rig?.legLeft) rig.legLeft.rotation.x -= effort * AVATAR.swingStanceRad;
  // the scarf snaps forward with the blow
  if (rig?.scarf) rig.scarf.rotation.x += effort * ANIM.scarfStreamRad * 0.5;
}

// ── Impact ───────────────────────────────────────────────────────────────────

/**
 * Keep the contact shadow on the FLOOR while the body moves: it is parented to the
 * character, so it has to cancel out whatever height the body is at, and shrink
 * away as a ghost floats off.
 */
function animateShadow(rig: CharacterHandles | null, bodyY: number): void {
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
 * The hammer in the right hand.
 *
 * The outer group pivots at the SHOULDER and hangs the hammer at exactly the arm's
 * own length — the same joint, the same limb, the same numbers — so the handle is
 * in the fist by construction, through the whole arc and whatever else the arms are
 * doing. The inner group is the WRIST, and it is the only thing the swing's whip
 * touches: the hammer lags behind the arm on the way up and comes over the top of
 * it on the way down, which is what gives a swung weapon its mass.
 */
const HeldHammer = ({
  armRef,
  wristRef,
  kind,
}: {
  armRef: MutableRefObject<Group | null>;
  wristRef: MutableRefObject<Group | null>;
  kind: string;
}) => (
  <group
    ref={armRef}
    position={[RIG.arm.x, RIG.arm.shoulderY, 0]}
    rotation={[0, 0, RIG.arm.restSpreadRad]}
  >
    <group
      ref={wristRef}
      position={[0, -RIG.arm.length - RIG.hand.gripDropM, 0]}
      rotation={[HAMMER.restTilt.backRad, 0, -HAMMER.restTilt.outRad]}
    >
      <HammerModel kind={kind} />
    </group>
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
