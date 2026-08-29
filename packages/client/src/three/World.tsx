import { useEffect, useRef, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { GamePhase, PLAYER_RADIUS, StageTheme } from "@hammer/shared";
import { useGame } from "../store";
import type { MoveVec } from "../runtime/input";
import { CAMERA, SCENE } from "../config/view";
import { WORLD_COLORS, stagePalette } from "../config/theme";
import { Arena } from "./Arena";
import { Pickups } from "./Pickups";
import { PlayerAvatar } from "./PlayerAvatar";
import { useSelfControl } from "./useSelfControl";
import type { SelfTransform } from "./types";

/**
 * The 3D world, for every phase.
 *
 * Who sees what:
 *   - a live player  → drives their own avatar (first person in a match, a fixed
 *                      follow cam in the plaza)
 *   - the Host, the dead, and everyone once a match has ended → a free orbit cam
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

  const meAlive = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.alive ?? true) : true));
  const phase = useGame((s) => s.phase);
  const arenaRadius = useGame((s) => s.arenaRadius);
  const theme = useGame((s) => s.stageTheme);

  const isPlaza = phase === GamePhase.Lobby;
  const sky = stagePalette(isPlaza ? StageTheme.Lobby : theme).sky;

  // players drive their own avatar in the plaza (lobby) and in a live match
  const controlling = !isHost && !!sessionId && meAlive && (phase === GamePhase.Playing || isPlaza);
  const firstPerson = controlling && phase === GamePhase.Playing; // match = eye cam; plaza = 3rd person
  const spectating = isHost || (!!sessionId && !meAlive) || phase === GamePhase.Ended;

  useSelfControl({
    sessionId,
    enabled: controlling,
    firstPerson,
    maxRadius: arenaRadius - PLAYER_RADIUS,
    input,
    self,
  });

  useEffect(() => {
    if (spectating) camera.position.set(...CAMERA.spectator.position);
  }, [spectating, camera]);

  return (
    <>
      <color attach="background" args={[sky]} />
      <ambientLight intensity={0.8} />
      <directionalLight
        position={[10, 18, 8]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <Arena isPlaza={isPlaza} />
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

      {ids.map((id) => (
        <PlayerAvatar
          key={id}
          id={id}
          isMe={id === sessionId}
          hideBody={firstPerson && id === sessionId}
          hideTags={isPlaza}
          self={self}
        />
      ))}

      {spectating && (
        <OrbitControls
          target={[...CAMERA.spectator.target]}
          maxPolarAngle={Math.PI / 2.1}
          enableDamping
        />
      )}
    </>
  );
}
