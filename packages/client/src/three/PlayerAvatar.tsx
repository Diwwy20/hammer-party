import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import {
  DEFAULT_BACK_INDEX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_FACE_INDEX,
  DEFAULT_HAT_INDEX,
  HP_MAX,
  HammerKind,
  approach,
  type PrankKind,
} from "@hammer/shared";
import { usePlayerField } from "../store";
import { sampleOther } from "../net/movement";
import { prankAt, swingAt } from "../runtime/combatFx";
import { AVATAR } from "../config/view";
import { PRANK_COPY } from "../config/copy";
import { WEAPON_COLORS, hpColor, hpRatio } from "../config/theme";
import { AvatarBody } from "./cosmetics";
import type { SelfTransform } from "./types";

/**
 * One player in the world.
 *
 * Your own avatar follows the CLIENT-PREDICTED transform (`self`); everyone else is
 * sampled ~100ms in the past out of the interpolation buffer. The swing animation,
 * death ragdoll and prank emoji are all local FX driven off timestamps — none of it
 * is synced, by design.
 */
export function PlayerAvatar({
  id,
  isMe,
  hideBody,
  hideTags,
  self,
}: {
  id: string;
  isMe: boolean;
  /** true in first person: your own body would fill the camera. */
  hideBody: boolean;
  /** true in the plaza: players don't see each other's names there. */
  hideTags: boolean;
  self: MutableRefObject<SelfTransform>;
}) {
  const root = useRef<Group>(null);
  const tiltable = useRef<Group>(null);
  const hammerArm = useRef<Group>(null);
  const prankTag = useRef<HTMLDivElement>(null);
  /** 0 = standing, 1 = fully collapsed. Eased so death reads as a topple, not a cut. */
  const deadness = useRef(0);

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

  useFrame((_, dt) => {
    const group = root.current;
    if (!group) return;

    const pose = isMe ? self.current : sampleOther(id, performance.now());
    if (pose) {
      group.position.set(pose.x, 0, pose.z);
      group.rotation.y = pose.dir;
    }

    deadness.current += ((alive ? 0 : 1) - deadness.current) * approach(AVATAR.ragdollRate, dt);
    if (tiltable.current) {
      tiltable.current.rotation.z = deadness.current * AVATAR.ragdollTilt;
      tiltable.current.position.y = -deadness.current * AVATAR.ragdollDrop;
    }

    animateSwing(hammerArm.current, swingAt[id]);
    animatePrank(prankTag.current, prankAt[id]);
  });

  const ratio = hpRatio(hp, HP_MAX);

  return (
    <group ref={root}>
      <group ref={tiltable}>
        {/* full cosmetic avatar (hidden for your own first-person view) */}
        {!hideBody && <AvatarBody cosmetic={cosmetic} isMe={isMe} />}
        <HeldHammer armRef={hammerArm} golden={hasGoldenHammer} />
      </group>

      {!hideBody && !hideTags && (
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
              {alive ? name : `💀 ${name}`}
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

      {!hideBody && (
        <Html
          position={[0, AVATAR.prankTagY, 0]}
          center
          distanceFactor={16}
          zIndexRange={[11, 0]}
          className="pointer-events-none"
        >
          <div ref={prankTag} className="text-3xl" style={{ opacity: 0 }} />
        </Html>
      )}
    </group>
  );
}

/**
 * The held hammer — also the first-person view-model. It swings FORWARD (over the
 * head, down toward the front the avatar faces) and glows gold with the power weapon.
 */
const HeldHammer = ({
  armRef,
  golden,
}: {
  armRef: MutableRefObject<Group | null>;
  golden: boolean;
}) => (
  <group ref={armRef} position={[0.48, 1.12, 0.32]}>
    <mesh position={[0, 0.34, 0]} castShadow>
      <cylinderGeometry args={[0.05, 0.05, 0.8, 8]} />
      <meshStandardMaterial color={WEAPON_COLORS.haft} />
    </mesh>
    <mesh position={[0, 0.78, 0]} castShadow>
      <boxGeometry args={golden ? [0.42, 0.36, 0.36] : [0.3, 0.26, 0.26]} />
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

/** Arc the hammer through one swing; a half-sine so it accelerates and settles. */
function animateSwing(arm: Group | null, startedAt: number | undefined): void {
  if (!arm) return;
  const progress = startedAt
    ? (performance.now() - startedAt) / AVATAR.swingMs
    : Number.POSITIVE_INFINITY;
  const strike = progress >= 0 && progress <= 1 ? Math.sin(progress * Math.PI) : 0;
  arm.rotation.x = -0.5 + strike * 2.3;
}

/** Float a 🍌/💣 over a pranked player, fading out over `AVATAR.prankFxMs`. */
function animatePrank(
  tag: HTMLDivElement | null,
  prank: { t: number; kind: PrankKind } | undefined,
): void {
  if (!tag) return;
  const age = prank ? performance.now() - prank.t : Number.POSITIVE_INFINITY;
  if (age < AVATAR.prankFxMs && prank) {
    tag.textContent = PRANK_COPY[prank.kind].emoji;
    tag.style.opacity = String(1 - age / AVATAR.prankFxMs);
  } else if (tag.style.opacity !== "0") {
    tag.style.opacity = "0";
  }
}
