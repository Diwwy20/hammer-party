import { useMemo } from "react";
import type { Group } from "three";
import { BLOB_SHADOW } from "../config/view";
import { CHARACTER_COLORS } from "../config/theme";
import { blobShadowTexture } from "./textures";

/**
 * The soft blob every character stands on, and — if it is YOU — the ring round it
 * in your colour.
 *
 * The blob is worth more than the real shadow map for grounding a cartoon
 * character: it is always exactly under the feet, it never flickers, and it costs
 * one transparent quad. `PlayerAvatar` shrinks it as the body leaves the ground.
 *
 * The ring is how you find YOURSELF in a crowd of 25, and it is the only thing
 * carrying that job now — once players pick their own character, tinting the body
 * would fight the character (a green Vampire is not a Vampire), so identity lives
 * on the floor and on the nameplate instead.
 */
export function ContactShadow({
  groupRef,
  ring,
}: {
  groupRef: React.RefObject<Group>;
  /** the player's own colour, when this character belongs to whoever is looking */
  ring?: string;
}) {
  const alpha = useMemo(() => blobShadowTexture(), []);

  return (
    <group ref={groupRef} position={[0, BLOB_SHADOW.liftM, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[BLOB_SHADOW.radiusM, 20]} />
        <meshBasicMaterial
          color={CHARACTER_COLORS.blobShadow}
          alphaMap={alpha}
          transparent
          opacity={BLOB_SHADOW.opacity}
          depthWrite={false}
        />
      </mesh>
      {ring && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, BLOB_SHADOW.liftM, 0]}>
          <ringGeometry args={[BLOB_SHADOW.selfRing.innerM, BLOB_SHADOW.selfRing.outerM, 28]} />
          <meshBasicMaterial
            color={ring}
            transparent
            opacity={BLOB_SHADOW.selfRing.opacity}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
