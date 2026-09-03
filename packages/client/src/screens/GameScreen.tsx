import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { GamePhase } from "@hammer/shared";
import {
  Conn,
  FALLBACK_COSMETIC,
  idsFromKey,
  selectMeAlive,
  selectMeHammer,
  selectMe,
  selectPlayerIdsKey,
  useGame,
  type Cosmetic,
} from "../store";
import { NO_MOVEMENT, type MoveVec } from "../runtime/input";
import { CAMERA } from "../config/view";
import { World } from "../three/World";
import { DressingRoom } from "../three/DressingRoom";
import { useMatchSfx } from "../hooks/useMatchSfx";
import { DressingScreen } from "../components/dressing/DressingScreen";
import { HostLobbyOverlay } from "../components/HostLobbyOverlay";
import { AttackButton } from "../components/hud/AttackButton";
import { EventBanner } from "../components/hud/EventBanner";
import { HostEventBar } from "../components/hud/HostEventBar";
import { HostSpectateBar } from "../components/hud/HostSpectateBar";
import { HudTop } from "../components/hud/HudTop";
import { Joystick } from "../components/hud/Joystick";
import { KeyboardControls } from "../components/hud/KeyboardControls";
import { LobbyDock } from "../components/hud/LobbyDock";
import { MatchHud } from "../components/hud/MatchHud";
import { PrankBar } from "../components/hud/PrankBar";
import { ResultsOverlay } from "../components/hud/ResultsOverlay";
import { ZoneWarning } from "../components/hud/ZoneWarning";

/**
 * The one live 3D canvas — it drives EVERY phase (waiting-room plaza · match ·
 * results) for both players and the Host, plus the dressing room.
 *
 * This screen is composition only: it decides what is in the canvas right now and
 * which overlays belong on top of it. The world itself lives in `three/`, each
 * overlay owns its own state, and the controls write into one shared `input` ref
 * that the prediction loop reads.
 *
 * The wardrobe REPLACES the world rather than sitting over it. One canvas, one WebGL
 * context, one render loop: while you are choosing a hat the entire arena is
 * unmounted, which makes the dressing room the cheapest screen in the game instead
 * of the most expensive one — and it is why the room can afford to be a room.
 *
 * The HUD is laid out in three bands and nothing ever lands in two of them at once:
 * the top strip (`HudTop`) says where you are, the middle band above the thumbs
 * carries the one thing to DO right now (the lobby dock, or your vitals in a match),
 * and the bottom corners belong to the stick and the hammer.
 */
export function GameScreen() {
  const sessionId = useGame((s) => s.sessionId);
  const isHost = useGame((s) => s.isHost);
  const phase = useGame((s) => s.phase);
  const conn = useGame((s) => s.conn);
  const meAlive = useGame(selectMeAlive);
  const myHammer = useGame(selectMeHammer);
  const playerIds = idsFromKey(useGame(selectPlayerIdsKey));
  const cosmetic = useMyCosmetic();

  const input = useRef<MoveVec>({ ...NO_MOVEMENT });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  /** the hammer shown in the mirror — a look, never a loadout (see `Wardrobe`). */
  const [previewHammer, setPreviewHammer] = useState("");

  useMatchSfx();

  const isPlaying = phase === GamePhase.Playing;
  const isPlaza = phase === GamePhase.Lobby;
  const isPlayer = !isHost;
  /** dead players keep walking — as ghosts — so they keep their stick, just not the hammer */
  const isGhost = isPlayer && !meAlive && isPlaying;
  const canMove = isPlayer && (isPlaza || isPlaying);
  const canSwing = canMove && meAlive;
  /** the wardrobe takes the whole screen over, canvas included */
  const dressing = customizeOpen && isPlaza && isPlayer;

  return (
    <div className="fixed inset-0">
      <Canvas shadows camera={{ position: [...CAMERA.initial.position], fov: CAMERA.initial.fov }}>
        {dressing ? (
          <DressingRoom cosmetic={cosmetic} hammer={previewHammer || myHammer} />
        ) : (
          <World ids={playerIds} sessionId={sessionId} isHost={isHost} input={input} />
        )}
      </Canvas>

      {dressing ? (
        <DressingScreen
          cosmetic={cosmetic}
          previewHammer={previewHammer || myHammer}
          onPreviewHammer={setPreviewHammer}
          onDone={() => setCustomizeOpen(false)}
        />
      ) : (
        <>
          <ZoneWarning />

          {/* the Host's lobby overlay carries its own header, so it doesn't get a strip */}
          {!(isPlaza && isHost) && <HudTop />}

          {canMove && (
            <>
              <Joystick input={input} />
              <KeyboardControls input={input} sessionId={sessionId} enableAttack={canSwing} />
            </>
          )}
          {canSwing && <AttackButton sessionId={sessionId} />}

          {/* Waiting-room plaza: the player's dock into the wardrobe and the ready button */}
          {isPlaza && isPlayer && <LobbyDock onCustomize={() => setCustomizeOpen(true)} />}

          {/* Waiting-room plaza: Host big-screen overlay (QR + code + stage + start) */}
          {isPlaza && isHost && <HostLobbyOverlay />}

          {isHost && isPlaying && (
            <>
              <HostSpectateBar />
              <HostEventBar />
            </>
          )}
          {isGhost && <PrankBar />}

          <MatchHud />
          <EventBanner />

          {conn === Conn.Reconnecting && (
            <div className="fixed inset-x-0 top-16 z-30 flex justify-center">
              <div className="glass glass--hot">กำลังเชื่อมต่อใหม่…</div>
            </div>
          )}

          {phase === GamePhase.Ended && <ResultsOverlay />}
        </>
      )}
    </div>
  );
}

/**
 * This client's own outfit, read slot by slot as PRIMITIVES.
 *
 * One selector returning the whole object would hand zustand a new identity on every
 * 20Hz position patch and re-render the entire screen twenty times a second; five
 * numbers do not.
 */
function useMyCosmetic(): Cosmetic {
  return {
    colorIndex: useGame((s) => selectMe(s)?.colorIndex ?? FALLBACK_COSMETIC.colorIndex),
    hairIndex: useGame((s) => selectMe(s)?.hairIndex ?? FALLBACK_COSMETIC.hairIndex),
    hatIndex: useGame((s) => selectMe(s)?.hatIndex ?? FALLBACK_COSMETIC.hatIndex),
    faceIndex: useGame((s) => selectMe(s)?.faceIndex ?? FALLBACK_COSMETIC.faceIndex),
    backIndex: useGame((s) => selectMe(s)?.backIndex ?? FALLBACK_COSMETIC.backIndex),
  };
}
