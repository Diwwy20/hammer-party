import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { StageTheme } from "@hammer/shared";
import { useGame } from "../store";
import { SCENE } from "../config/view";
import { stagePalette } from "../config/theme";

/**
 * The floor.
 *
 * In a match: a danger floor covering the whole arena, with the SAFE disc drawn on
 * top and scaled to `zoneRadius` every frame — so the shrink is one cheap scale, not
 * new geometry. In the lobby it's a plain, friendly plaza: no danger, no zone ring.
 */

/** Rotation that lays a plane flat on the ground, facing up. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Draw order above the floor — tiny offsets that keep the rings from z-fighting. */
const LAYER = {
  safeFloor: 0.006,
  ring: 0.02,
  zoneEdge: 0.03,
} as const;

export function Arena({ isPlaza }: { isPlaza: boolean }) {
  const arenaRadius = useGame((s) => s.arenaRadius);
  const theme = useGame((s) => s.stageTheme);
  const palette = stagePalette(isPlaza ? StageTheme.Lobby : theme);

  const safeFloor = useRef<Mesh>(null);
  const zoneEdge = useRef<Mesh>(null);

  useFrame(() => {
    if (isPlaza) return;
    // the safe disc + its glowing edge are unit circles scaled to the live zone radius
    const zoneRadius = useGame.getState().zoneRadius || arenaRadius;
    safeFloor.current?.scale.set(zoneRadius, zoneRadius, 1);
    zoneEdge.current?.scale.set(zoneRadius, zoneRadius, 1);
  });

  const boundary = (
    <mesh rotation={FLAT} position={[0, LAYER.ring, 0]}>
      <ringGeometry
        args={[arenaRadius - SCENE.boundaryWidthM, arenaRadius, SCENE.circleSegments]}
      />
      <meshBasicMaterial color={palette.boundary} />
    </mesh>
  );

  if (isPlaza) {
    return (
      <>
        {/* plaza floor — one calm disc, no hazards */}
        <mesh rotation={FLAT} receiveShadow>
          <circleGeometry args={[arenaRadius, SCENE.circleSegments]} />
          <meshStandardMaterial color={palette.safe} />
        </mesh>
        {/* soft inner accent ring */}
        <mesh rotation={FLAT} position={[0, LAYER.ring, 0]}>
          <ringGeometry
            args={[
              arenaRadius * SCENE.plazaAccentRing.inner,
              arenaRadius * SCENE.plazaAccentRing.outer,
              SCENE.circleSegments,
            ]}
          />
          <meshBasicMaterial color={palette.ring} transparent opacity={0.5} />
        </mesh>
        {boundary}
      </>
    );
  }

  return (
    <>
      {/* danger floor — full arena, sits under the safe disc */}
      <mesh rotation={FLAT} receiveShadow>
        <circleGeometry args={[arenaRadius, SCENE.circleSegments]} />
        <meshStandardMaterial
          color={palette.danger}
          emissive={palette.dangerEmissive}
          emissiveIntensity={0.28}
        />
      </mesh>
      {/* safe floor — unit circle scaled to zoneRadius */}
      <mesh ref={safeFloor} rotation={FLAT} position={[0, LAYER.safeFloor, 0]} receiveShadow>
        <circleGeometry args={[1, SCENE.circleSegments]} />
        <meshStandardMaterial color={palette.safe} />
      </mesh>
      {/* glowing safe-zone edge */}
      <mesh ref={zoneEdge} rotation={FLAT} position={[0, LAYER.zoneEdge, 0]}>
        <ringGeometry args={[0.965, 1, SCENE.circleSegments]} />
        <meshBasicMaterial color={palette.ring} />
      </mesh>
      {boundary}
    </>
  );
}
