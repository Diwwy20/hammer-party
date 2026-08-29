import { forwardRef, useImperativeHandle, useRef } from "react";
import type { Group } from "three";
import { PLAYER_COLORS } from "@hammer/shared";
import type { Cosmetic } from "../store";
import { RIG } from "../config/view";
import { CHARACTER_COLORS, GHOST_COLORS } from "../config/theme";
import { Back, Face, Hat, cosmeticIds } from "./cosmetics";

/**
 * The character: a chunky, rounded, modern-minimal little fighter.
 *
 * It is built as an ANIMATION RIG, not one static blob — the parts that move are
 * separate groups pivoted where a joint would be (hips, shoulders, neck), and their
 * handles come back out through `CharacterHandles` so `PlayerAvatar` can drive a
 * walk cycle, a swing, a hit squash and a ghost float without this file knowing
 * anything about the game.
 *
 * Everything is positioned off `RIG` (`config/view.ts`), cosmetics included, so
 * re-proportioning the character takes its hat with it.
 */

/** The joints `PlayerAvatar` animates. Null until the group has mounted. */
export interface CharacterHandles {
  /** whole-body lean + bounce */
  lean: Group | null;
  /** torso only: breathing, and the squash when hit */
  torso: Group | null;
  head: Group | null;
  legLeft: Group | null;
  legRight: Group | null;
  armLeft: Group | null;
  /** the arm that carries the hammer — this is the one that swings */
  armRight: Group | null;
}

export interface CharacterProps {
  cosmetic: Cosmetic;
  /** dead players are drawn pale and see-through, and only to those who may see them */
  ghost?: boolean;
  /** how solid a ghost is drawn (ignored when alive) */
  ghostOpacity?: number;
  /** your own avatar glows very slightly, so you can find yourself in a crowd */
  isMe?: boolean;
}

/**
 * A rounded limb: a capsule with a ball on the end, so it reads as a hand or a foot.
 *
 * Limbs stay OUT of the shadow pass on purpose. With 25 players on a phone the
 * shadow map is the first thing to cost real frames, and an arm never casts a shadow
 * the body was not already casting.
 */
