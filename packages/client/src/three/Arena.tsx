import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Instance, Instances, RoundedBox } from "@react-three/drei";
import { DoubleSide, type Group, type Mesh } from "three";
import {
  ObstacleKind,
  StageTheme,
  TAU,
  pointOnCircle,
  type Obstacle,
  type StageConfig,
} from "@hammer/shared";
import { selectStage, useGame } from "../store";
import { FLOOR, PLATFORM, SCENE, STAGE_FX, ZONE_FX } from "../config/view";
import {
  METEOR_COLORS,
  RAIN_COLORS,
  obstacleColors,
  stagePalette,
  type StagePalette,
} from "../config/theme";
import { Grass } from "./Grass";
import { PlazaDressing } from "./Plaza";
import { fadeUpTexture, stoneFloorTexture } from "./textures";

/**
 * The stage: the island it stands on, the floor you fight on, the cover you fight
 * around, and the dressing that makes it a place rather than a disc.
 *
 * The arena is a THICK FLOATING ISLAND — a tiled floor, a low wall, a coloured rim
 * and a tapered underside — because a flat circle on an empty background reads as a
 * debug view, however nicely it is coloured.
 *
 * In a match the danger floor covers the whole arena with the SAFE disc drawn on
 * top and scaled to `zoneRadius` every frame, so the shrink costs one scale rather
 * than new geometry, and the closing edge is drawn as a WALL of light you can see
 * from anywhere. In the lobby it is a plain, friendly plaza instead: no danger, no
 * zone, and its own party dressing.
 *
 * Everything decorative is laid out from the stage's own `decor` counts
 * (`shared/stages.ts`), so a future map redresses itself by changing data.
 */

/** Rotation that lays a plane flat on the ground, facing up. */
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Draw order above the floor — tiny offsets that keep the layers from z-fighting. */
const LAYER = {
  island: -0.02,
  safeFloor: 0.006,
  sheen: 0.03,
  ring: 0.02,
  scorchLine: 0.024,
} as const;

export function Arena({ isPlaza, raining }: { isPlaza: boolean; raining: boolean }) {
  const arenaRadius = useGame((s) => s.arenaRadius);
  const theme = useGame((s) => s.stageTheme);
  const stage = useGame(selectStage);
  const palette = stagePalette(isPlaza ? StageTheme.Lobby : theme);

  /** the stands have to stand ON something, so the island grows to carry them */
  const standsSpan =
    !isPlaza && stage.decor.stands
      ? STAGE_FX.stands.startOffsetM + STAGE_FX.stands.tiers * STAGE_FX.stands.stepOutM
      : 0;
  const islandRadius = arenaRadius + PLATFORM.overhangM + standsSpan;

  return (
    <>
      <Island radius={islandRadius} palette={palette} />
      <Floor isPlaza={isPlaza} radius={arenaRadius} palette={palette} />
      <Grass radius={arenaRadius} palette={palette} />
      <Boundary radius={arenaRadius} palette={palette} />
      {raining && <Sheen radius={arenaRadius} />}

      {isPlaza ? (
        <PlazaDressing radius={arenaRadius} palette={palette} />
      ) : (
        <>
          <Cover obstacles={stage.obstacles} palette={palette} />
          <Dressing stage={stage} palette={palette} />
        </>
      )}
    </>
  );
}

// ── The island ────────────────────────────────────────────────────────────────

/**
 * The chunk of world the arena is carved into: a wide top, a coloured band round
 * the lip, a tapering flank and a point underneath. Four meshes, and it is the
 * single biggest reason the game stops looking like a prototype.
 */
