import { GamePhase, MAX_PLAYERS } from "@hammer/shared";
import { selectAliveCount, selectMeAlive, selectPlayerCount, useGame } from "../../store";
import { leaveRoom } from "../../net/session";
import { GHOST_COPY, SPECTATE_COPY } from "../../config/copy";

/**
 * The one top strip, in every phase: the mark on the left, where you are on the
 * right, and the way out.
 *
 * It replaces the old per-screen top bars and the floating leave button. Which
 * facts show up is the only thing that changes between the lobby (the room code, so
 * a friend can join) and a match (how many are left, which is the only number that
 * matters once it starts).
 */
export function HudTop() {
  const isHost = useGame((s) => s.isHost);
  const phase = useGame((s) => s.phase);
  const code = useGame((s) => s.code);
  const count = useGame(selectPlayerCount);
  const aliveCount = useGame(selectAliveCount);
  const meAlive = useGame(selectMeAlive);
  const watchingName = useGame((s) => (s.spectateId ? (s.players[s.spectateId]?.name ?? "") : ""));

  const isPlaza = phase === GamePhase.Lobby;
  const isGhost = !isHost && !meAlive && phase === GamePhase.Playing;

  return (
    <div className="hud-top">
      <div>
        {/* on a phone the mark is just the hammer — the room facts need the width */}
        <span className="glass hud-mark">
          <span>🔨</span>
          <span className="hidden sm:inline">HAMMER PARTY</span>
        </span>
      </div>

      <div>
        {isPlaza ? (
          <>
            <span className="glass glass--code">{code || "----"}</span>
            <span className="glass">
              👥 {count}/{MAX_PLAYERS}
            </span>
          </>
        ) : (
          <span className="glass">⚔ {aliveCount} รอด</span>
        )}

        {isGhost && <span className="glass glass--hot">{GHOST_COPY.title}</span>}
        {/* "Host" stays in English per the agreed wording — never "เจ้าภาพ". */}
        {isHost && (
          <span className="glass">
            {watchingName ? `🎥 ${SPECTATE_COPY.label} ${watchingName}` : "🎥 Host"}
          </span>
        )}

        <button className="icon-btn" onClick={leaveRoom} aria-label="ออกจากห้อง">
          ✕
        </button>
      </div>
    </div>
  );
}
