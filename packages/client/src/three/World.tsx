import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import {
  GamePhase,
  PLAYER_RADIUS,
  StageTheme,
  WeatherKind,
  approach,
  lerpAngle,
} from "@hammer/shared";
import { selectIsGhost, selectStage, useGame } from "../store";
import type { MoveVec } from "../runtime/input";
import { sampleOther } from "../net/movement";
import { CAMERA, SCENE } from "../config/view";
import { WORLD_COLORS, stagePalette } from "../config/theme";
import { Arena } from "./Arena";
import { Hazards } from "./Hazards";
import { Pickups } from "./Pickups";
import { PlayerAvatar } from "./PlayerAvatar";
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
  const sky = raining ? palette.skyRain : palette.sky;

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
      <color attach="background" args={[sky]} />
      <ambientLight intensity={raining ? 0.62 : 0.8} />
      <directionalLight
        position={[10, 18, 8]}
        intensity={raining ? 0.7 : 1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <Arena isPlaza={isPlaza} raining={raining} />
      <Grid
        args={[arenaRadius * 2, arenaRadius * 2]}
        cellSize={SCENE.grid.cellSize}
        cellColor={WORLD_COLORS.gridCell}
        sectionSize={SCENE.grid.sectionSize}
        sectionColor={WORLD_COLORS.gridSection}
        fadeDistance={SCENE.grid.fadeDistance}
        position={[0, 0.012, 0]}
      />

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

/** Stages have cover; the plaza doesn't, and ghosts ignore it. Shared so it's stable. */
const EMPTY_OBSTACLES = Object.freeze([]) as never[];

/**
 * The Host's "watch this player" camera.
 *
 * Unlike a player's own cam this one DOES swing round with the player it follows —
 * the big screen wants to see the fight from inside it. Position is read straight
 * out of the interpolation buffer, so it tracks the same smoothed motion the avatar
 * is drawn at instead of jittering on every 20Hz patch.
 */
function useSpectatorCamera(spectateId: string): void {
  const yaw = useRef(0);

  useFrame((state, dt) => {
    if (!spectateId) return;
    const target = sampleOther(spectateId, performance.now());
    if (!target) return;

    yaw.current = lerpAngle(yaw.current, target.dir, approach(CAMERA.follow.turnRate, dt));
    const behindX = target.x - Math.sin(yaw.current) * CAMERA.follow.distance;
    const behindZ = target.z - Math.cos(yaw.current) * CAMERA.follow.distance;

    const ease = approach(CAMERA.follow.easeRate, dt);
    state.camera.position.x += (behindX - state.camera.position.x) * ease;
    state.camera.position.y += (CAMERA.follow.height - state.camera.position.y) * ease;
    state.camera.position.z += (behindZ - state.camera.position.z) * ease;
    state.camera.lookAt(target.x, CAMERA.follow.lookHeight, target.z);
  });
}
