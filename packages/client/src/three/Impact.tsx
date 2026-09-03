import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type Points,
  type PointsMaterial,
} from "three";
import { HAMMERS, HammerKind, PLAYER_RADIUS, approach, clamp01, degToRad } from "@hammer/shared";
import { selectMeHammer, useGame } from "../store";
import { sampleOther } from "../net/movement";
import { cracks, damageHits, type DamageHit } from "../runtime/combatFx";
import { AMBIENT_DUST, COMBAT_FX, DAMAGE_FX, TARGETING } from "../config/view";
import { DAMAGE_COLORS, IMPACT_COLORS, TARGET_COLORS } from "../config/theme";
import { crackTexture, dotTexture, reticleTexture } from "./textures";
import type { SelfTransform } from "./types";

/**
 * Everything that happens at the moment of contact, and everything that tells you a
 * blow is about to happen.
 *
 * These live together because they are one idea: a hammer blow has to be the loudest
 * thing on the screen for the fifth of a second it lasts, and the player has to know
 * a beat beforehand who it is going to land on. The pieces are
 *
 *   - **SPARKS** thrown off the point of impact — the only FX in the game with
 *     actual physics on it, which is exactly why it sells the hit;
 *   - **FRACTURES** left in the flagstones, which outlive the blow that made them;
 *   - the **TARGET RING and RETICLE** on whoever your next swing would land on;
 *   - the floating **DAMAGE NUMBERS**;
 *   - and the **DUST** hanging in the air over all of it.
 *
 * Nothing here is authoritative and nothing here is synced. The server decides who
 * got hit and for how much; this only draws it.
 */

// ── Sparks ───────────────────────────────────────────────────────────────────

/** Per-spark velocity, kept alongside the buffer it drives. */
interface SparkBurst {
  velocity: Float32Array;
  startedAt: number;
}

/**
 * The spray of sparks off a hammer landing on armour (or on stone).
 *
 * One `Points` buffer per character: `sparkCount` particles thrown out on a cone and
 * then pulled down by gravity. Every other impact effect in the game is a picture of
 * an impact — a quad that scales up and fades. This one is DEBRIS, and the
 * difference is immediately obvious.
 */
