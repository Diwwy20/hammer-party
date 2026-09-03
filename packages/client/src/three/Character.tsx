import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { DoubleSide, FrontSide, type Group, type Mesh, type Side } from "three";
import { PLAYER_COLORS, TAU } from "@hammer/shared";
import type { Cosmetic } from "../store";
import { RIG } from "../config/view";
import { CHARACTER_COLORS, GHOST_COLORS, IMPACT_COLORS, hairColor } from "../config/theme";
import { Back, Face, Hat, cosmeticIds } from "./cosmetics";
import { FaceExpression, faceTexture, toonRampTexture } from "./textures";
import { ContactShadow } from "./ContactShadow";

/**
 * The character: a chunky little fighter in a party uniform, built to be looked at.
 *
 * It is an ANIMATION RIG, not one static blob — the parts that move are separate
 * groups pivoted where a joint would be (hips, ankles, shoulders, neck, and the two
 * things that trail behind all of them: the hair and the scarf). Their handles come
 * back out through `CharacterHandles` so `PlayerAvatar` can drive a walk, a swing,
 * a hit and a ghost float without this file knowing anything about the game.
 *
 * Five decisions carry the whole look:
 *
 *   - **Chibi proportions.** A big round head on a small body, noodle arms with
 *     mitten hands, stubby legs in big boots. The head is where all the personality
 *     is, so it gets the room.
 *   - **The face is PAINTED, not modelled** — one curved plate over the front of
 *     the head carrying eyes, lashes, brows, mouth and blush as a texture. That is
 *     what lets it blink, wince and shout for the cost of one mesh, 25 times over.
 *   - **It wears CLOTHES.** A collar, a chest panel, a belt and a flared hem: four
 *     bands drawn across a round body, which is most of the reason a round body has
 *     any depth to it at all. The tunic is the player's own tint and the trim is
 *     the same on everybody, so a colour reads as *their* colour rather than as a
 *     different character altogether.
 *   - **HAIR and a SCARF.** Both exist to break the silhouette, and neither is
 *     animated: both are DRAGGED a beat behind the body. Nothing else on the rig
 *     does as much to make it look alive.
 *   - **Toon shading.** The people are lit through a stepped ramp while the arena
 *     is lit normally, so they read as drawn characters standing in a place —
 *     which is the separation the old flat-shaded bean never had.
 *
 * Everything is positioned off `RIG` (`config/view.ts`), cosmetics included, so
 * re-proportioning the character takes its hat with it.
 */

/** The joints `PlayerAvatar` animates. Null until the group has mounted. */
export interface CharacterHandles {
  /** whole-body lean, bounce and the lunge into a swing */
  lean: Group | null;
  /** torso only: breathing, the twist through a swing, and the squash when hit */
  torso: Group | null;
  /** the head, which lags behind the body when it turns */
  head: Group | null;
  /** the painted face — its texture is swapped to change expression */
  face: Mesh | null;
  /** the whole head of hair, dragged behind the head wearing it */
  hair: Group | null;
  /** the one stray tuft, which bounces on a clock of its own */
  cowlick: Group | null;
  /** the scarf's tail, and the loose end of it that whips a beat later */
  scarf: Group | null;
  scarfTip: Group | null;
  legLeft: Group | null;
  legRight: Group | null;
  /** the ankles — a foot rolls onto its toe as it leaves the floor */
  footLeft: Group | null;
  footRight: Group | null;
  armLeft: Group | null;
  /** the arm that carries the hammer — this is the one that swings */
  armRight: Group | null;
  /** the soft disc on the floor, shrunk as the body leaves the ground */
  shadow: Group | null;
  /** the two meshes that flash white on the frame a blow lands */
  bodyMesh: Mesh | null;
  headMesh: Mesh | null;
}

