import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GamePhase, PLAYER_RADIUS, StageTheme, WeatherKind, approach } from "@hammer/shared";
import { selectIsGhost, selectMeAlive, selectStage, useGame } from "../store";
import type { MoveVec } from "../runtime/input";
import { sampleOther } from "../net/movement";
import { BACKDROP, CAMERA, LIGHTING, SKY } from "../config/view";
import { stagePalette, type StagePalette } from "../config/theme";
import { Arena } from "./Arena";
import { Backdrop } from "./Backdrop";
import { Hazards } from "./Hazards";
import { AmbientDust, DamageNumbers, GroundCracks, TargetMarker } from "./Impact";
import { Pickups } from "./Pickups";
import { PlayerAvatar } from "./PlayerAvatar";
import { CloudBank, SkyDome } from "./Sky";
import { Rain } from "./Weather";
import { ViewMode, useSelfControl } from "./useSelfControl";
import type { SelfTransform } from "./types";

/**
 * The 3D world, for every phase.
 *
 * Who sees what:
 *   - a live player  → drives their own avatar on a third-person follow cam
 *   - a DEAD player  → keeps driving, as a ghost: they can still fly about the
 *                      arena, they just can't be seen or hit
 *   - the Host       → either a free orbit cam over the whole arena, or a chase cam
 *                      locked to one living player (`spectateId`)
 *
 * The dead are drawn only for the Host and for other ghosts. To someone still in the
 * fight, a defeated player simply isn't there.
 */
export function World({
  ids,
  sessionId,
  isHost,
  input,
}: {
  ids: string[];
  sessionId?: string;
  isHost: boolean;
  input: MutableRefObject<MoveVec>;
}) {
  const self = useRef<SelfTransform>({ x: 0, z: 0, dir: 0, ready: false });
  const { camera } = useThree();

  const isGhost = useGame(selectIsGhost);
  const meAlive = useGame(selectMeAlive);
  const phase = useGame((s) => s.phase);
  const arenaRadius = useGame((s) => s.arenaRadius);
  const theme = useGame((s) => s.stageTheme);
  const weather = useGame((s) => s.weather);
  const stage = useGame(selectStage);
  const spectateId = useGame((s) => s.spectateId);

  const isPlaza = phase === GamePhase.Lobby;
  const isPlaying = phase === GamePhase.Playing;
  const raining = weather === WeatherKind.Rain;
  const palette = stagePalette(isPlaza ? StageTheme.Lobby : theme);
  /** under a downpour the whole dome flattens to one grey — no gradient, no sun */
  const horizon = raining ? palette.skyRain : palette.sky;

  /** players drive themselves in the plaza and in a match — dead ones included */
  const controlling = !isHost && !!sessionId && (isPlaying || isPlaza);
  const mode = isPlaza ? ViewMode.Plaza : isGhost ? ViewMode.Ghost : ViewMode.Match;

  /** the Host and everyone on the results screen get a camera they can throw around */
  const orbiting = (isHost && !spectateId) || phase === GamePhase.Ended;
  /** only the Host and the dead are shown the ghosts */
  const ghostView = isHost || isGhost || phase === GamePhase.Ended;

  useSelfControl({
    sessionId,
    enabled: controlling,
    mode,
    // ghosts drift a little past the wall, and pass straight through cover
    maxRadius: isGhost ? arenaRadius + PLAYER_RADIUS : arenaRadius - PLAYER_RADIUS,
    obstacles: isPlaza || isGhost ? EMPTY_OBSTACLES : stage.obstacles,
    input,
    self,
  });

  useSpectatorCamera(isHost ? spectateId : "");

  useEffect(() => {
    if (orbiting) camera.position.set(...CAMERA.spectator.position);
  }, [orbiting, camera]);

  return (
    <>
      <color attach="background" args={[horizon]} />
      <fog attach="fog" args={[horizon, SKY.fogNearM, SKY.fogFarM]} />
      <SkyDome
        palette={
          raining
            ? { ...palette, skyTop: palette.skyRain, skyMid: palette.skyRain, sky: palette.skyRain }
            : palette
        }
      />
      <CloudBank />

      <Lights raining={raining} skyColor={palette.sky} groundColor={palette.platform} />

      {/* the countryside the arena stands in — drawn before it, and never in the way */}
      <Countryside palette={palette} />

      <Arena isPlaza={isPlaza} raining={raining} />
      <AmbientDust />
      <GroundCracks />

      <Pickups />
      {isPlaying && <Hazards />}
      {raining && <Rain />}

      {ids.map((id) => (
        <PlayerAvatar
          key={id}
          id={id}
          isMe={id === sessionId}
          hideTags={isPlaza}
          ghostView={ghostView}
          self={self}
        />
      ))}

      {/* who your next swing lands on, and what every swing just cost */}
      <TargetMarker
        self={self}
        sessionId={sessionId}
        active={controlling && isPlaying && meAlive}
      />
      {!isPlaza && <DamageNumbers sessionId={sessionId} self={self} />}

      {orbiting && (
        <OrbitControls
          target={[...CAMERA.spectator.target]}
          maxPolarAngle={Math.PI / 2.1}
          enableDamping
        />
      )}
    </>
  );
}

