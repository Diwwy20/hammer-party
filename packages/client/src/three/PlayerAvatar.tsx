import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import {
  DEFAULT_BACK_INDEX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_FACE_INDEX,
  DEFAULT_HAT_INDEX,
  HP_MAX,
  HammerKind,
  approach,
  clamp01,
  type PrankKind,
} from "@hammer/shared";
import { usePlayerField } from "../store";
import { sampleOther } from "../net/movement";
import { diedAt, hitAt, prankAt, swingAt } from "../runtime/combatFx";
import { ANIM, AVATAR, COMBAT_FX, GHOST_FX, RIG } from "../config/view";
import { PRANK_COPY } from "../config/copy";
import { WEAPON_COLORS, hpColor, hpRatio } from "../config/theme";
import { Character, type CharacterHandles } from "./Character";
import type { SelfTransform } from "./types";

/**
 * One player in the world: the rig, and everything that makes it move.
 *
 * Your own avatar follows the CLIENT-PREDICTED transform (`self`); everyone else is
 * sampled ~100ms in the past out of the interpolation buffer. Every animation here
 * is local FX driven off that motion and off broadcast timestamps — the walk cycle,
 * the swing, the hit squash, the ghost float and the death poof are all things the
 * client works out for itself, and none of it is synced by design.
 *
 * The walk cycle is driven by DISTANCE TRAVELLED rather than a timer, so the legs
 * always match the actual speed — walking, being interpolated, or sliding across a
 * rain-slicked floor after a hit.
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
  const trail = useRef<Mesh>(null);
  const burst = useRef<Mesh>(null);
  const poof = useRef<Mesh>(null);
  const prankTag = useRef<HTMLDivElement>(null);

  /** walk-cycle phase (radians), advanced by distance travelled */
  const stride = useRef(0);
  /** smoothed ground speed (m/s) — the blend factor for the whole walk animation */
  const speed = useRef(0);
  /** last sampled position, for measuring that speed */
  const previous = useRef<{ x: number; z: number } | null>(null);

  const name = usePlayerField(id, (p) => p?.name ?? "");
  const hp = usePlayerField(id, (p) => p?.hp ?? HP_MAX);
  const alive = usePlayerField(id, (p) => p?.alive ?? true);
  const connected = usePlayerField(id, (p) => p?.connected ?? true);
  const hasGoldenHammer = usePlayerField(id, (p) => p?.hammer === HammerKind.Golden);
  const cosmetic = {
    colorIndex: usePlayerField(id, (p) => p?.colorIndex ?? DEFAULT_COLOR_INDEX),
    hatIndex: usePlayerField(id, (p) => p?.hatIndex ?? DEFAULT_HAT_INDEX),
    faceIndex: usePlayerField(id, (p) => p?.faceIndex ?? DEFAULT_FACE_INDEX),
    backIndex: usePlayerField(id, (p) => p?.backIndex ?? DEFAULT_BACK_INDEX),
  };

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
    const walk = clamp01(speed.current / ANIM.fullSpeed);
    stride.current += speed.current * ANIM.stepsPerMetre * dt * Math.PI * 2;

    // a ghost floats instead of walking
    const floating = !alive;

    animateBody(rig.current, {
      walk,
      stride: stride.current,
      time: state.clock.elapsedTime,
      squash: pulse(hitAt[id], now, COMBAT_FX.squashMs),
      floating,
    });

    group.position.y = floating
      ? GHOST_FX.hoverM + Math.sin(state.clock.elapsedTime * GHOST_FX.bobRate) * GHOST_FX.bobM
      : 0;

    animateSwing(hammerArm.current, rig.current, swingAt[id], now, floating);
    animateTrail(trail.current, swingAt[id], now);
    animateBurst(burst.current, hitAt[id], now);
    animatePoof(poof.current, diedAt[id], now, group.position.y);
    animatePrank(prankTag.current, prankAt[id], now);
  });

  const ratio = hpRatio(hp, HP_MAX);
  const ghost = !alive;
  // the dead are invisible to the living — only the Host and other ghosts see them
  if (ghost && !ghostView) return null;

  return (
    <group ref={root}>
      <Character
        ref={rig}
        cosmetic={cosmetic}
        isMe={isMe}
        ghost={ghost}
        ghostOpacity={isMe ? GHOST_FX.selfOpacity : GHOST_FX.opacity}
      />

      {/* the hammer rides in the right hand; a ghost has put it down */}
      {!ghost && <HeldHammer armRef={hammerArm} golden={hasGoldenHammer} />}
      {!ghost && <SwingTrail meshRef={trail} golden={hasGoldenHammer} />}
      <HitBurst meshRef={burst} />
      <DeathPoof meshRef={poof} />

      {!hideTags && (
        <Html
          position={[0, AVATAR.nameTagY, 0]}
          center
          distanceFactor={15}
          zIndexRange={[10, 0]}
          className="pointer-events-none"
        >
          <div
            className="flex flex-col items-center gap-0.5"
            style={{ opacity: connected ? 1 : AVATAR.disconnectedOpacity }}
          >
            <div className="rounded-full bg-white/85 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-ink shadow">
              {alive ? name : `👻 ${name}`}
            </div>
            {alive && (
              <div
                style={{
                  width: AVATAR.hpBar.width,
                  height: AVATAR.hpBar.height,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.7)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${ratio * 100}%`,
                    height: "100%",
                    background: hpColor(ratio),
                    transition: "width 120ms linear",
                  }}
                />
              </div>
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

/**
 * The walk cycle, the idle breath and the hit squash, all blended by how fast the
 * character is actually moving. A ghost skips the legs entirely and just sways.
 */
function animateBody(
  rig: CharacterHandles | null,
  {
    walk,
    stride,
    time,
    squash,
    floating,
  }: { walk: number; stride: number; time: number; squash: number; floating: boolean },
): void {
  if (!rig) return;

  const swing = Math.sin(stride);
  const counterSwing = Math.sin(stride + Math.PI);

  if (rig.legLeft) rig.legLeft.rotation.x = swing * ANIM.legSwingRad * walk;
  if (rig.legRight) rig.legRight.rotation.x = counterSwing * ANIM.legSwingRad * walk;
  // the hammer arm's rotation is owned by the swing animation, so only the free arm walks
  if (rig.armLeft) rig.armLeft.rotation.x = counterSwing * ANIM.armSwingRad * walk;

  if (rig.lean) {
    // two bounces per stride: one per footfall
    rig.lean.position.y = floating ? 0 : Math.abs(Math.sin(stride)) * ANIM.bobM * walk;
    rig.lean.rotation.x = floating ? Math.sin(time * 0.8) * 0.06 : ANIM.leanRad * walk;
    rig.lean.rotation.z = floating ? Math.sin(time * 0.6) * 0.08 : 0;
  }

  if (rig.torso) {
    // idle breathing when still, and a hard squash-and-stretch on the frame you're hit
    const breath = Math.sin(time * ANIM.idleRate) * ANIM.idleScale * (1 - walk);
    const hit = squash >= 0 ? Math.sin(squash * Math.PI) * COMBAT_FX.squashAmount : 0;
    rig.torso.scale.set(1 + breath + hit, 1 - breath - hit, 1 + breath + hit);
  }

  if (rig.head) {
    rig.head.rotation.z = swing * 0.05 * walk;
    rig.head.position.y = floating ? Math.sin(time * 1.1) * 0.03 : 0;
  }
}

/**
 * Arc the hammer arm through one swing — a half-sine, so it accelerates into the
 * blow and settles out of it. The whole torso twists with it, which is what sells
 * the weight of a hammer this size.
 */
function animateSwing(
  arm: Group | null,
  rig: CharacterHandles | null,
  startedAt: number | undefined,
  now: number,
  floating: boolean,
): void {
  const progress = floating ? -1 : pulse(startedAt, now, AVATAR.swingMs);
  const strike = progress >= 0 ? Math.sin(progress * Math.PI) : 0;

  if (arm) arm.rotation.x = -0.35 + strike * 2.5;
  if (rig?.armRight) rig.armRight.rotation.x = -0.35 + strike * 2.5;
  if (rig?.torso) rig.torso.rotation.y = -strike * 0.5;
}

/** The smear the hammer head leaves behind: a bright arc that sweeps and fades. */
function animateTrail(mesh: Mesh | null, startedAt: number | undefined, now: number): void {
  if (!mesh) return;
  const progress = pulse(startedAt, now, COMBAT_FX.trailMs);
  const material = mesh.material as MeshBasicMaterial;

  if (progress < 0) {
    if (material.opacity !== 0) material.opacity = 0;
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.rotation.z = -COMBAT_FX.trailSweepRad / 2 + progress * COMBAT_FX.trailSweepRad;
  material.opacity = (1 - progress) * 0.7;
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

/** The ring that punches outward from whoever just took a hit. */
function animateBurst(mesh: Mesh | null, startedAt: number | undefined, now: number): void {
  if (!mesh) return;
  const progress = pulse(startedAt, now, COMBAT_FX.burstMs);
  const material = mesh.material as MeshBasicMaterial;

  if (progress < 0) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  const size = 0.35 + progress * COMBAT_FX.burstRadiusM;
  mesh.scale.set(size, size, size);
  material.opacity = 1 - progress;
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
 * The held hammer. It hangs off the hand anchor and swings forward — over the head
 * and down toward whatever the character is facing — glowing gold with the power
 * weapon.
 */
const HeldHammer = ({
  armRef,
  golden,
}: {
  armRef: MutableRefObject<Group | null>;
  golden: boolean;
}) => (
  <group ref={armRef} position={[RIG.hand.x, RIG.hand.y, RIG.hand.z]}>
    <mesh position={[0, 0.32, 0]} castShadow>
      <cylinderGeometry args={[0.055, 0.05, 0.76, 8]} />
      <meshStandardMaterial color={WEAPON_COLORS.haft} roughness={0.85} />
    </mesh>
    <mesh position={[0, 0.76, 0]} castShadow>
      <boxGeometry args={golden ? [0.46, 0.38, 0.38] : [0.34, 0.3, 0.3]} />
      <meshStandardMaterial
        color={golden ? WEAPON_COLORS.golden : WEAPON_COLORS.head}
        emissive={golden ? WEAPON_COLORS.golden : WEAPON_COLORS.none}
        emissiveIntensity={golden ? 0.7 : 0}
        metalness={0.5}
        roughness={0.35}
      />
    </mesh>
  </group>
);

/** The arc smear, parked in front of the character and swept by `animateTrail`. */
const SwingTrail = ({
  meshRef,
  golden,
}: {
  meshRef: MutableRefObject<Mesh | null>;
  golden: boolean;
}) => (
  <mesh
    ref={meshRef}
    visible={false}
    position={[0, RIG.arm.shoulderY, 0.1]}
    rotation={[Math.PI / 2.3, 0, 0]}
  >
    <ringGeometry args={[0.9, 1.5, 24, 1, 0, COMBAT_FX.trailSweepRad]} />
    <meshBasicMaterial
      color={golden ? WEAPON_COLORS.golden : "#ffffff"}
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
    <meshBasicMaterial color="#ffffff" transparent opacity={0} side={2} depthWrite={false} />
  </mesh>
);

/** The impact ring, scaled up and faded out by `animateBurst`. */
const HitBurst = ({ meshRef }: { meshRef: MutableRefObject<Mesh | null> }) => (
  <mesh ref={meshRef} visible={false} position={[0, RIG.body.y, 0]}>
    <sphereGeometry args={[1, 14, 10]} />
    <meshBasicMaterial color="#ffe6a8" transparent opacity={0} depthWrite={false} />
  </mesh>
);