export interface CharacterProps {
  cosmetic: Cosmetic;
  /**
   * True while this character is close enough to the camera to be worth its trim,
   * its buckle and its loose hair (see `LOD` in `config/view.ts`). Further off it is
   * built from silhouette alone, which is all that survives at that size anyway.
   */
  detail: boolean;
  /** dead players are drawn pale and see-through, and only to those who may see them */
  ghost?: boolean;
  /** how solid a ghost is drawn (ignored when alive) */
  ghostOpacity?: number;
  /** your own character stands on a ring in your colour, so you can find yourself */
  isMe?: boolean;
}

/**
 * What every part of a character is shaded with: flat colour through the toon ramp.
 *
 * Every one of them carries a white `emissive` at zero strength, which costs
 * nothing to draw and means ANY part can be flashed white on the frame it is hit by
 * turning one number up (`PlayerAvatar` flashes the body and the head).
 */
function Toon({
  color,
  opacity = 1,
  transparent = false,
  side = FrontSide,
}: {
  color: string;
  opacity?: number;
  transparent?: boolean;
  side?: Side;
}) {
  const gradientMap = useMemo(() => toonRampTexture(), []);

  return (
    <meshToonMaterial
      gradientMap={gradientMap}
      color={color}
      side={side}
      transparent={transparent}
      opacity={opacity}
      emissive={IMPACT_COLORS.flash}
      emissiveIntensity={0}
    />
  );
}

/**
 * An arm: a sleeve capsule with a shoulder ball on top and a big mitten hand on the
 * end.
 *
 * Limbs stay OUT of the shadow pass on purpose. With 25 players on a phone the
 * shadow map is the first thing to cost real frames, and an arm never casts a
 * shadow the body was not already casting.
 */
function Arm({
  color,
  handColor,
  trim,
  detail,
  opacity,
  transparent,
}: {
  color: string;
  handColor: string;
  trim: string;
  detail: boolean;
  opacity: number;
  transparent: boolean;
}) {
  return (
    <group>
      {detail && (
        <mesh>
          <sphereGeometry args={[RIG.shoulder.radiusM, 12, 10]} />
          <Toon color={color} opacity={opacity} transparent={transparent} />
        </mesh>
      )}
      <mesh position={[0, -RIG.arm.length / 2, 0]}>
        <capsuleGeometry args={[RIG.arm.radius, RIG.arm.length, 4, 10]} />
        <Toon color={color} opacity={opacity} transparent={transparent} />
      </mesh>
      {detail && (
        <mesh position={[0, -RIG.cuff.dropM, 0]}>
          <cylinderGeometry args={[RIG.cuff.radiusM, RIG.cuff.radiusM, RIG.cuff.heightM, 10]} />
          <Toon color={trim} opacity={opacity} transparent={transparent} />
        </mesh>
      )}
      <mesh position={[0, -RIG.arm.length, 0]}>
        <sphereGeometry args={[RIG.arm.radius * RIG.handScale, 12, 12]} />
        <Toon color={handColor} opacity={opacity} transparent={transparent} />
      </mesh>
    </group>
  );
}

/**
 * A leg: a legging capsule down to an ankle, with a boot hung off it.
 *
 * The boot gets its OWN group so it can roll onto its toe as the foot leaves the
 * floor — the difference between a walk and a pair of shoes being waved about.
 */