function Limb({
  length,
  radius,
  color,
  tipColor,
  opacity,
  transparent,
}: {
  length: number;
  radius: number;
  color: string;
  tipColor: string;
  opacity: number;
  transparent: boolean;
}) {
  return (
    <group>
      <mesh position={[0, -length / 2, 0]}>
        <capsuleGeometry args={[radius, length, 4, 10]} />
        <meshStandardMaterial
          color={color}
          roughness={0.75}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>
      <mesh position={[0, -length, 0]}>
        <sphereGeometry args={[radius * 1.15, 12, 12]} />
        <meshStandardMaterial
          color={tipColor}
          roughness={0.6}
          transparent={transparent}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}

export const Character = forwardRef<CharacterHandles, CharacterProps>(function Character(
  { cosmetic, ghost = false, ghostOpacity = 1, isMe = false },
  ref,
) {
  const lean = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const legLeft = useRef<Group>(null);
  const legRight = useRef<Group>(null);
  const armLeft = useRef<Group>(null);
  const armRight = useRef<Group>(null);

  // getters, not a snapshot: the refs are still null on the frame this runs
  useImperativeHandle(
    ref,
    () => ({
      get lean() {
        return lean.current;
      },
      get torso() {
        return torso.current;
      },
      get head() {
        return head.current;
      },
      get legLeft() {
        return legLeft.current;
      },
      get legRight() {
        return legRight.current;
      },
      get armLeft() {
        return armLeft.current;
      },
      get armRight() {
        return armRight.current;
      },
    }),
    [],
  );

  const ids = cosmeticIds(cosmetic);
  const tint = PLAYER_COLORS[cosmetic.colorIndex] ?? PLAYER_COLORS[0];
  const bodyColor = ghost ? GHOST_COLORS.body : tint;
  const skin = ghost ? GHOST_COLORS.body : CHARACTER_COLORS.skin;
  const shoe = ghost ? GHOST_COLORS.trim : CHARACTER_COLORS.shoe;
  const eyeColor = ghost ? GHOST_COLORS.eye : CHARACTER_COLORS.eye;
  const opacity = ghost ? ghostOpacity : 1;

  const legs = [
    { key: "left", handle: legLeft, x: -RIG.leg.x },
    { key: "right", handle: legRight, x: RIG.leg.x },
  ];
  const arms = [
    { key: "left", handle: armLeft, x: -RIG.arm.x },
    { key: "right", handle: armRight, x: RIG.arm.x },
  ];

  return (
    <group ref={lean}>
      {/* legs — pivoted at the hip, so the walk cycle swings from the right place.
          A ghost has none: it trails off into a wisp instead. */}
      {!ghost &&
        legs.map((leg) => (
          <group key={leg.key} ref={leg.handle} position={[leg.x, RIG.leg.hipY, 0]}>
            <Limb
              length={RIG.leg.length}
              radius={RIG.leg.radius}
              color={shoe}
              tipColor={shoe}
              opacity={opacity}
              transparent={false}
            />
          </group>
        ))}

      <group ref={torso}>
        {/* the bean */}
        <mesh position={[0, RIG.body.y, 0]} scale={[1, RIG.body.squash, 0.92]} castShadow>
          <sphereGeometry args={[RIG.body.radius, 20, 16]} />
          <meshStandardMaterial
            color={bodyColor}
            roughness={0.62}
            metalness={0.02}
            emissive={isMe && !ghost ? tint : "#000000"}
            emissiveIntensity={isMe && !ghost ? 0.18 : 0}
            transparent={ghost}
            opacity={opacity}
          />
        </mesh>

        <Back id={ids.back} ghost={ghost} opacity={opacity} />

        {arms.map((arm) => (
          <group key={arm.key} ref={arm.handle} position={[arm.x, RIG.arm.shoulderY, 0]}>
            <Limb
              length={RIG.arm.length}
              radius={RIG.arm.radius}
              color={bodyColor}
              tipColor={skin}
              opacity={opacity}
              transparent={ghost}
            />
          </group>
        ))}

        {/* head, pivoted at the neck so it can tilt and bob */}
        <group ref={head}>
          <mesh position={[0, RIG.head.y, 0]} castShadow>
            <sphereGeometry args={[RIG.head.radius, 22, 18]} />
            <meshStandardMaterial
              color={skin}
              roughness={0.7}
              transparent={ghost}
              opacity={opacity}
            />
          </mesh>
          <Eyes color={eyeColor} transparent={ghost} opacity={opacity} />
          <Face id={ids.face} ghost={ghost} opacity={opacity} />
          <Hat id={ids.hat} ghost={ghost} opacity={opacity} />
        </group>
      </group>

      {ghost && <GhostTail opacity={opacity} />}
    </group>
  );
});

/** Two beady eyes with a highlight — the whole face, and all the charm it needs. */
function Eyes({
  color,
  transparent,
  opacity,
}: {
  color: string;
  transparent: boolean;
  opacity: number;
}) {
  return (
    <group>
      {[-RIG.eye.x, RIG.eye.x].map((x) => (
        <group key={x} position={[x, RIG.eye.y, RIG.eye.z]}>
          <mesh>
            <sphereGeometry args={[RIG.eye.radius, 12, 12]} />
            <meshStandardMaterial
              color={color}
              roughness={0.25}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
          <mesh position={[RIG.eye.radius * 0.32, RIG.eye.radius * 0.34, RIG.eye.radius * 0.7]}>
            <sphereGeometry args={[RIG.eye.radius * 0.36, 8, 8]} />
            <meshBasicMaterial
              color={CHARACTER_COLORS.eyeShine}
              transparent={transparent}
              opacity={opacity}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The wisp a ghost trails where its legs used to be. */
function GhostTail({ opacity }: { opacity: number }) {
  return (
    <mesh position={[0, RIG.leg.hipY - RIG.leg.length * 0.5, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[RIG.body.radius * 0.8, RIG.leg.length * 2.2, 14]} />
      <meshStandardMaterial
        color={GHOST_COLORS.body}
        roughness={0.9}
        transparent
        opacity={opacity * 0.7}
      />
    </mesh>
  );
}
