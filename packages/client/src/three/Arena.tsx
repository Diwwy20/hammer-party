import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import {
  ObstacleKind,
  StageTheme,
  TAU,
  pointOnCircle,
  type Obstacle,
  type StageConfig,
} from "@hammer/shared";
import { selectStage, useGame } from "../store";
import { SCENE, STAGE_FX } from "../config/view";
import {
  METEOR_COLORS,
  RAIN_COLORS,
  obstacleColors,
  stagePalette,
  type StagePalette,
} from "../config/theme";

/**
 * The stage: the floor, the cover you fight around, and the dressing that makes it
 * a place rather than a disc.
 *
 * In a match the danger floor covers the whole arena with the SAFE disc drawn on top
 * and scaled to `zoneRadius` every frame — so the shrink is one cheap scale, not new
 * geometry. In the lobby it is a plain, friendly plaza: no danger, no zone, no props.
 *
 * Everything decorative is laid out from the stage's own `decor` counts
 * (`shared/stages.ts`), so a future map redresses itself by changing data.
 */

/** Rotation that lays a plane flat on the ground, facing up. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Draw order above the floor — tiny offsets that keep the rings from z-fighting. */
const LAYER = {
  safeFloor: 0.006,
  sheen: 0.014,
  ring: 0.02,
  zoneEdge: 0.03,
} as const;

export function Arena({ isPlaza, raining }: { isPlaza: boolean; raining: boolean }) {
  const arenaRadius = useGame((s) => s.arenaRadius);
  const theme = useGame((s) => s.stageTheme);
  const stage = useGame(selectStage);
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

  /** A wet floor catches the light — one translucent sheen disc over everything. */
  const sheen = raining && (
    <mesh rotation={FLAT} position={[0, LAYER.sheen, 0]}>
      <circleGeometry args={[arenaRadius, SCENE.circleSegments]} />
      <meshStandardMaterial
        color={RAIN_COLORS.sheen}
        transparent
        opacity={0.28}
        roughness={0.15}
        metalness={0.4}
      />
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
        {sheen}
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
      {sheen}

      <Cover obstacles={stage.obstacles} palette={palette} />
      <Dressing stage={stage} palette={palette} />
    </>
  );
}

// ── Solid cover ───────────────────────────────────────────────────────────────

/**
 * The props players actually collide with. Their footprint is the SAME circle the
 * server pushes people out of (`Obstacle.radius`), so what you can hide behind is
 * exactly what you see.
 */
function Cover({ obstacles, palette }: { obstacles: Obstacle[]; palette: StagePalette }) {
  return (
    <>
      {obstacles.map((obstacle, index) => (
        <Prop key={index} obstacle={obstacle} palette={palette} />
      ))}
    </>
  );
}

function Prop({ obstacle, palette }: { obstacle: Obstacle; palette: StagePalette }) {
  const colors = obstacleColors(obstacle.kind, palette);
  const isCrate = obstacle.kind === ObstacleKind.Crate;
  // a crate's box is inscribed in its collision circle, so the corners don't stick out
  const side = obstacle.radius * Math.SQRT2;

  return (
    <group position={[obstacle.x, 0, obstacle.z]}>
      {isCrate ? (
        <>
          <mesh position={[0, obstacle.height / 2, 0]} rotation={[0, Math.PI / 5, 0]} castShadow>
            <boxGeometry args={[side, obstacle.height, side]} />
            <meshStandardMaterial color={colors.main} roughness={0.85} />
          </mesh>
          <mesh position={[0, obstacle.height + 0.03, 0]} rotation={[0, Math.PI / 5, 0]} castShadow>
            <boxGeometry args={[side * 1.06, 0.1, side * 1.06]} />
            <meshStandardMaterial color={colors.trim} roughness={0.8} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, obstacle.height / 2, 0]} castShadow>
            <cylinderGeometry
              args={[obstacle.radius * 0.86, obstacle.radius, obstacle.height, 12]}
            />
            <meshStandardMaterial color={colors.main} roughness={0.9} />
          </mesh>
          {/* base and capital, so a pillar reads as built rather than extruded */}
          <mesh position={[0, 0.16, 0]} castShadow>
            <cylinderGeometry args={[obstacle.radius * 1.1, obstacle.radius * 1.15, 0.32, 12]} />
            <meshStandardMaterial color={colors.trim} roughness={0.9} />
          </mesh>
          <mesh position={[0, obstacle.height, 0]} castShadow>
            <cylinderGeometry args={[obstacle.radius * 1.12, obstacle.radius * 0.9, 0.28, 12]} />
            <meshStandardMaterial color={colors.trim} roughness={0.9} />
          </mesh>
        </>
      )}
      {/* a painted ring on the floor, so cover reads from across the arena */}
      <mesh rotation={FLAT} position={[0, LAYER.ring, 0]}>
        <ringGeometry args={[obstacle.radius, obstacle.radius * 1.18, 20]} />
        <meshBasicMaterial color={colors.trim} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

