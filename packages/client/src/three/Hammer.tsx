import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector2, type Mesh } from "three";
import { HAMMER } from "../config/view";
import { WEAPON_COLORS, hammerStyle } from "../config/theme";

/**
 * THE hammer — the thing the whole game is named after, so it gets to be a model
 * rather than a stick with a box on the end.
 *
 * One component draws every hammer in the game: the one in a player's fist and the
 * one bobbing on the floor waiting to be picked up. They can't drift apart, and a
 * player learns each silhouette once.
 *
 * Two things carry it:
 *
 *   - **The head is a LATHE.** One mesh, turned from a profile (`HAMMER.head`), so
 *     it has chamfered striking faces, a waist and a swell — a cast shape rather
 *     than a rounded box with a band round it. It also means the profile can be
 *     redrawn as numbers, without touching a line of this file.
 *   - **Every kind looks like what it does.** `hammerStyle` gives the fast hammer a
 *     small pale head on a light haft, the heavy one far too much dark iron, and
 *     the golden one its own light. You should know what is about to hit you from
 *     across the arena.
 *
 * It is built standing up from the grip: the origin is the HAND, the haft runs up
 * +y, and the head lies ACROSS that — a mallet, not an axe.
 */
export function HammerModel({ kind }: { kind: string }) {
  const { haft, grip, pommel, collar, head, band } = HAMMER;
  const style = hammerStyle(kind);
  const headY = haft.lengthM;

  // the profile is stored as [along the axis, radius]; a lathe wants [radius, along]
  const profile = useMemo(
    () => head.profile.map(([along, radius]) => new Vector2(radius, along)),
    [head.profile],
  );

  return (
    <group scale={style.scale}>
      {/* the haft, tapering towards the head, with the wrap round the grip */}
      <mesh position={[0, haft.lengthM / 2, 0]} castShadow>
        <cylinderGeometry args={[haft.topRadiusM, haft.bottomRadiusM, haft.lengthM, haft.sides]} />
        <meshStandardMaterial color={style.haft} roughness={0.85} />
      </mesh>
      <mesh position={[0, grip.startM + grip.lengthM / 2, 0]}>
        <cylinderGeometry args={[grip.radiusM, grip.radiusM, grip.lengthM, grip.sides]} />
        <meshStandardMaterial color={style.grip} roughness={0.95} />
      </mesh>
      <mesh position={[0, pommel.heightM / 2, 0]}>
        <cylinderGeometry
          args={[pommel.radiusM, pommel.radiusM * 0.82, pommel.heightM, pommel.sides]}
        />
        <meshStandardMaterial color={style.shade} metalness={0.45} roughness={0.45} />
      </mesh>
      {/* the collar the haft disappears into */}
      <mesh position={[0, headY - collar.heightM * 0.4, 0]}>
        <cylinderGeometry args={[collar.radiusM, collar.radiusM, collar.heightM, collar.sides]} />
        <meshStandardMaterial color={style.shade} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* the head: one turned shape, with a band sunk into its waist */}
      <group position={[0, headY, 0]} scale={style.headScale}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <latheGeometry args={[profile, head.segments]} />
          <meshStandardMaterial
            color={style.head}
            emissive={style.head}
            emissiveIntensity={style.glow}
            metalness={0.55}
            roughness={0.3}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[band.radiusM, band.radiusM, band.lengthM, band.sides]} />
          <meshStandardMaterial color={style.shade} metalness={0.6} roughness={0.35} />
        </mesh>

        {style.sparkle && <Sparkle />}
      </group>
    </group>
  );
}

/**
 * The twinkle off a golden hammer. An octahedron spinning on two axes reads as a
 * four-point star from any angle, for one unlit mesh.
 */
function Sparkle() {
  const star = useRef<Mesh>(null);

  useFrame((state) => {
    if (!star.current) return;
    const t = state.clock.elapsedTime * HAMMER.sparkleRate;
    star.current.rotation.set(t * 0.6, t, 0);
    // pulse between a glint and a flash, never all the way out
    star.current.scale.setScalar(0.7 + Math.abs(Math.sin(t * 0.8)) * 0.5);
  });

  return (
    <mesh ref={star} position={[0, HAMMER.band.radiusM * 1.4, 0]}>
      <octahedronGeometry args={[HAMMER.sparkleM, 0]} />
      <meshBasicMaterial color={WEAPON_COLORS.sparkle} transparent opacity={0.9} />
    </mesh>
  );
}
