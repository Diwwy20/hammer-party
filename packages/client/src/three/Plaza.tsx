import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instance, Instances } from "@react-three/drei";
import type { Group } from "three";
import { TAU, pointOnCircle } from "@hammer/shared";
import { PLAZA_FX, SCENE } from "../config/view";
import { PARTY_COLORS, type StagePalette } from "../config/theme";

/**
 * The waiting-room plaza's dressing: planters, bunting, balloons and confetti.
 *
 * This is the first 3D thing anybody sees after scanning the QR — a party they
 * walked into, not an empty grey disc — so it is worth the polygons. Everything
 * repeated is INSTANCED (one draw call for all the balloons, one for all the
 * leaves, one for all the bunting), because this scene also has to hold 25 players.
 *
 * Laid out entirely from `PLAZA_FX` and the plaza radius, so it re-fits itself if
 * the lobby ever changes size.
 */
export function PlazaDressing({ radius, palette }: { radius: number; palette: StagePalette }) {
  return (
    <>
      <Medallion radius={radius} palette={palette} />
      <Confetti radius={radius} />
      <Planters radius={radius} palette={palette} />
      <Bunting radius={radius} palette={palette} />
      <Balloons radius={radius} />
    </>
  );
}

/** Rotation that lays a plane flat on the ground, facing up. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Painted in the middle of the floor: the spot people naturally gather on. */
function Medallion({ radius, palette }: { radius: number; palette: StagePalette }) {
  const { inner, outer } = PLAZA_FX.medallion;

  return (
    <group position={[0, 0.015, 0]} rotation={FLAT}>
      <mesh>
        <circleGeometry args={[radius * inner, SCENE.circleSegments]} />
        <meshBasicMaterial color={palette.ring} transparent opacity={0.35} />
      </mesh>
      <mesh>
        <ringGeometry args={[radius * outer * 0.86, radius * outer, SCENE.circleSegments]} />
        <meshBasicMaterial color={palette.rim} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

/** Party confetti scattered over the tiles — one instanced draw call for the lot. */
function Confetti({ radius }: { radius: number }) {
  const bits = useMemo(() => {
    const { count, minRadiusRatio, maxRadiusRatio, sizeM } = PLAZA_FX.confetti;
    return Array.from({ length: count }, (_, i) => {
      // a golden-angle spiral scatters evenly without ever clumping or lining up
      const angle = i * 2.399963;
      const spread = minRadiusRatio + (i / count) * (maxRadiusRatio - minRadiusRatio);
      const [x, z] = pointOnCircle(angle, radius * spread);
      return {
        key: i,
        position: [x, 0.012, z] as const,
        rotation: [-Math.PI / 2, 0, angle] as [number, number, number],
        scale: sizeM * (0.6 + ((i * 7) % 5) / 5),
        color: PARTY_COLORS[i % PARTY_COLORS.length],
      };
    });
  }, [radius]);

  return (
    <Instances limit={bits.length} range={bits.length}>
      <circleGeometry args={[1, 6]} />
      <meshBasicMaterial transparent opacity={0.34} />
      {bits.map((bit) => (
        <Instance
          key={bit.key}
          position={bit.position}
          rotation={bit.rotation}
          scale={bit.scale}
          color={bit.color}
        />
      ))}
    </Instances>
  );
}

/**
 * Planters of greenery ringing the plaza, each with a little tree in it. Trunks,
 * leaves and tubs are three instanced meshes rather than eight separate trees.
 */
function Planters({ radius, palette }: { radius: number; palette: StagePalette }) {
  const { planter, tree } = PLAZA_FX;

  const spots = useMemo(() => {
    return Array.from({ length: planter.count }, (_, i) => {
      const angle = (i / planter.count) * TAU + Math.PI / planter.count;
      const [x, z] = pointOnCircle(angle, radius + planter.offsetM);
      return { key: i, x, z };
    });
  }, [radius, planter.count, planter.offsetM]);

  const leaves = useMemo(
    () =>
      spots.flatMap((spot) =>
        Array.from({ length: tree.leafTiers }, (_, tier) => ({
          key: `${spot.key}-${tier}`,
          position: [
            spot.x,
            planter.heightM + tree.trunkHeightM + tier * tree.leafRadiusM * 0.52,
            spot.z,
          ] as const,
          // each tier is a little smaller, so the canopy comes to a point
          scale: tree.leafRadiusM * (1 - tier * 0.22),
          color: palette.foliage[(spot.key + tier) % palette.foliage.length],
        })),
      ),
    [spots, tree, planter.heightM, palette.foliage],
  );

  return (
    <>
      <Instances limit={spots.length} range={spots.length} castShadow receiveShadow>
        <cylinderGeometry args={[planter.radiusM, planter.radiusM * 0.88, planter.heightM, 12]} />
        <meshStandardMaterial color={palette.wall} roughness={0.9} />
        {spots.map((spot) => (
          <Instance key={spot.key} position={[spot.x, planter.heightM / 2, spot.z]} />
        ))}
      </Instances>

      <Instances limit={spots.length} range={spots.length} castShadow>
        <cylinderGeometry
          args={[tree.trunkRadiusM * 0.8, tree.trunkRadiusM, tree.trunkHeightM, 8]}
        />
        <meshStandardMaterial color={palette.trunk} roughness={0.95} />
        {spots.map((spot) => (
          <Instance
            key={spot.key}
            position={[spot.x, planter.heightM + tree.trunkHeightM / 2, spot.z]}
          />
        ))}
      </Instances>

      <Instances limit={leaves.length} range={leaves.length} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.85} flatShading />
        {leaves.map((leaf) => (
          <Instance key={leaf.key} position={leaf.position} scale={leaf.scale} color={leaf.color} />
        ))}
      </Instances>
    </>
  );
}

/**
 * Triangular pennants strung right round the plaza wall — on an actual rope, which
 * is the difference between a garland and a shower of floating triangles.
 */
function Bunting({ radius, palette }: { radius: number; palette: StagePalette }) {
  const { bunting } = PLAZA_FX;
  const ropeRadius = radius + bunting.offsetM;

  const flags = useMemo(() => {
    return Array.from({ length: bunting.flagCount }, (_, i) => {
      const angle = (i / bunting.flagCount) * TAU;
      const [x, z] = pointOnCircle(angle, ropeRadius);
      return {
        key: i,
        // hung from the rope: the cone points down, its base level with the line
        position: [x, bunting.heightM - bunting.sizeM / 2, z] as const,
        rotation: [0, -angle, Math.PI] as [number, number, number],
        color: PARTY_COLORS[i % PARTY_COLORS.length],
      };
    });
  }, [ropeRadius, bunting]);

  return (
    <>
      <mesh position={[0, bunting.heightM, 0]} rotation={FLAT}>
        <torusGeometry args={[ropeRadius, bunting.ropeM, 6, 96]} />
        <meshStandardMaterial color={palette.wallTrim} roughness={0.9} />
      </mesh>
      <Instances limit={flags.length} range={flags.length}>
        <coneGeometry args={[bunting.sizeM * 0.55, bunting.sizeM, 3]} />
        <meshStandardMaterial roughness={0.9} side={2} />
        {flags.map((flag) => (
          <Instance
            key={flag.key}
            position={flag.position}
            rotation={flag.rotation}
            color={flag.color}
          />
        ))}
      </Instances>
    </>
  );
}

/** Balloons on strings, bobbing over the plaza wall. */
function Balloons({ radius }: { radius: number }) {
  const bob = useRef<Group>(null);
  const { balloon } = PLAZA_FX;

  const bunch = useMemo(() => {
    return Array.from({ length: balloon.count }, (_, i) => {
      const angle = (i / balloon.count) * TAU + 0.3;
      const [x, z] = pointOnCircle(angle, radius + balloon.offsetM);
      const height =
        balloon.minHeightM +
        ((i * 5) % balloon.count) * ((balloon.maxHeightM - balloon.minHeightM) / balloon.count);
      return { key: i, x, z, height, color: PARTY_COLORS[i % PARTY_COLORS.length] };
    });
  }, [radius, balloon]);

  useFrame((state) => {
    if (!bob.current) return;
    // the whole bunch drifts together — one sine beats twelve
    bob.current.position.y =
      Math.sin(state.clock.elapsedTime * PLAZA_FX.balloonBobRate) * PLAZA_FX.balloonBobM;
  });

  return (
    <group ref={bob}>
      <Instances limit={bunch.length} range={bunch.length} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial roughness={0.35} metalness={0.05} />
        {bunch.map((one) => (
          <Instance
            key={one.key}
            position={[one.x, one.height, one.z]}
            // balloons are taller than they are wide, and pinched at the knot
            scale={[balloon.radiusM, balloon.radiusM * 1.2, balloon.radiusM]}
            color={one.color}
          />
        ))}
      </Instances>

      <Instances limit={bunch.length} range={bunch.length}>
        <cylinderGeometry args={[0.012, 0.012, 1, 4]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
        {bunch.map((one) => (
          <Instance
            key={one.key}
            position={[one.x, one.height / 2, one.z]}
            scale={[1, one.height, 1]}
          />
        ))}
      </Instances>
    </group>
  );
}
