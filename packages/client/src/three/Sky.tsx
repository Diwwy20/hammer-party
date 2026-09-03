import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import { BackSide, type Group } from "three";
import { TAU, pointOnCircle } from "@hammer/shared";
import { SKY } from "../config/view";
import type { StagePalette } from "../config/theme";
import { skyTexture } from "./textures";

/**
 * The sky: a gradient dome with a bank of cartoon clouds drifting round inside it.
 *
 * This is what stops the arena reading as a disc floating in a flat void. It is
 * also nearly free — one inside-out sphere with a 128px gradient painted on it, and
 * one instanced draw call for every puff of every cloud.
 */

/** Each cloud is a little clump of puffs; these are the offsets one clump uses. */
const PUFFS = [
  { x: 0, y: 0, z: 0, scale: 1 },
  { x: 0.78, y: -0.12, z: 0.1, scale: 0.72 },
  { x: -0.8, y: -0.16, z: -0.05, scale: 0.66 },
  { x: 0.32, y: 0.34, z: -0.12, scale: 0.6 },
  { x: -0.34, y: 0.28, z: 0.12, scale: 0.54 },
] as const;

export function SkyDome({ palette }: { palette: StagePalette }) {
  const texture = useMemo(
    () => skyTexture(palette.skyTop, palette.skyMid, palette.sky),
    [palette.skyTop, palette.skyMid, palette.sky],
  );

  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[SKY.radiusM, SKY.segments, SKY.segments]} />
      {/* unlit and unfogged: the dome IS the light in the distance, not a lit surface */}
      <meshBasicMaterial map={texture} side={BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

/**
 * The cloud bank. One instanced sphere covers every puff of every cloud, so the
 * whole sky costs a single draw call however many clouds a stage asks for.
 */
export function CloudBank() {
  const bank = useRef<Group>(null);

  const puffs = useMemo(() => {
    const { count, minRadiusM, maxRadiusM, minHeightM, maxHeightM } = SKY.clouds;
    return Array.from({ length: count }, (_, i) => {
      const t = i / count;
      // an irrational-ish step keeps the ring from lining the clouds up in a row
      const angle = t * TAU + (i % 3) * 0.7;
      const radius = minRadiusM + ((i * 7) % count) * ((maxRadiusM - minRadiusM) / count);
      const [x, z] = pointOnCircle(angle, radius);
      const y = minHeightM + (((i * 5) % count) / count) * (maxHeightM - minHeightM);
      const size = SKY.cloudSizeM * (0.7 + ((i * 3) % 5) / 6);
      return PUFFS.map((puff, p) => ({
        key: `${i}-${p}`,
        position: [x + puff.x * size, y + puff.y * size, z + puff.z * size] as const,
        // clouds are wider than they are tall, or they read as balls of cotton
        scale: [puff.scale * size, puff.scale * size * 0.62, puff.scale * size] as const,
      }));
    }).flat();
  }, []);

  useFrame((_, dt) => {
    if (bank.current) bank.current.rotation.y += dt * SKY.cloudDriftRate;
  });

  return (
    <group ref={bank}>
      <Instances limit={puffs.length} range={puffs.length} castShadow={false} receiveShadow={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading fog={false} />
        {puffs.map((puff) => (
          <Instance key={puff.key} position={puff.position} scale={puff.scale} />
        ))}
      </Instances>
    </group>
  );
}