export function Sparks({ meshRef }: { meshRef: MutableRefObject<Points | null> }) {
  const texture = useMemo(() => dotTexture(), []);
  const geometry = useMemo(() => {
    const buffer = new BufferGeometry();
    buffer.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(COMBAT_FX.sparkCount * 3), 3),
    );
    return buffer;
  }, []);

  return (
    <points ref={meshRef} geometry={geometry} visible={false} frustumCulled={false}>
      {/*
        Ordinary alpha blending, and a SATURATED colour rather than a hot white.

        Additive is the obvious choice for sparks and it is the wrong one here: these
        arenas are pale cream stone, and adding a warm highlight to something that is
        already nearly white produces white. The sparks simply vanished against the
        floor they were supposed to be flying off. It is the same trap the swing
        smears were pulled out of (see `hammerStyle.trail`) — on a bright stage,
        bright beats correct.
      */}
      <pointsMaterial
        map={texture}
        color={IMPACT_COLORS.spark}
        size={COMBAT_FX.sparkSizePx / 100}
        sizeAttenuation
        transparent
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Throw a fresh burst, and step whichever one is in flight.
 *
 * The velocities are generated ONCE when a burst starts and kept on the object, so
 * the particles follow one consistent arc instead of being re-randomised into a
 * shimmer every frame. Positions are in the character's own space, which means the
 * sparks stay where the blow landed even as the victim is knocked away from it.
 */
export function animateSparks(
  points: Points | null,
  startedAt: number | undefined,
  now: number,
  originY: number,
): void {
  if (!points) return;

  const age = startedAt ? now - startedAt : Number.POSITIVE_INFINITY;
  if (age > COMBAT_FX.sparkMs || age < 0) {
    points.visible = false;
    return;
  }

  const store = points.userData as { burst?: SparkBurst };
  let burst = store.burst;
  if (!burst || burst.startedAt !== startedAt) {
    burst = { velocity: seedBurst(), startedAt: startedAt ?? now };
    store.burst = burst;
  }

  const seconds = age / 1000;
  const position = points.geometry.getAttribute("position") as BufferAttribute;
  const velocity = burst.velocity;

  for (let i = 0; i < COMBAT_FX.sparkCount; i++) {
    const at = i * 3;
    position.array[at] = velocity[at] * seconds;
    position.array[at + 1] =
      originY + velocity[at + 1] * seconds - 0.5 * COMBAT_FX.sparkGravity * seconds * seconds;
    position.array[at + 2] = velocity[at + 2] * seconds;
  }
  position.needsUpdate = true;

  points.visible = true;
  const material = points.material as PointsMaterial;
  const life = clamp01(age / COMBAT_FX.sparkMs);
  material.opacity = Math.pow(1 - life, COMBAT_FX.sparkFadePower);
  material.size = (COMBAT_FX.sparkSizePx / 100) * (1 - life * 0.6);
}

/** A fresh cone of velocities: mostly outward and up, never straight down. */
function seedBurst(): Float32Array {
  const velocity = new Float32Array(COMBAT_FX.sparkCount * 3);
  for (let i = 0; i < COMBAT_FX.sparkCount; i++) {
    const around = Math.random() * Math.PI * 2;
    const lift = COMBAT_FX.sparkRiseRatio + Math.random() * COMBAT_FX.sparkConeRad * 0.4;
    const speed = COMBAT_FX.sparkSpeed + Math.random() * COMBAT_FX.sparkSpeedJitter;
    const flat = Math.cos(lift);
    velocity[i * 3] = Math.cos(around) * flat * speed;
    velocity[i * 3 + 1] = Math.sin(lift) * speed;
    velocity[i * 3 + 2] = Math.sin(around) * flat * speed;
  }
  return velocity;
}

// ── Fractures in the floor ───────────────────────────────────────────────────

/** Rotation that lays a plane flat on the ground, facing up. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/**
 * The cracks smashed into the flagstones, as a fixed POOL of decals recycled
 * oldest-first.
 *
 * They belong to the world rather than to the player who made them: the player walks
 * away, the broken floor does not. Over a long fight the middle of the arena ends up
 * visibly beaten up, which is a free piece of storytelling for one quad per smash.
 */
export function GroundCracks() {
  const group = useRef<Group>(null);
  const texture = useMemo(() => crackTexture(), []);
  const slots = useMemo(() => Array.from({ length: COMBAT_FX.crackPool }, (_, i) => i), []);

  useFrame(() => {
    const root = group.current;
    if (!root) return;
    const now = performance.now();

    root.children.forEach((slot, index) => {
      const crack = cracks[index];
      const mesh = slot as Mesh;
      const age = crack ? now - crack.t : Number.POSITIVE_INFINITY;
      if (!crack || age > COMBAT_FX.crackMs) {
        mesh.visible = false;
        return;
      }

      const life = clamp01(age / COMBAT_FX.crackMs);
      mesh.visible = true;
      mesh.position.set(crack.x, COMBAT_FX.crackLiftM, crack.z);
      mesh.rotation.set(FLAT[0], FLAT[1], crack.spin);
      // it snaps open on impact and then just sits there getting fainter
      const size = COMBAT_FX.crackRadiusM * Math.min(1, life / COMBAT_FX.crackGrowth);
      mesh.scale.set(size, size, size);
      (mesh.material as MeshBasicMaterial).opacity = (1 - life) * COMBAT_FX.crackOpacity;
    });
  });

  return (
    <group ref={group}>
      {slots.map((slot) => (
        <mesh key={slot} visible={false} rotation={FLAT}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture}
            color={IMPACT_COLORS.crack}
            transparent
            opacity={0}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── Air ──────────────────────────────────────────────────────────────────────

/**
 * Fine dust hanging in the air, drifting slowly upward and wrapping round at the
 * top. It rides WITH the camera rather than sitting in the world, so a handful of
 * motes covers the whole arena however far the player walks.
 *
 * One draw call, and it is the difference between characters composited onto a floor
 * and characters standing in a place that has air in it.
 */
export function AmbientDust() {
  const points = useRef<Points>(null);
  const texture = useMemo(() => dotTexture(), []);

  const { geometry, drift } = useMemo(() => {
    const buffer = new BufferGeometry();
    const position = new Float32Array(AMBIENT_DUST.count * 3);
    const speeds = new Float32Array(AMBIENT_DUST.count * 2);
    for (let i = 0; i < AMBIENT_DUST.count; i++) {
      position[i * 3] = (Math.random() * 2 - 1) * AMBIENT_DUST.radiusM;
      position[i * 3 + 1] = Math.random() * AMBIENT_DUST.ceilingM;
      position[i * 3 + 2] = (Math.random() * 2 - 1) * AMBIENT_DUST.radiusM;
      speeds[i * 2] = (Math.random() * 2 - 1) * AMBIENT_DUST.driftSpeed;
      speeds[i * 2 + 1] = AMBIENT_DUST.riseSpeed * (0.4 + Math.random());
    }
    buffer.setAttribute("position", new BufferAttribute(position, 3));
    return { geometry: buffer, drift: speeds };
  }, []);

  useFrame(({ camera }, dt) => {
    const cloud = points.current;
    if (!cloud) return;
    // the cloud is parked on the camera; the motes move inside it
    cloud.position.set(camera.position.x, 0, camera.position.z);

    const position = cloud.geometry.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < AMBIENT_DUST.count; i++) {
      const at = i * 3;
      position.array[at] += drift[i * 2] * dt;
      position.array[at + 1] += drift[i * 2 + 1] * dt;
      if (position.array[at + 1] > AMBIENT_DUST.ceilingM) {
        // back to the floor, somewhere else — a mote that rose in a straight column
        // forever would draw the eye to the fact that it is the same mote
        position.array[at + 1] = 0;
        position.array[at] = (Math.random() * 2 - 1) * AMBIENT_DUST.radiusM;
        position.array[at + 2] = (Math.random() * 2 - 1) * AMBIENT_DUST.radiusM;
      }
    }
    position.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={texture}
        color={IMPACT_COLORS.dust}
        size={AMBIENT_DUST.sizePx / 100}
        sizeAttenuation
        transparent
        opacity={AMBIENT_DUST.opacity}
        depthWrite={false}
      />
    </points>
  );
}

// ── Targeting ────────────────────────────────────────────────────────────────

/**
 * The ring under the player your next swing would land on, and the reticle over
 * their head.
 *
 * It runs THE SAME TEST THE SERVER WILL: everyone alive, inside your hammer's reach,
 * inside its arc, nearest first (`server/game/combat.ts`). That is the whole design
 * — it is not a new mechanic and it grants nothing, it just draws a decision the
 * player is already making with information they already have. Being a frame or two
 * behind the server costs a ring in the wrong place and nothing else.
 */
export function TargetMarker({
  self,
  sessionId,
  active,
}: {
  self: MutableRefObject<SelfTransform>;
  sessionId?: string;
  /** false for the Host, in the plaza, and once you're out — nothing to aim at. */
  active: boolean;
}) {
  const ring = useRef<Mesh>(null);
  const reticle = useRef<Mesh>(null);
  const at = useRef({ x: 0, z: 0, held: false });
  const hammer = useGame(selectMeHammer);
  const texture = useMemo(() => reticleTexture(), []);

  useFrame(({ clock, camera }, dt) => {
    const marker = ring.current;
    const cross = reticle.current;
    if (!marker || !cross) return;

    const target = active && sessionId ? findTarget(self.current, sessionId, hammer) : null;
    if (!target) {
      marker.visible = false;
      cross.visible = false;
      at.current.held = false;
      return;
    }

    // slide onto a new target rather than teleporting between them — a ring that
    // snaps around the arena reads as a bug, one that slides reads as a lock-on
    if (!at.current.held) {
      at.current.x = target.x;
      at.current.z = target.z;
      at.current.held = true;
    }
    const ease = approach(TARGETING.easeRate, dt);
    at.current.x += (target.x - at.current.x) * ease;
    at.current.z += (target.z - at.current.z) * ease;

    const time = clock.elapsedTime;
    const pulse = 1 + Math.sin(time * TARGETING.pulseRate) * TARGETING.pulseAmount;

    marker.visible = true;
    marker.position.set(at.current.x, COMBAT_FX.crackLiftM * 2, at.current.z);
    marker.rotation.z = time * TARGETING.spinRate;
    marker.scale.set(pulse, pulse, 1);

    cross.visible = true;
    cross.position.set(at.current.x, TARGETING.reticleY, at.current.z);
    cross.quaternion.copy(camera.quaternion);
    cross.rotateZ(time * TARGETING.reticleSpinRate);
  });

  return (
    <>
      <mesh ref={ring} visible={false} rotation={FLAT}>
        <ringGeometry args={[TARGETING.ringInnerM, TARGETING.ringOuterM, 40]} />
        <meshBasicMaterial
          color={TARGET_COLORS.ring}
          transparent
          opacity={TARGETING.opacity}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={reticle} visible={false}>
        <planeGeometry args={[TARGETING.reticleM, TARGETING.reticleM]} />
        <meshBasicMaterial
          map={texture}
          color={TARGET_COLORS.reticle}
          transparent
          opacity={TARGETING.opacity}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/** The nearest living player inside this hammer's reach and arc, or null. */
function findTarget(
  self: SelfTransform,
  sessionId: string,
  hammerKind: string,
): { x: number; z: number } | null {
  const stats = HAMMERS[hammerKind as HammerKind] ?? HAMMERS[HammerKind.Mid];
  const reach = stats.reach + PLAYER_RADIUS;
  const arc = degToRad(stats.arcDeg);
  const { players } = useGame.getState();
  const now = performance.now();

  let best: { x: number; z: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const id of Object.keys(players)) {
    if (id === sessionId || !players[id].alive) continue;
    const pose = sampleOther(id, now);
    if (!pose) continue;

    const dx = pose.x - self.x;
    const dz = pose.z - self.z;
    const distance = Math.hypot(dx, dz);
    if (distance > reach || distance >= bestDistance) continue;
    // the same cone the server tests: how far off your facing they are
    const off = Math.abs(shortestAngle(Math.atan2(dx, dz) - self.dir));
    if (off > arc) continue;

    best = { x: pose.x, z: pose.z };
    bestDistance = distance;
  }
  return best;
}

/** The shortest way round from one heading to another (radians, -π…π). */
function shortestAngle(raw: number): number {
  const wrapped = raw % (Math.PI * 2);
  if (wrapped > Math.PI) return wrapped - Math.PI * 2;
  if (wrapped < -Math.PI) return wrapped + Math.PI * 2;
  return wrapped;
}

// ── Damage numbers ───────────────────────────────────────────────────────────

/** One slot in the pool: the tag's world anchor, its DOM node, and what it is showing. */
interface NumberSlot {
  anchor: Group | null;
  tag: HTMLDivElement | null;
  hit: DamageHit | null;
}

/**
 * The floating damage numbers.
 *
 * A fixed POOL of overlay tags, filled from the queue the socket writes and animated
 * imperatively — never through React state. Blows land several times a second per
 * player and there can be a dozen fights at once; re-rendering a component tree for
 * each one is the one thing this must not do, so the pool is built once and every
 * frame after that only writes to `style`.
 *
 * A big hit is drawn bigger and hotter than a small one, which is most of what makes
 * damage numbers worth having: you should be able to tell a fast-hammer tap from a
 * golden-hammer haymaker without reading the digits.
 */
export function DamageNumbers({
  sessionId,
  self,
}: {
  sessionId?: string;
  self: MutableRefObject<SelfTransform>;
}) {
  const slots = useRef<NumberSlot[]>(
    Array.from({ length: DAMAGE_FX.pool }, () => ({ anchor: null, tag: null, hit: null })),
  );

  useFrame(() => {
    const now = performance.now();

    // hand every queued blow to a free tag, oldest first
    while (damageHits.length > 0) {
      const free = slots.current.find((slot) => !slot.hit);
      if (!free) break;
      free.hit = damageHits.shift() ?? null;
    }

    for (const slot of slots.current) {
      const { anchor, tag, hit } = slot;
      if (!anchor || !tag) continue;
      if (!hit) {
        if (tag.style.opacity !== "0") tag.style.opacity = "0";
        continue;
      }

      const life = (now - hit.t) / DAMAGE_FX.lifeMs;
      if (life >= 1) {
        slot.hit = null;
        tag.style.opacity = "0";
        continue;
      }

      const pose = hit.id === sessionId ? self.current : sampleOther(hit.id, now);
      if (!pose) {
        slot.hit = null;
        continue;
      }

      anchor.position.set(
        pose.x + hit.spread * DAMAGE_FX.spreadM,
        DAMAGE_FX.startY + life * DAMAGE_FX.riseM,
        pose.z,
      );

      // it pops past full size and settles back, then holds before fading
      const pop =
        life < DAMAGE_FX.popPhase
          ? 1 + Math.sin((life / DAMAGE_FX.popPhase) * Math.PI) * (DAMAGE_FX.popScale - 1)
          : 1;
      const fade =
        life < DAMAGE_FX.holdPhase
          ? 1
          : 1 - (life - DAMAGE_FX.holdPhase) / (1 - DAMAGE_FX.holdPhase);

      if (tag.textContent !== String(Math.round(hit.dmg))) {
        tag.textContent = String(Math.round(hit.dmg));
        tag.style.fontSize = `${damageSize(hit.dmg)}px`;
        tag.style.color = damageColor(hit);
      }
      tag.style.opacity = String(fade);
      tag.style.transform = `scale(${pop})`;
    }
  });

  return (
    <>
      {slots.current.map((slot, index) => (
        <group key={index} ref={(node) => (slots.current[index].anchor = node)}>
          <Html
            center
            distanceFactor={DAMAGE_FX.distanceFactor}
            zIndexRange={[12, 0]}
            className="pointer-events-none"
          >
            <div
              ref={(node) => (slots.current[index].tag = node)}
              className="dmg"
              style={{ opacity: 0 }}
            />
          </Html>
        </group>
      ))}
    </>
  );
}

/** Bigger numbers are drawn bigger — the size IS the read, before the digits are. */
function damageSize(dmg: number): number {
  const weight = clamp01(dmg / DAMAGE_FX.bigDamage);
  return Math.round(DAMAGE_FX.minSizePx + weight * (DAMAGE_FX.maxSizePx - DAMAGE_FX.minSizePx));
}

/** Damage you took is its own colour; everything else runs white → gold with size. */
function damageColor(hit: DamageHit): string {
  if (hit.mine) return DAMAGE_COLORS.taken;
  return hit.dmg >= DAMAGE_FX.bigDamage ? DAMAGE_COLORS.big : DAMAGE_COLORS.small;
}
