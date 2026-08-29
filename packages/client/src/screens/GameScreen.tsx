import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { GamePhase } from "@hammer/shared";
import { Conn, idsFromKey, selectMeAlive, selectPlayerIdsKey, useGame } from "../store";
import { leaveRoom } from "../net/session";
import { NO_MOVEMENT, type MoveVec } from "../runtime/input";
import { CAMERA } from "../config/view";
import { World } from "../three/World";
import { useMatchSfx } from "../hooks/useMatchSfx";
import { LobbyBar } from "../components/LobbyBar";
import { CustomizeSheet } from "../components/CustomizeSheet";
import { HostLobbyOverlay } from "../components/HostLobbyOverlay";
import { AttackButton } from "../components/hud/AttackButton";
import { EventBanner } from "../components/hud/EventBanner";
import { HostEventBar } from "../components/hud/HostEventBar";
import { Joystick } from "../components/hud/Joystick";
import { KeyboardControls } from "../components/hud/KeyboardControls";
import { MatchHud } from "../components/hud/MatchHud";
import { PrankBar } from "../components/hud/PrankBar";
import { ResultsOverlay } from "../components/hud/ResultsOverlay";
import { ZoneWarning } from "../components/hud/ZoneWarning";

/**
 * The one live 3D world — it drives EVERY phase (waiting-room plaza · match ·
 * results) for both players and the Host.
 *
 * This screen is composition only: it decides which overlays belong on screen right
 * now. The world itself lives in `three/`, each overlay owns its own state, and the
 * controls write into one shared `input` ref that the prediction loop reads.
 */
export function GameScreen() {
  const sessionId = useGame((s) => s.sessionId);
  const isHost = useGame((s) => s.isHost);
  const phase = useGame((s) => s.phase);
  const conn = useGame((s) => s.conn);
  const meAlive = useGame(selectMeAlive);
  const playerIds = idsFromKey(useGame(selectPlayerIdsKey));

  const input = useRef<MoveVec>({ ...NO_MOVEMENT });
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useMatchSfx();

  const isPlaying = phase === GamePhase.Playing;
  const isPlaza = phase === GamePhase.Lobby;
  const isPlayer = !isHost;
  /** you can walk + bonk in the plaza too, not just in a match */
  const canControl = isPlayer && meAlive && (isPlaying || isPlaza);

  return (
    <div className="fixed inset-0">
      <Canvas shadows camera={{ position: [...CAMERA.initial.position], fov: CAMERA.initial.fov }}>
        <World ids={playerIds} sessionId={sessionId} isHost={isHost} input={input} />
      </Canvas>

      <ZoneWarning />

      {canControl && (
        <>
          <Joystick input={input} />
          <AttackButton sessionId={sessionId} />
          <KeyboardControls input={input} sessionId={sessionId} />
        </>
      )}

      {/* Waiting-room plaza: player HUD + dress-up sheet */}
      {isPlaza && isPlayer && (
        <>
          <LobbyBar onCustomize={() => setCustomizeOpen(true)} />
          <CustomizeSheet open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
        </>
      )}

      {/* Waiting-room plaza: Host big-screen overlay (QR + code + stage + start) */}
      {isPlaza && isHost && <HostLobbyOverlay />}

      {isHost && isPlaying && <HostEventBar />}
      {isPlayer && !meAlive && isPlaying && <PrankBar />}

      {!isPlaza && <MatchHud />}
      <EventBanner />

      {conn === Conn.Reconnecting && (
        <div className="fixed inset-x-0 top-16 z-30 flex justify-center">
          <div className="pill">กำลังเชื่อมต่อใหม่…</div>
        </div>
      )}

      {/* the plaza overlays carry their own leave buttons */}
      {!isPlaza && (
        <button
          className="btn btn--ghost fixed top-3 right-4 z-30 w-auto px-4 py-2 text-sm"
          onClick={leaveRoom}
        >
          ออก
        </button>
      )}

      {phase === GamePhase.Ended && <ResultsOverlay />}
    </div>
  );
}