function Leg({
  footRef,
  trim,
  dark,
  detail,
  opacity,
  transparent,
}: {
  footRef: React.RefObject<Group>;
  trim: string;
  dark: string;
  detail: boolean;
  opacity: number;
  transparent: boolean;
}) {
  return (
    <group>
      <mesh position={[0, -RIG.leg.length / 2, 0]}>
        <capsuleGeometry args={[RIG.leg.radius, RIG.leg.length, 4, 10]} />
        <Toon color={dark} opacity={opacity} transparent={transparent} />
      </mesh>

      <group ref={footRef} position={[0, -RIG.leg.length, 0]}>
        {detail && (
          <mesh>
            <cylinderGeometry
              args={[RIG.boot.cuffRadiusM, RIG.boot.cuffRadiusM, RIG.boot.cuffHeightM, 12]}
            />
            <Toon color={trim} opacity={opacity} transparent={transparent} />
          </mesh>
        )}
        <RoundedBox
          args={[RIG.foot.width, RIG.foot.height, RIG.foot.length]}
          radius={RIG.foot.height * 0.45}
          smoothness={2}
          position={[0, -RIG.foot.height * 0.15, RIG.foot.forwardM]}
        >
          <Toon color={dark} opacity={opacity} transparent={transparent} />
        </RoundedBox>
        {detail && (
          <mesh position={[0, -RIG.foot.height * 0.5, RIG.foot.forwardM]}>
            <boxGeometry
              args={[RIG.foot.width * 0.96, RIG.boot.soleHeightM, RIG.foot.length * 0.96]}
            />
            <Toon color={CHARACTER_COLORS.sole} opacity={opacity} transparent={transparent} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export const Character = forwardRef<CharacterHandles, CharacterProps>(function Character(
  { cosmetic, detail, ghost = false, ghostOpacity = 1, isMe = false },
  ref,
) {
  const lean = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const face = useRef<Mesh>(null);
  const hair = useRef<Group>(null);
  const cowlick = useRef<Group>(null);
  const scarf = useRef<Group>(null);
  const scarfTip = useRef<Group>(null);
  const legLeft = useRef<Group>(null);
  const legRight = useRef<Group>(null);
  const footLeft = useRef<Group>(null);
  const footRight = useRef<Group>(null);
  const armLeft = useRef<Group>(null);
  const armRight = useRef<Group>(null);
  const shadow = useRef<Group>(null);
  const bodyMesh = useRef<Mesh>(null);
  const headMesh = useRef<Mesh>(null);

  // getters, not a snapshot: the refs are still null on the frame this runs, and
  // the detail parts come and go with the camera
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
      get face() {
        return face.current;
      },
      get hair() {
        return hair.current;
      },
      get cowlick() {
        return cowlick.current;
      },
      get scarf() {
        return scarf.current;
      },
      get scarfTip() {
        return scarfTip.current;
      },
      get legLeft() {
        return legLeft.current;
      },
      get legRight() {
        return legRight.current;
      },
      get footLeft() {
        return footLeft.current;
      },
      get footRight() {
        return footRight.current;
      },
      get armLeft() {
        return armLeft.current;
      },
      get armRight() {
        return armRight.current;
      },
      get shadow() {
        return shadow.current;
      },
      get bodyMesh() {
        return bodyMesh.current;
      },
      get headMesh() {
        return headMesh.current;
      },
    }),
    [],
  );

  const ids = cosmeticIds(cosmetic);
  const tint = PLAYER_COLORS[cosmetic.colorIndex] ?? PLAYER_COLORS[0];
  const bodyColor = ghost ? GHOST_COLORS.body : tint;
  const skin = ghost ? GHOST_COLORS.body : CHARACTER_COLORS.skin;
  const trim = ghost ? GHOST_COLORS.trim : CHARACTER_COLORS.trim;
  const dark = ghost ? GHOST_COLORS.trim : CHARACTER_COLORS.dark;
  const glove = ghost ? GHOST_COLORS.body : CHARACTER_COLORS.glove;
  const hairTone = ghost ? GHOST_COLORS.trim : hairColor(cosmetic.hairIndex);
  const opacity = ghost ? ghostOpacity : 1;
  const see = { opacity, transparent: ghost };
  /** the wardrobe was modelled against a smaller head; it wears the difference */
  const wardrobeScale = RIG.head.radius / RIG.cosmeticBaseRadius;
  const { bib, belt, buckle, skirt } = RIG.outfit;

  const legs = [
    { key: "left", handle: legLeft, foot: footLeft, x: -RIG.leg.x },
    { key: "right", handle: legRight, foot: footRight, x: RIG.leg.x },
  ];
  // each arm splays AWAY from the body, so the sign follows the side it is on
  const arms = [
    { key: "left", handle: armLeft, x: -RIG.arm.x, spread: -RIG.arm.restSpreadRad },
    { key: "right", handle: armRight, x: RIG.arm.x, spread: RIG.arm.restSpreadRad },
  ];

  return (
    <group>
      <ContactShadow groupRef={shadow} ring={isMe && !ghost ? tint : undefined} />

      <group ref={lean}>
        {/* legs — pivoted at the hip, so the walk cycle swings from the right place.
            A ghost has none: it trails off into a wisp instead. */}
        {!ghost &&
          legs.map((leg) => (
            <group key={leg.key} ref={leg.handle} position={[leg.x, RIG.leg.hipY, 0]}>
              <Leg
                footRef={leg.foot}
                trim={trim}
                dark={dark}
                detail={detail}
                opacity={opacity}
                transparent={false}
              />
            </group>
          ))}

        <group ref={torso}>
          {/* the bean */}
          <mesh
            ref={bodyMesh}
            position={[0, RIG.body.y, 0]}
            scale={[1, RIG.body.squash, 0.94]}
            castShadow
          >
            <sphereGeometry args={[RIG.body.radius, 20, 16]} />
            <Toon color={bodyColor} {...see} />
          </mesh>

          {/* the uniform: a placket, a belt and a flared hem (the collar is the scarf) */}
          {detail && (
            <RoundedBox
              args={[bib.widthM, bib.heightM, bib.depthM]}
              radius={bib.cornerM}
              smoothness={2}
              position={[0, bib.y, bib.z]}
            >
              <Toon color={trim} {...see} />
            </RoundedBox>
          )}
          <mesh position={[0, belt.y, 0]}>
            <cylinderGeometry args={[belt.radiusM, belt.radiusM, belt.heightM, 20, 1, true]} />
            <Toon color={dark} side={DoubleSide} {...see} />
          </mesh>
          {detail && (
            <mesh position={[0, buckle.y, buckle.z]}>
              <boxGeometry args={[buckle.sizeM, buckle.sizeM, buckle.depthM]} />
              <Toon color={ghost ? GHOST_COLORS.trim : CHARACTER_COLORS.buckle} {...see} />
            </mesh>
          )}
          <mesh position={[0, skirt.y, 0]} castShadow>
            <cylinderGeometry
              args={[skirt.topRadiusM, skirt.bottomRadiusM, skirt.heightM, skirt.sides, 1, true]}
            />
            <Toon color={bodyColor} side={DoubleSide} {...see} />
          </mesh>

          <Back id={ids.back} ghost={ghost} opacity={opacity} />

          {arms.map((arm) => (
            <group
              key={arm.key}
              ref={arm.handle}
              position={[arm.x, RIG.arm.shoulderY, 0]}
              rotation={[0, 0, arm.spread]}
            >
              <Arm
                color={bodyColor}
                handColor={glove}
                trim={trim}
                detail={detail}
                opacity={opacity}
                transparent={ghost}
              />
            </group>
          ))}

          <Scarf color={trim} tailRef={scarf} tipRef={scarfTip} {...see} />

          {/* head, pivoted at the neck so it can tilt, bob and lag behind a turn */}
          <group ref={head}>
            <mesh ref={headMesh} position={[0, RIG.head.y, 0]} castShadow>
              <sphereGeometry args={[RIG.head.radius, 24, 18]} />
              <Toon color={skin} {...see} />
            </mesh>

            <PaintedFace meshRef={face} transparent={ghost} opacity={opacity} />
            <Hair color={hairTone} groupRef={hair} cowlickRef={cowlick} detail={detail} {...see} />

            <Worn anchorY={RIG.face.y} scale={wardrobeScale}>
              <Face id={ids.face} ghost={ghost} opacity={opacity} />
            </Worn>
            <Worn anchorY={RIG.hatY} scale={wardrobeScale}>
              <Hat id={ids.hat} ghost={ghost} opacity={opacity} />
            </Worn>
          </group>
        </group>

        {ghost && <GhostTail opacity={opacity} />}
      </group>
    </group>
  );
});

/**
 * Wear a cosmetic at the size this head needs, WITHOUT lifting it off the head.
 *
 * The wardrobe was modelled against a smaller skull, so every hat and pair of
 * glasses is worn at `head.radius / cosmeticBaseRadius`. Scaling the group they sit
 * in scales their POSITIONS too, though — and a hat whose anchor is 1.97m up gets
 * that anchor multiplied as well, which is exactly how you end up with a top hat
 * hovering a finger's width above somebody's hair.
 *
 * Offsetting first by `anchorY * (1 - scale)` scales the cosmetic about its own
 * anchor instead of about the character's feet: the hat gets bigger, and it gets
 * bigger where it already was.
 */
function Worn({
  anchorY,
  scale,
  children,
}: {
  anchorY: number;
  scale: number;
  children: React.ReactNode;
}) {
  return (
    <group position={[0, anchorY * (1 - scale), 0]} scale={scale}>
      {children}
    </group>
  );
}

/**
 * The hair: a cap down to the brow line, a longer shell over the back of the head,
 * a swept fringe, a lock either side of the face, and one cowlick that will not lie
 * down.
 *
 * All of it hangs off ONE group, which `PlayerAvatar` drags a beat behind the head.
 * Real hair rigs work the same way and for the same reason — hair is not animated,
 * it is LEFT BEHIND by whatever the head just did.
 *
 * The two shells are partial spheres rather than solid shapes, so the whole
 * hairstyle costs two thin surfaces sat a few millimetres off the skull. The cap
 * stops at the brow because the brows are half the expression; the back shell
 * carries on down past the equator, which is what gives the head a back rather than
 * a bald patch.
 */
function Hair({
  color,
  groupRef,
  cowlickRef,
  detail,
  opacity,
  transparent,
}: {
  color: string;
  groupRef: React.RefObject<Group>;
  cowlickRef: React.RefObject<Group>;
  detail: boolean;
  opacity: number;
  transparent: boolean;
}) {
  const { shellScale, capThetaRad, backThetaRad, backWidthRad, capJut, fringe, lock, cowlick } =
    RIG.hair;
  const radius = RIG.head.radius * shellScale;
  // -Z is the back of the head; the shell is centred there and wraps round the sides
  const backPhiStart = -Math.PI / 2 - backWidthRad / 2;

  return (
    <group ref={groupRef} position={[0, RIG.head.y, 0]}>
      <mesh scale={[1, 1, capJut]} castShadow>
        <sphereGeometry args={[radius, 20, 12, 0, TAU, 0, capThetaRad]} />
        <Toon color={color} side={DoubleSide} opacity={opacity} transparent={transparent} />
      </mesh>
      <mesh>
        <sphereGeometry
          args={[
            radius,
            18,
            12,
            backPhiStart,
            backWidthRad,
            capThetaRad * 0.92,
            backThetaRad - capThetaRad * 0.92,
          ]}
        />
        <Toon color={color} side={DoubleSide} opacity={opacity} transparent={transparent} />
      </mesh>

      {detail && (
        <mesh
          position={[fringe.x, fringe.y, fringe.z]}
          rotation={[0, 0, fringe.tiltRad]}
          scale={[
            RIG.head.radius * fringe.scale[0],
            RIG.head.radius * fringe.scale[1],
            RIG.head.radius * fringe.scale[2],
          ]}
        >
          <sphereGeometry args={[1, 14, 10]} />
          <Toon color={color} opacity={opacity} transparent={transparent} />
        </mesh>
      )}

      {detail &&
        [-1, 1].map((side) => (
          <mesh
            key={side}
            position={[lock.x * side, lock.y - lock.lengthM / 2, lock.z]}
            rotation={[0, 0, lock.restTiltRad * side]}
          >
            <capsuleGeometry args={[lock.radiusM, lock.lengthM, 3, 8]} />
            <Toon color={color} opacity={opacity} transparent={transparent} />
          </mesh>
        ))}

      {detail && (
        <group ref={cowlickRef} position={[0, cowlick.y, cowlick.z]}>
          <mesh
            position={[0, cowlick.lengthM / 2, 0]}
            rotation={[cowlick.tiltRad, 0, cowlick.tiltRad]}
          >
            <capsuleGeometry args={[cowlick.radiusM, cowlick.lengthM, 3, 6]} />
            <Toon color={color} opacity={opacity} transparent={transparent} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * The scarf: a ring round the neck — which is also the tunic's collar — a knot at
 * the throat, and a two-segment tail off the back.
 *
 * Two tail segments rather than one, because a single flap rotates like a plank.
 * The second is driven a beat behind the first, which is all it takes for the tail
 * to look like cloth catching up with the person wearing it.
 */
function Scarf({
  color,
  tailRef,
  tipRef,
  opacity,
  transparent,
}: {
  color: string;
  tailRef: React.RefObject<Group>;
  tipRef: React.RefObject<Group>;
  opacity: number;
  transparent: boolean;
}) {
  const { ring, knot, tail } = RIG.scarf;

  return (
    <group>
      <mesh position={[0, ring.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ring.radiusM, ring.thicknessM, 8, 20]} />
        <Toon color={color} opacity={opacity} transparent={transparent} />
      </mesh>
      <mesh position={[0, knot.y, knot.z]}>
        <sphereGeometry args={[knot.radiusM, 12, 10]} />
        <Toon color={color} opacity={opacity} transparent={transparent} />
      </mesh>

      <group ref={tailRef} position={[0, tail.y, tail.z]} rotation={[tail.restTiltRad, 0, 0]}>
        <mesh position={[0, -tail.segmentM / 2, 0]} castShadow>
          <boxGeometry args={[tail.widthM, tail.segmentM, tail.thicknessM]} />
          <Toon color={color} opacity={opacity} transparent={transparent} />
        </mesh>
        <group ref={tipRef} position={[0, -tail.segmentM, 0]}>
          <mesh position={[0, -tail.segmentM / 2, 0]}>
            <boxGeometry args={[tail.widthM * 0.84, tail.segmentM, tail.thicknessM]} />
            <Toon color={color} opacity={opacity} transparent={transparent} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/**
 * The face: a patch of sphere hugging the front of the head, wearing the drawn
 * expression. `PlayerAvatar` swaps its texture to blink, to wince and to shout.
 *
 * A patch rather than a flat card, so it curves with the skull and never shows an
 * edge however far round the camera swings.
 */
function PaintedFace({
  meshRef,
  transparent,
  opacity,
}: {
  meshRef: React.RefObject<Mesh>;
  transparent: boolean;
  opacity: number;
}) {
  const texture = useMemo(() => faceTexture(FaceExpression.Happy), []);
  const gradientMap = useMemo(() => toonRampTexture(), []);
  const { phiLength, thetaLength, liftM } = RIG.facePlate;

  return (
    <mesh ref={meshRef} position={[0, RIG.head.y, 0]}>
      <sphereGeometry
        args={[
          RIG.head.radius + liftM,
          24,
          20,
          Math.PI / 2 - phiLength / 2,
          phiLength,
          Math.PI / 2 - thetaLength / 2,
          thetaLength,
        ]}
      />
      <meshToonMaterial
        gradientMap={gradientMap}
        map={texture}
        transparent
        opacity={transparent ? opacity : 1}
        depthWrite={false}
      />
    </mesh>
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
