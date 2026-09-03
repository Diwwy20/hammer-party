import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, DoubleSide, Object3D, type InstancedMesh } from "three";
import { TAU, clamp01, pointOnCircle } from "@hammer/shared";
import { useGame } from "../store";
import { GRASS } from "../config/view";
import type { StagePalette } from "../config/theme";
import { grassPatchTexture, tuftTexture } from "./textures";

/**
 * Two quads crossed at right angles, standing on the floor — the standard way to
 * draw a clump of vegetation, and the reason it is standard is that it has a
 * silhouette from every direction the camera can be in.
 *
 * The normals all point straight UP rather than out of the quads. A blade lit by its
 * own facing goes dark the moment it turns away from the sun, and a field of grass
 * that flickers between light and dark as you walk past it looks broken; lit as
 * though it were the ground it grows out of, it stays the colour of grass.
 */
function crossedQuads(): BufferGeometry {
  const geometry = new BufferGeometry();
  const h = 0.5;
  geometry.setAttribute(
    "position",
    new BufferAttribute(
      // prettier-ignore
      new Float32Array([
        -h, 0, 0,   h, 0, 0,   h, 1, 0,  -h, 1, 0,
        0, 0, -h,   0, 0, h,   0, 1, h,   0, 1, -h,
      ]),
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]), 2),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(Array.from({ length: 8 }, () => [0, 1, 0]).flat()), 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return geometry;
}

/**
 * Cartoon grass growing up through the flagstones.
 *
 * Two layers doing two different jobs: painted PATCHES laid flat on the stone carry
 * the colour and the softness, and little standing TUFTS break the silhouette so the
 * floor is not perfectly flat where the grass is. Neither is expensive — one
 * instanced mesh each, for the whole arena.
 *
 * Both are culled against the SAFE ZONE, and that turned out to be the best part of
 * it: as the zone closes, the grass shrinks away ahead of it. The boundary stops
 * being a line drawn on the world and starts being something that is happening to
 * the world — and it costs one distance test per clump per frame.
 */
export function Grass({ radius, palette }: { radius: number; palette: StagePalette }) {
  const patches = useRef<InstancedMesh>(null);
  const tufts = useRef<InstancedMesh>(null);
  const pose = useMemo(() => new Object3D(), []);

  const texture = useMemo(
    () => grassPatchTexture(palette.grass, palette.grassShade),
    [palette.grass, palette.grassShade],
  );
  const tuft = useMemo(
    () => tuftTexture(palette.grass, palette.grassShade),
    [palette.grass, palette.grassShade],
  );
  const blades = useMemo(() => crossedQuads(), []);

  /**
   * Where every clump grows.
   *
   * The PATCHES are laid out on a golden-angle spiral, which scatters them evenly
   * without ever clumping or lining up. The TUFTS are then grown inside those
   * patches rather than being scattered on their own — that one decision is the
   * difference between grass and green specks, because a tuft standing on bare stone
   * is litter while the same tuft standing in a painted patch is grass.
   *
   * The whole layout is derived from the index, so the grass grows in the same
   * places every time instead of rearranging itself on every mount.
   */
  const clumps = useMemo(() => {
    const span = GRASS.maxRadiusRatio - GRASS.minRadiusRatio;
    const patches = Array.from({ length: GRASS.patchCount }, (_, i) => {
      const angle = i * 2.399963;
      const spread = GRASS.minRadiusRatio + Math.sqrt((i + 0.5) / GRASS.patchCount) * span;
      const distance = radius * spread;
      const [x, z] = pointOnCircle(angle, distance);
      const roll = ((i * 23) % 13) / 13;
      return {
        x,
        z,
        distance,
        size: GRASS.minPatchM + roll * (GRASS.maxPatchM - GRASS.minPatchM),
        spin: roll * TAU,
      };
    });

    const tufts = patches.flatMap((patch, p) =>
      Array.from({ length: GRASS.bladesPerPatch }, (_, i) => {
        const angle = (p * 7 + i) * 2.399963;
        const reach =
          Math.sqrt((i + 0.4) / GRASS.bladesPerPatch) * patch.size * GRASS.bladeSpreadRatio;
        const roll = ((p * 5 + i * 11) % 9) / 9;
        return {
          x: patch.x + Math.cos(angle) * reach,
          z: patch.z + Math.sin(angle) * reach,
          // culled against the patch it belongs to, so a tuft never outlives its paint
          distance: patch.distance,
          size: GRASS.bladeWidthM * (0.7 + roll * 0.8),
          spin: roll * TAU,
        };
      }),
    );

    return { patches, tufts };
  }, [radius]);

  useFrame(({ clock }) => {
    const zoneRadius = useGame.getState().zoneRadius || radius;
    const breathe = 1 + Math.sin(clock.elapsedTime * GRASS.swayRate) * GRASS.swayRad * 0.4;

    if (patches.current) {
      clumps.patches.forEach((clump, i) => {
        // shrink away as the zone passes over, rather than popping out of existence
        const alive = clamp01((zoneRadius - clump.distance) / clump.size);
        pose.position.set(clump.x, GRASS.liftM, clump.z);
        pose.rotation.set(-Math.PI / 2, 0, clump.spin);
        pose.scale.setScalar(clump.size * alive);
        pose.updateMatrix();
        patches.current!.setMatrixAt(i, pose.matrix);
      });
      patches.current.instanceMatrix.needsUpdate = true;
    }

    if (tufts.current) {
      clumps.tufts.forEach((clump, i) => {
        const alive = clamp01((zoneRadius - clump.distance) / GRASS.maxPatchM);
        // the crossed quads stand ON their origin, so the tuft is planted, not sunk
        const height = GRASS.bladeHeightM * alive * breathe;
        pose.position.set(clump.x, GRASS.liftM, clump.z);
        pose.rotation.set(0, clump.spin, 0);
        pose.scale.set(clump.size * alive, height, clump.size * alive);
        pose.updateMatrix();
        tufts.current!.setMatrixAt(i, pose.matrix);
      });
      tufts.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh
        ref={patches}
        args={[undefined, undefined, clumps.patches.length]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} side={DoubleSide} />
      </instancedMesh>

      {/* the standing tufts: painted blades on two crossed quads, so they have a
          silhouette from wherever the camera happens to be */}
      <instancedMesh
        ref={tufts}
        geometry={blades}
        args={[undefined, undefined, clumps.tufts.length]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          map={tuft}
          transparent
          // alpha-tested rather than blended: a few hundred blended quads would have
          // to be depth-sorted against each other every frame, and a cut-out blade
          // of grass has nothing to gain from a soft edge
          alphaTest={0.45}
          roughness={0.9}
          side={DoubleSide}
        />
      </instancedMesh>
    </>
  );
}