// ── Dressing (never collides with anything) ───────────────────────────────────

/** Everything outside the wall: the stands, the columns, the banners, the braziers. */
function Dressing({ stage, palette }: { stage: StageConfig; palette: StagePalette }) {
  const { decor } = stage;

  return (
    <>
      {decor.stands && <Stands radius={stage.radius} palette={palette} />}
      <RingOf count={decor.columns} radius={stage.radius + STAGE_FX.column.offsetM}>
        {(key) => (
          <mesh key={key} position={[0, STAGE_FX.column.heightM / 2, 0]} castShadow>
            <cylinderGeometry
              args={[
                STAGE_FX.column.radiusM * 0.85,
                STAGE_FX.column.radiusM,
                STAGE_FX.column.heightM,
                10,
              ]}
            />
            <meshStandardMaterial color={palette.stone} roughness={0.9} />
          </mesh>
        )}
      </RingOf>

      <RingOf count={decor.banners} radius={stage.radius + STAGE_FX.banner.offsetM}>
        {(key) => (
          <mesh
            key={key}
            position={[0, STAGE_FX.banner.topM - STAGE_FX.banner.heightM / 2, 0]}
            rotation={[0, Math.PI, 0]}
          >
            <planeGeometry args={[STAGE_FX.banner.widthM, STAGE_FX.banner.heightM]} />
            <meshStandardMaterial color={palette.banner} roughness={0.85} side={2} />
          </mesh>
        )}
      </RingOf>

      <Torches
        count={decor.torches}
        radius={stage.radius + STAGE_FX.torch.offsetM}
        palette={palette}
      />
      <Clouds count={decor.clouds} palette={palette} />
    </>
  );
}

/**
 * Place `count` copies of one prop evenly around a ring, each turned to face the
 * middle. Every piece of dressing is laid out this way, so a stage's look is driven
 * entirely by the numbers in its `decor`.
 */
function RingOf({
  count,
  radius,
  children,
}: {
  count: number;
  radius: number;
  children: (key: number) => React.ReactNode;
}) {
  const slots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / Math.max(1, count)) * TAU;
        const [x, z] = pointOnCircle(angle, radius);
        // -angle turns the prop's face back toward the arena centre
        return { i, x, z, rotation: -angle + Math.PI / 2 };
      }),
    [count, radius],
  );

  return (
    <>
      {slots.map((slot) => (
        <group key={slot.i} position={[slot.x, 0, slot.z]} rotation={[0, slot.rotation, 0]}>
          {children(slot.i)}
        </group>
      ))}
    </>
  );
}

/**
 * Tiered seating. Each tier is one open cylinder plus a thin band of "crowd" colour
 * on its lip — which reads as a packed stand from the arena floor at a fraction of
 * the cost of modelling anybody.
 */