/**
 * One sun, one cool rim from behind, one sky-to-ground fill, and a little ambient.
 *
 * The shadow camera is sized to the WHOLE arena on purpose: three.js defaults it to
 * a few metres, which quietly means everything past the middle of the map casts no
 * shadow at all — the single flattest-looking thing about the old scene.
 *
 * The RIM light casts nothing and lights nothing you look at directly. It exists to
 * catch the edge of whatever is facing away from the sun, which is what lifts a
 * character off the floor behind it.
 */
function Lights({
  raining,
  skyColor,
  groundColor,
}: {
  raining: boolean;
  skyColor: string;
  groundColor: string;
}) {
  const [dx, dy, dz] = LIGHTING.sunDirection;
  const [rx, ry, rz] = LIGHTING.rimDirection;
  const distance = LIGHTING.sunDistanceM;

  return (
    <>
      <ambientLight
        intensity={raining ? LIGHTING.ambientIntensityRain : LIGHTING.ambientIntensity}
      />
      <directionalLight
        position={[rx * distance, ry * distance, rz * distance]}
        color={skyColor}
        intensity={raining ? LIGHTING.rimIntensityRain : LIGHTING.rimIntensity}
      />
      <hemisphereLight args={[skyColor, groundColor, LIGHTING.hemisphereIntensity]} />
      <directionalLight
        position={[dx * distance, dy * distance, dz * distance]}
        intensity={raining ? LIGHTING.sunIntensityRain : LIGHTING.sunIntensity}
        castShadow
        shadow-mapSize={[LIGHTING.shadowMapSize, LIGHTING.shadowMapSize]}
        shadow-camera-left={-LIGHTING.shadowSpanM}
        shadow-camera-right={LIGHTING.shadowSpanM}
        shadow-camera-top={LIGHTING.shadowSpanM}
        shadow-camera-bottom={-LIGHTING.shadowSpanM}
        shadow-camera-near={LIGHTING.shadowNearM}
        shadow-camera-far={LIGHTING.shadowFarM}
        shadow-bias={LIGHTING.shadowBias}
        shadow-normalBias={LIGHTING.shadowNormalBias}
      />
    </>
  );
}

/**
 * The plain outside the arena, and everything standing on it.
 *
 * It sits `groundDropM` BELOW the arena floor, which is the whole reason the island
 * reads as a raised stone plateau rather than a slab hanging in space: the arena
 * looks down on the countryside, the countryside runs off into the fog, and the
 * island's tapered underside is buried out of sight beneath it.
 *
 * A stage with no `ground` in its palette is one that is meant to be floating (the
 * sky stage), and it gets neither — the drifting cloud slabs do that job there, and
 * a grass plain underneath would give the illusion away.
 */
function Countryside({ palette }: { palette: StagePalette }) {
  if (!palette.ground) return null;

  return (
    <group position={[0, -BACKDROP.groundDropM, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[BACKDROP.groundRadiusM, BACKDROP.groundSegments]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      <Backdrop palette={palette} />
    </group>
  );
}

/** Stages have cover; the plaza doesn't, and ghosts ignore it. Shared so it's stable. */
const EMPTY_OBSTACLES = Object.freeze([]) as never[];

/** The corner every camera in the game looks from, resolved once. */
const YAW_SIN = Math.sin(CAMERA.isoYawRad);
const YAW_COS = Math.cos(CAMERA.isoYawRad);

/**
 * The Host's "watch this player" camera.
 *
 * It is the player camera, closer in: the SAME fixed isometric angle, tracking one
 * person around the arena. It used to swing round behind whoever it followed, which
 * meant the big screen lurched every time its subject turned — on a projector, in
 * front of a room, that reads as the camera being broken rather than as drama.
 *
 * Position is read straight out of the interpolation buffer, so it tracks the same
 * smoothed motion the avatar is drawn at instead of jittering on every 20Hz patch.
 */
function useSpectatorCamera(spectateId: string): void {
  useFrame((state, dt) => {
    if (!spectateId) return;
    const target = sampleOther(spectateId, performance.now());
    if (!target) return;

    const ease = approach(CAMERA.follow.easeRate, dt);
    const cornerX = target.x - YAW_SIN * CAMERA.follow.distance;
    const cornerZ = target.z - YAW_COS * CAMERA.follow.distance;
    state.camera.position.x += (cornerX - state.camera.position.x) * ease;
    state.camera.position.y += (CAMERA.follow.height - state.camera.position.y) * ease;
    state.camera.position.z += (cornerZ - state.camera.position.z) * ease;
    state.camera.lookAt(target.x, CAMERA.follow.lookHeight, target.z);
  });
}
