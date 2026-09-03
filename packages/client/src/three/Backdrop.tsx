import { useMemo } from "react";
import { Instance, Instances } from "@react-three/drei";
import { TAU, pointOnCircle } from "@hammer/shared";
import { BACKDROP } from "../config/view";
import { haze, type StagePalette } from "../config/theme";

/**
 * The world the arena stands IN: a stylised treeline, a village behind it, and hills
 * behind that.
 *
 * The arena used to float in a coloured void, which is the single thing that made it
 * read as a test scene rather than a place. Three rings of very simple geometry fix
 * that, and the trick that makes them work is not the geometry — it is the HAZE.
 *
 * Each ring is mixed toward the sky colour by `BACKDROP.haze*`, harder the further
 * out it is. That is aerial perspective, and it is what the brief's "depth of field"
 * actually wants: a real defocus blur is a post-processing pass (and a dependency we
 * deliberately do not have), and a cartoon does not want one anyway. It wants the
 * distance to go pale and lose its detail while the arena stays saturated and sharp
 * — which is exactly what this does, for the cost of a colour mix per ring.
 *
 * Everything is INSTANCED: the entire world outside the wall is five draw calls.
 */
export function Backdrop({ palette }: { palette: StagePalette }) {
  return (
    <group>
      <Hills palette={palette} />
      <Village palette={palette} />
      <Treeline palette={palette} />
    </group>
  );
}

/**
 * Deterministic scatter round a ring. Index-driven rather than `Math.random`, so the
 * skyline is the same one every time the scene mounts instead of rearranging itself
 * whenever the stage changes.
 */
function scatter(count: number, radiusM: number, jitterM: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * TAU + (((i * 7) % 5) / 5) * (TAU / count);
    const radius = radiusM + ((((i * 13) % 9) / 9) * 2 - 1) * jitterM;
    const [x, z] = pointOnCircle(angle, radius);
    // a stable 0…1 per item, for whatever else needs varying
    return { key: i, x, z, angle, roll: ((i * 17) % 11) / 11 };
  });
}

/**
 * The near treeline: a trunk with three tiers of foliage stacked into a cone.
 *
 * The tiers are what make a low-poly tree read as a tree from a distance — one blob
 * on a stick is a lollipop, three stepped blobs is a conifer.
 */
function Treeline({ palette }: { palette: StagePalette }) {
  const { trees, treeTiers, treeTrunkRatio, treeCanopyRatio } = BACKDROP;

  const trunks = useMemo(() => {
    return scatter(trees.count, trees.radiusM, trees.jitterM).map((spot) => {
      const height = trees.minHeightM + spot.roll * (trees.maxHeightM - trees.minHeightM);
      return { ...spot, height };
    });
  }, [trees]);

  const canopy = useMemo(
    () =>
      trunks.flatMap((tree) =>
        Array.from({ length: treeTiers }, (_, tier) => {
          const trunkTop = tree.height * treeTrunkRatio;
          const span = tree.height * treeCanopyRatio;
          return {
            key: `${tree.key}-${tier}`,
            position: [tree.x, trunkTop + (tier * span) / treeTiers, tree.z] as const,
            // each tier a little smaller, so the canopy comes to a point
            scale: (tree.height * 0.3 * (1 - tier * 0.24)) as number,
            color: palette.treeCanopy[(tree.key + tier) % palette.treeCanopy.length],
          };
        }),
      ),
    [trunks, treeTiers, treeTrunkRatio, treeCanopyRatio, palette.treeCanopy],
  );

  const trunkColor = haze(palette.trunk, palette.sky, BACKDROP.hazeNear);

  return (
    <>
      <Instances limit={trunks.length} range={trunks.length}>
        <cylinderGeometry args={[0.28, 0.44, 1, 6]} />
        <meshStandardMaterial color={trunkColor} roughness={1} />
        {trunks.map((tree) => (
          <Instance
            key={tree.key}
            position={[tree.x, (tree.height * treeTrunkRatio) / 2, tree.z]}
            scale={[1, tree.height * treeTrunkRatio, 1]}
          />
        ))}
      </Instances>

      <Instances limit={canopy.length} range={canopy.length}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
        {canopy.map((tier) => (
          <Instance
            key={tier.key}
            position={tier.position}
            scale={tier.scale}
            color={haze(tier.color, palette.sky, BACKDROP.hazeNear)}
          />
        ))}
      </Instances>
    </>
  );
}

/** Cottages beyond the trees: a plastered box under a steep pitched roof. */
function Village({ palette }: { palette: StagePalette }) {
  const { village, cottageHeightRatio, roofHeightRatio, roofOverhang } = BACKDROP;

  const houses = useMemo(
    () =>
      scatter(village.count, village.radiusM, village.jitterM).map((spot) => {
        const width = village.minWidthM + spot.roll * (village.maxWidthM - village.minWidthM);
        return { ...spot, width, height: width * cottageHeightRatio };
      }),
    [village, cottageHeightRatio],
  );

  const wall = haze(palette.cottage, palette.sky, BACKDROP.hazeMid);
  const roof = haze(palette.cottageRoof, palette.sky, BACKDROP.hazeMid);

  return (
    <>
      <Instances limit={houses.length} range={houses.length}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={wall} roughness={1} />
        {houses.map((house) => (
          <Instance
            key={house.key}
            position={[house.x, house.height / 2, house.z]}
            rotation={[0, -house.angle, 0]}
            scale={[house.width, house.height, house.width * 0.8]}
          />
        ))}
      </Instances>

      {/* a four-sided cone IS a pitched roof, turned an eighth so its ridge lines up */}
      <Instances limit={houses.length} range={houses.length}>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color={roof} roughness={1} flatShading />
        {houses.map((house) => (
          <Instance
            key={house.key}
            position={[house.x, house.height + (house.width * roofHeightRatio) / 2, house.z]}
            rotation={[0, -house.angle + Math.PI / 4, 0]}
            scale={[
              house.width * roofOverhang * 0.75,
              house.width * roofHeightRatio,
              house.width * roofOverhang * 0.75,
            ]}
          />
        ))}
      </Instances>
    </>
  );
}

/**
 * The hills on the horizon: big soft blobs, sunk so only their tops show, and washed
 * so far toward the sky that they are barely there. They are the last thing between
 * the village and the fog, and they are what gives the sky a bottom.
 */
function Hills({ palette }: { palette: StagePalette }) {
  const { hills } = BACKDROP;

  const mounds = useMemo(
    () =>
      scatter(hills.count, hills.radiusM, hills.radiusM * 0.06).map((spot) => ({
        ...spot,
        radius: hills.minRadiusM + spot.roll * (hills.maxRadiusM - hills.minRadiusM),
      })),
    [hills],
  );

  return (
    <Instances limit={mounds.length} range={mounds.length}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial
        color={haze(palette.hill, palette.sky, BACKDROP.hazeFar)}
        roughness={1}
        flatShading
      />
      {mounds.map((mound) => (
        <Instance
          key={mound.key}
          position={[mound.x, -mound.radius * hills.sinkRatio, mound.z]}
          scale={[mound.radius, mound.radius * 0.8, mound.radius]}
        />
      ))}
    </Instances>
  );
}