function Island({ radius, palette }: { radius: number; palette: StagePalette }) {
  const bottomRadius = radius * PLATFORM.taper;

  return (
    <group>
      {/* the ledge outside the wall — plain, so the tiles inside read as "the arena" */}
      <mesh rotation={FLAT} position={[0, LAYER.island, 0]} receiveShadow>
        <circleGeometry args={[radius, PLATFORM.segments]} />
        <meshStandardMaterial color={palette.platform} roughness={0.95} />
      </mesh>

      {/* the bright band round the lip */}
      <mesh position={[0, -PLATFORM.rimHeightM / 2, 0]}>
        <cylinderGeometry
          args={[
            radius + PLATFORM.rimOutM,
            radius + PLATFORM.rimOutM,
            PLATFORM.rimHeightM,
            PLATFORM.segments,
            1,
            true,
          ]}
        />
        <meshStandardMaterial color={palette.rim} roughness={0.7} side={DoubleSide} />
      </mesh>

      {/* the flank, and the point it tapers away to underneath */}
      <mesh position={[0, -PLATFORM.rimHeightM - PLATFORM.depthM / 2, 0]}>
        <cylinderGeometry
          args={[radius, bottomRadius, PLATFORM.depthM, PLATFORM.segments, 1, true]}
        />
        <meshStandardMaterial color={palette.platformShade} roughness={1} side={DoubleSide} />
      </mesh>
      <mesh
        position={[0, -PLATFORM.rimHeightM - PLATFORM.depthM - PLATFORM.tipDepthM / 2, 0]}
        rotation={[Math.PI, 0, 0]}
      >
        <coneGeometry args={[bottomRadius, PLATFORM.tipDepthM, PLATFORM.segments]} />
        <meshStandardMaterial color={palette.platformShade} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// ── The floor ─────────────────────────────────────────────────────────────────

/**
 * The floor you actually play on: WEATHERED STONE FLAGS.
 *
 * The flags matter more than they look like they should. They are the only thing in
 * an open arena that tells you how fast you are moving and how far away someone is,
 * and — unlike the clean two-tone check they replaced — they also tell you the place
 * has a history: every flag is a different tone, the mortar wanders, the corners are
 * bevelled and the whole thing is worn and cracked. All of it is painted into a
 * canvas at runtime (`textures.ts`) rather than shipped as an image, so the game
 * still opens instantly on party wifi.
 */
function Floor({
  isPlaza,
  radius,
  palette,
}: {
  isPlaza: boolean;
  radius: number;
  palette: StagePalette;
}) {
  const safeFloor = useRef<Mesh>(null);
  const zoneWall = useRef<Group>(null);

  const tiles = useMemo(
    () =>
      stoneFloorTexture({
        flagA: palette.flagA,
        flagB: palette.flagB,
        mortar: palette.mortar,
        bevelLight: palette.bevelLight,
        bevelDark: palette.bevelDark,
        wear: palette.wear,
      }),
    [
      palette.flagA,
      palette.flagB,
      palette.mortar,
      palette.bevelLight,
      palette.bevelDark,
      palette.wear,
    ],
  );
  /**
   * The safe disc is a UNIT circle scaled to the live zone radius, so its tiles
   * would stretch as the zone closed. Its own copy of the texture gets its repeat
   * rewound by the same factor each frame — the tiles stay put on the ground and
   * the zone slides over them.
   */
  const safeTiles = useMemo(() => tiles.clone(), [tiles]);

  useFrame(({ clock }) => {
    if (isPlaza) return;
    const zoneRadius = useGame.getState().zoneRadius || radius;

    safeFloor.current?.scale.set(zoneRadius, zoneRadius, 1);
    const repeat = (FLOOR.repeats * zoneRadius) / radius;
    safeTiles.repeat.set(repeat, repeat);
    // keep the tile grid pinned to the middle of the arena rather than the disc's edge
    safeTiles.offset.set((1 - repeat) / 2, (1 - repeat) / 2);

    if (zoneWall.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * ZONE_FX.pulseRate) * ZONE_FX.pulseAmount;
      zoneWall.current.scale.set(zoneRadius, pulse, zoneRadius);
    }
  });

  if (isPlaza) {
    return (
      <mesh rotation={FLAT} receiveShadow>
        <circleGeometry args={[radius, SCENE.circleSegments]} />
        <meshStandardMaterial map={tiles} roughness={0.85} />
      </mesh>
    );
  }

  return (
    <>
      {/* the killing floor — full arena, sits under the safe disc */}
      <mesh rotation={FLAT} receiveShadow>
        <circleGeometry args={[radius, SCENE.circleSegments]} />
        <meshStandardMaterial
          color={palette.danger}
          emissive={palette.dangerEmissive}
          emissiveIntensity={0.3}
          roughness={0.9}
        />
      </mesh>
      {/* the safe disc — a unit circle scaled to zoneRadius */}
      <mesh ref={safeFloor} rotation={FLAT} position={[0, LAYER.safeFloor, 0]} receiveShadow>
        <circleGeometry args={[1, SCENE.circleSegments]} />
        <meshStandardMaterial map={safeTiles} roughness={0.85} />
      </mesh>
      <ZoneWall groupRef={zoneWall} color={palette.ring} />
    </>
  );
}

/**
 * The closing zone, drawn as a curtain of light: bright where it meets the floor,
 * faded to nothing overhead. A line painted on the ground is invisible the moment
 * anybody stands in front of it — a wall is not.
 */
function ZoneWall({ groupRef, color }: { groupRef: React.RefObject<Group>; color: string }) {
  const fade = useMemo(() => fadeUpTexture(), []);

  return (
    <group ref={groupRef}>
      <mesh position={[0, ZONE_FX.wallHeightM / 2, 0]}>
        <cylinderGeometry args={[1, 1, ZONE_FX.wallHeightM, ZONE_FX.segments, 1, true]} />
        <meshBasicMaterial
          color={color}
          alphaMap={fade}
          transparent
          opacity={ZONE_FX.wallOpacity}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* the hot line along the bottom, so the edge is exact and not just a glow */}
      <mesh position={[0, ZONE_FX.edgeHeightM / 2, 0]}>
        <cylinderGeometry args={[1, 1, ZONE_FX.edgeHeightM, ZONE_FX.segments, 1, true]} />
        <meshBasicMaterial color={color} side={DoubleSide} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** A wet floor catches the light — one translucent sheen disc over everything. */
function Sheen({ radius }: { radius: number }) {
  return (
    <mesh rotation={FLAT} position={[0, LAYER.sheen, 0]}>
      <circleGeometry args={[radius, SCENE.circleSegments]} />
      <meshStandardMaterial
        color={RAIN_COLORS.sheen}
        transparent
        opacity={0.28}
        roughness={0.15}
        metalness={0.4}
      />
    </mesh>
  );
}

// ── The boundary ──────────────────────────────────────────────────────────────

/**
 * The wall at the edge of the playable area. It stands exactly where players are
 * clamped, so "the edge" is something you can see and get slammed into rather than
 * an invisible limit you discover by walking at it.
 */
function Boundary({ radius, palette }: { radius: number; palette: StagePalette }) {
  const posts = useMemo(
    () =>
      Array.from({ length: PLATFORM.postCount }, (_, i) => {
        const [x, z] = pointOnCircle(
          (i / PLATFORM.postCount) * TAU,
          radius + PLATFORM.wallThicknessM / 2,
        );
        return { key: i, position: [x, PLATFORM.postHeightM / 2, z] as const };
      }),
    [radius],
  );

  return (
    <>
      <mesh position={[0, PLATFORM.wallHeightM / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry
          args={[
            radius + PLATFORM.wallThicknessM,
            radius + PLATFORM.wallThicknessM,
            PLATFORM.wallHeightM,
            PLATFORM.segments,
            1,
            true,
          ]}
        />
        <meshStandardMaterial color={palette.wall} roughness={0.9} side={DoubleSide} />
      </mesh>
      {/* the rail capping it, which is also what you see from inside the arena */}
      <mesh rotation={FLAT} position={[0, PLATFORM.wallHeightM, 0]}>
        <ringGeometry args={[radius, radius + PLATFORM.wallThicknessM * 2, PLATFORM.segments]} />
        <meshStandardMaterial color={palette.wallTrim} roughness={0.8} side={DoubleSide} />
      </mesh>
      {/* the painted safety line, so the edge reads from the middle of the arena */}
      <mesh rotation={FLAT} position={[0, LAYER.ring, 0]}>
        <ringGeometry args={[radius - SCENE.boundaryWidthM, radius, SCENE.circleSegments]} />
        <meshBasicMaterial color={palette.boundary} transparent opacity={0.7} />
      </mesh>

      <Instances limit={posts.length} range={posts.length} castShadow>
        <capsuleGeometry args={[PLATFORM.postRadiusM, PLATFORM.postHeightM * 0.6, 4, 8]} />
        <meshStandardMaterial color={palette.wallTrim} roughness={0.75} />
        {posts.map((post) => (
          <Instance key={post.key} position={post.position} />
        ))}
      </Instances>
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
        <group rotation={[0, Math.PI / 5, 0]}>
          <RoundedBox
            args={[side, obstacle.height, side]}
            radius={obstacle.height * 0.08}
            smoothness={2}
            position={[0, obstacle.height / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={colors.main} roughness={0.9} />
          </RoundedBox>
          {/* the iron strap round the middle, and the lid */}
          <mesh position={[0, obstacle.height * 0.5, 0]}>
            <boxGeometry args={[side * 1.03, obstacle.height * 0.16, side * 1.03]} />
            <meshStandardMaterial color={colors.trim} roughness={0.7} metalness={0.2} />
          </mesh>
          <mesh position={[0, obstacle.height + 0.04, 0]} castShadow>
            <boxGeometry args={[side * 1.08, 0.1, side * 1.08]} />
            <meshStandardMaterial color={colors.trim} roughness={0.8} />
          </mesh>
        </group>
      ) : (
        <>
          <mesh position={[0, obstacle.height / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry
              args={[obstacle.radius * 0.82, obstacle.radius * 0.94, obstacle.height, 12]}
            />
            <meshStandardMaterial color={colors.main} roughness={0.9} />
          </mesh>
          {/* base and capital, so a pillar reads as built rather than extruded */}
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[obstacle.radius * 1.06, obstacle.radius * 1.16, 0.36, 12]} />
            <meshStandardMaterial color={colors.trim} roughness={0.9} />
          </mesh>
          <mesh position={[0, obstacle.height, 0]} castShadow>
            <cylinderGeometry args={[obstacle.radius * 1.12, obstacle.radius * 0.88, 0.32, 12]} />
            <meshStandardMaterial color={colors.trim} roughness={0.9} />
          </mesh>
        </>
      )}
      {/* a painted ring on the floor, so cover reads from across the arena */}
      <mesh rotation={FLAT} position={[0, LAYER.scorchLine, 0]}>
        <ringGeometry args={[obstacle.radius, obstacle.radius * 1.2, 24]} />
        <meshBasicMaterial color={colors.trim} transparent opacity={0.5} />
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
      <Columns
        count={decor.columns}
        radius={stage.radius + STAGE_FX.column.offsetM}
        palette={palette}
      />
      <Banners
        count={decor.banners}
        radius={stage.radius + STAGE_FX.banner.offsetM}
        palette={palette}
      />
      <Torches
        count={decor.torches}
        radius={stage.radius + STAGE_FX.torch.offsetM}
        palette={palette}
      />
      <Clouds count={decor.clouds} palette={palette} />
    </>
  );
}

/** Evenly spaced slots round a ring, each turned to face the middle. */
function ringSlots(count: number, radius: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / Math.max(1, count)) * TAU;
    const [x, z] = pointOnCircle(angle, radius);
    // -angle turns the prop's face back toward the arena centre
    return { key: i, x, z, rotation: -angle + Math.PI / 2 };
  });
}

/** Stone columns ringing the arena — one instanced draw call for all of them. */
function Columns({
  count,
  radius,
  palette,
}: {
  count: number;
  radius: number;
  palette: StagePalette;
}) {
  const slots = useMemo(() => ringSlots(count, radius), [count, radius]);
  if (count === 0) return null;

  return (
    <Instances limit={count} range={count} castShadow>
      <cylinderGeometry
        args={[
          STAGE_FX.column.radiusM * 0.82,
          STAGE_FX.column.radiusM,
          STAGE_FX.column.heightM,
          10,
        ]}
      />
      <meshStandardMaterial color={palette.stone} roughness={0.9} />
      {slots.map((slot) => (
        <Instance key={slot.key} position={[slot.x, STAGE_FX.column.heightM / 2, slot.z]} />
      ))}
    </Instances>
  );
}

/**
 * Cloth banners hung between the columns: a panel, a pointed tail and a bar along
 * the top. Instanced three times over rather than three meshes per banner.
 */
function Banners({
  count,
  radius,
  palette,
}: {
  count: number;
  radius: number;
  palette: StagePalette;
}) {
  const slots = useMemo(() => ringSlots(count, radius), [count, radius]);
  if (count === 0) return null;

  const { widthM, heightM, topM } = STAGE_FX.banner;
  const panelY = topM - heightM / 2;
  const tailY = topM - heightM;

  return (
    <>
      <Instances limit={count} range={count}>
        <planeGeometry args={[widthM, heightM]} />
        <meshStandardMaterial color={palette.banner} roughness={0.9} side={DoubleSide} />
        {slots.map((slot) => (
          <Instance
            key={slot.key}
            position={[slot.x, panelY, slot.z]}
            rotation={[0, slot.rotation, 0]}
          />
        ))}
      </Instances>

      {/* the tail: a square stood on its corner, half of it below the panel */}
      <Instances limit={count} range={count}>
        <planeGeometry args={[STAGE_FX.bannerTailM, STAGE_FX.bannerTailM]} />
        <meshStandardMaterial color={palette.banner} roughness={0.9} side={DoubleSide} />
        {slots.map((slot) => (
          <Instance
            key={slot.key}
            position={[slot.x, tailY, slot.z]}
            rotation={[0, slot.rotation, Math.PI / 4]}
          />
        ))}
      </Instances>

      <Instances limit={count} range={count}>
        <boxGeometry args={[widthM * 1.1, 0.12, 0.12]} />
        <meshStandardMaterial color={palette.bannerTrim} roughness={0.6} metalness={0.2} />
        {slots.map((slot) => (
          <Instance
            key={slot.key}
            position={[slot.x, topM, slot.z]}
            rotation={[0, slot.rotation, 0]}
          />
        ))}
      </Instances>
    </>
  );
}

/**
 * Tiered seating with an actual crowd in it. Each tier is one open cylinder, one
 * lip, and one instanced ring of little spectators that bobs on its own beat — so
 * the stands ripple like a stadium instead of sitting there like scenery.
 */
function Stands({ radius, palette }: { radius: number; palette: StagePalette }) {
  const tiers = useMemo(
    () =>
      Array.from({ length: STAGE_FX.stands.tiers }, (_, i) => ({
        key: i,
        radius: radius + STAGE_FX.stands.startOffsetM + i * STAGE_FX.stands.stepOutM,
        height: (i + 1) * STAGE_FX.stands.stepUpM,
      })),
    [radius],
  );

  return (
    <>
      {tiers.map((tier) => (
        <group key={tier.key}>
          <mesh position={[0, tier.height / 2, 0]} receiveShadow>
            <cylinderGeometry
              args={[tier.radius, tier.radius, tier.height, PLATFORM.segments, 1, true]}
            />
            <meshStandardMaterial color={palette.stands} roughness={0.95} side={DoubleSide} />
          </mesh>
          {/* the row itself, shaded off the riser so the tiers actually read */}
          <mesh position={[0, tier.height, 0]} rotation={FLAT} receiveShadow>
            <ringGeometry
              args={[tier.radius - STAGE_FX.stands.stepOutM * 0.8, tier.radius, PLATFORM.segments]}
            />
            <meshStandardMaterial color={palette.stoneShade} roughness={0.9} side={DoubleSide} />
          </mesh>
          <Crowd
            tier={tier.key}
            radius={tier.radius - STAGE_FX.stands.stepOutM * 0.4}
            y={tier.height}
            palette={palette}
          />
        </group>
      ))}
    </>
  );
}

/** One ring of spectators, bobbing together on a beat of their own. */
function Crowd({
  tier,
  radius,
  y,
  palette,
}: {
  tier: number;
  radius: number;
  y: number;
  palette: StagePalette;
}) {
  const group = useRef<Group>(null);

  const seats = useMemo(
    () =>
      Array.from({ length: STAGE_FX.crowdPerTier }, (_, i) => {
        const [x, z] = pointOnCircle((i / STAGE_FX.crowdPerTier) * TAU, radius);
        return {
          key: i,
          position: [x, y + STAGE_FX.crowdSizeM * 0.5, z] as const,
          color: palette.crowd[(i + tier) % palette.crowd.length],
        };
      }),
    [radius, y, tier, palette.crowd],
  );

  useFrame((state) => {
    if (!group.current) return;
    // each tier is a third of a beat behind the one in front — that's the wave
    const phase = state.clock.elapsedTime * STAGE_FX.crowdBobRate + tier * 1.1;
    group.current.position.y = Math.abs(Math.sin(phase)) * STAGE_FX.crowdBobM;
  });

  return (
    <group ref={group}>
      <Instances limit={seats.length} range={seats.length}>
        <capsuleGeometry args={[STAGE_FX.crowdSizeM * 0.5, STAGE_FX.crowdSizeM * 0.6, 3, 6]} />
        <meshStandardMaterial roughness={0.9} />
        {seats.map((seat) => (
          <Instance key={seat.key} position={seat.position} color={seat.color} />
        ))}
      </Instances>
    </group>
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

  const slots = useMemo(() => ringSlots(count, radius), [count, radius]);
  if (count === 0) return null;

  return (
    <>
      <Instances limit={count} range={count} castShadow>
        <cylinderGeometry args={[0.18, 0.28, STAGE_FX.torch.heightM, 8]} />
        <meshStandardMaterial color={palette.stone} roughness={0.95} />
        {slots.map((slot) => (
          <Instance key={slot.key} position={[slot.x, STAGE_FX.torch.heightM / 2, slot.z]} />
        ))}
      </Instances>

      <group ref={flames}>
        {slots.map((slot) => (
          <group key={slot.key} position={[slot.x, STAGE_FX.torch.heightM + 0.24, slot.z]}>
            <mesh>
              <coneGeometry args={[STAGE_FX.torch.flameM, STAGE_FX.torch.flameM * 2.4, 8]} />
              <meshStandardMaterial
                color={METEOR_COLORS.ember}
                emissive={METEOR_COLORS.ember}
                emissiveIntensity={1.2}
              />
            </mesh>
            {/* the haze around it — a flame with no glow just looks like a cone */}
            <mesh>
              <sphereGeometry args={[STAGE_FX.torchGlow.radiusM, 10, 8]} />
              <meshBasicMaterial
                color={METEOR_COLORS.flash}
                transparent
                opacity={STAGE_FX.torchGlow.opacity}
                depthWrite={false}
              />
            </mesh>
          </group>
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
        const radius =
          STAGE_FX.cloud.minRadiusM + t * (STAGE_FX.cloud.maxRadiusM - STAGE_FX.cloud.minRadiusM);
        const [x, z] = pointOnCircle(t * TAU, radius);
        const y =
          STAGE_FX.cloud.minHeightM +
          (((i * 7) % 10) / 10) * (STAGE_FX.cloud.maxHeightM - STAGE_FX.cloud.minHeightM);
        const size = STAGE_FX.cloud.sizeM * (0.6 + ((i * 3) % 5) / 5);
        return {
          key: i,
          position: [x, y, z] as const,
          scale: [size, size * 0.4, size * 0.7] as const,
        };
      }),
    [count],
  );

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.012;
  });

  if (count === 0) return null;

  return (
    <group ref={group}>
      <Instances limit={count} range={count}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={palette.stone} roughness={1} flatShading />
        {slabs.map((slab) => (
          <Instance key={slab.key} position={slab.position} scale={slab.scale} />
        ))}
      </Instances>
    </group>
  );
}