function Stands({ radius, palette }: { radius: number; palette: StagePalette }) {
  const tiers = useMemo(
    () =>
      Array.from({ length: STAGE_FX.stands.tiers }, (_, i) => ({
        i,
        radius: radius + STAGE_FX.stands.startOffsetM + i * STAGE_FX.stands.stepOutM,
        height: (i + 1) * STAGE_FX.stands.stepUpM,
        crowd: palette.crowd[i % palette.crowd.length],
      })),
    [radius, palette],
  );

  return (
    <>
      {tiers.map((tier) => (
        <group key={tier.i}>
          <mesh position={[0, tier.height / 2, 0]} receiveShadow>
            <cylinderGeometry args={[tier.radius, tier.radius, tier.height, 48, 1, true]} />
            <meshStandardMaterial color={palette.stands} roughness={0.95} side={2} />
          </mesh>
          <mesh position={[0, tier.height, 0]} rotation={FLAT}>
            <ringGeometry args={[tier.radius - STAGE_FX.stands.stepOutM * 0.75, tier.radius, 48]} />
            <meshStandardMaterial color={tier.crowd} roughness={0.9} side={2} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Braziers: a stone post with a flame that flickers on its own clock. */
function Torches({
  count,
  radius,
  palette,
}: {
  count: number;
  radius: number;
  palette: StagePalette;
}) {
  const flames = useRef<Group>(null);

  useFrame((state) => {
    if (!flames.current) return;
    const t = state.clock.elapsedTime;
    flames.current.children.forEach((flame, index) => {
      // each flame gets its own offset, so the ring never pulses in unison
      const flicker =
        1 + Math.sin(t * STAGE_FX.flameFlickerRate + index * 1.7) * STAGE_FX.flameFlickerAmount;
      flame.scale.set(1, flicker, 1);
    });
  });

  const slots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const [x, z] = pointOnCircle((i / Math.max(1, count)) * TAU, radius);
        return { i, x, z };
      }),
    [count, radius],
  );

  return (
    <>
      {slots.map((slot) => (
        <mesh key={slot.i} position={[slot.x, STAGE_FX.torch.heightM / 2, slot.z]} castShadow>
          <cylinderGeometry args={[0.16, 0.24, STAGE_FX.torch.heightM, 8]} />
          <meshStandardMaterial color={palette.stone} roughness={0.95} />
        </mesh>
      ))}
      <group ref={flames}>
        {slots.map((slot) => (
          <mesh key={slot.i} position={[slot.x, STAGE_FX.torch.heightM + 0.25, slot.z]}>
            <coneGeometry args={[STAGE_FX.torch.flameM, STAGE_FX.torch.flameM * 2.4, 8]} />
            <meshStandardMaterial
              color={METEOR_COLORS.ember}
              emissive={METEOR_COLORS.ember}
              emissiveIntensity={1.1}
            />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Cloud slabs for the floating stages — parallax, nothing more. */
function Clouds({ count, palette }: { count: number; palette: StagePalette }) {
  const group = useRef<Group>(null);

  const slabs = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const t = i / Math.max(1, count);
        const angle = t * TAU;
        const radius =
          STAGE_FX.cloud.minRadiusM + t * (STAGE_FX.cloud.maxRadiusM - STAGE_FX.cloud.minRadiusM);
        const [x, z] = pointOnCircle(angle, radius);
        const y =
          STAGE_FX.cloud.minHeightM +
          (((i * 7) % 10) / 10) * (STAGE_FX.cloud.maxHeightM - STAGE_FX.cloud.minHeightM);
        return { i, x, y, z, size: STAGE_FX.cloud.sizeM * (0.6 + ((i * 3) % 5) / 5) };
      }),
    [count],
  );

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.012;
  });

  return (
    <group ref={group}>
      {slabs.map((slab) => (
        <mesh key={slab.i} position={[slab.x, slab.y, slab.z]}>
          <boxGeometry args={[slab.size, slab.size * 0.28, slab.size * 0.7]} />
          <meshStandardMaterial color={palette.stone} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}
