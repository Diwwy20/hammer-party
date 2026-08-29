import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, type Points } from "three";
import { TAU } from "@hammer/shared";
import { RAIN_FX } from "../config/view";
import { RAIN_COLORS } from "../config/theme";

/**
 * Rain.
 *
 * A single `Points` cloud that FOLLOWS THE CAMERA rather than the world: the drops
 * only ever need to look right where somebody is looking, so one buffer of a few
 * hundred points, recycled from the bottom back to the top, covers the whole arena
 * for the cost of one draw call.
 *
 * It is purely visual. The gameplay half of the rain (a slick floor that lets
 * knockback carry) is the server's, in `movement.ts`.
 */
export function Rain() {
  const points = useRef<Points>(null);

  /** starting positions + a per-drop speed jitter, allocated once */
  const { geometry, speeds } = useMemo(() => {
    const positions = new Float32Array(RAIN_FX.dropCount * 3);
    const speeds = new Float32Array(RAIN_FX.dropCount);

    for (let i = 0; i < RAIN_FX.dropCount; i++) {
      const angle = Math.random() * TAU;
      const radius = Math.sqrt(Math.random()) * RAIN_FX.areaRadiusM;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * RAIN_FX.columnHeightM;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      speeds[i] = RAIN_FX.fallSpeed * (0.75 + Math.random() * 0.5);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return { geometry, speeds };
  }, []);

  useFrame((state, dt) => {
    const cloud = points.current;
    if (!cloud) return;

    // ride along with the camera so the player is always inside the downpour
    const { x, z } = state.camera.position;
    cloud.position.set(x, 0, z);

    const attribute = cloud.geometry.getAttribute("position") as BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < RAIN_FX.dropCount; i++) {
      const y = i * 3 + 1;
      array[y] -= speeds[i] * dt;
      if (array[y] < 0) array[y] += RAIN_FX.columnHeightM; // recycle, don't reallocate
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={RAIN_COLORS.drop}
        size={RAIN_FX.dropLengthM}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}
