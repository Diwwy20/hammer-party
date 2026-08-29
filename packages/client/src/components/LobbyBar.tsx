import { MAX_PLAYERS } from "@hammer/shared";
import {
  selectHasHost,
  selectMeReady,
  selectPlayerCount,
  selectReadyCount,
  useGame,
} from "../store";
import { sendReady, leaveRoom } from "../net/session";

/**
 * Player HUD for the waiting-room plaza. Deliberately shows NO other player names —
 * just the room count (they'll meet everyone in the match). Selectors return
 * primitives so the 20Hz position stream doesn't re-render this bar.
 */
export function LobbyBar({ onCustomize }: { onCustomize: () => void }) {
  const code = useGame((s) => s.code);

  const count = useGame(selectPlayerCount);
  const readyCount = useGame(selectReadyCount);
  const hostHere = useGame(selectHasHost);
  const amReady = useGame(selectMeReady);

  return (
    <>
      {/* top bar */}
      <div className="lobby-topbar">
        <span className="brand">
          <span className="emoji">🔨</span> HAMMER PARTY
        </span>
        <span className="row gap-2">
          <span className="pill pill--code">{code || "----"}</span>
          <span className="pill">
            👥 {count}/{MAX_PLAYERS}
          </span>
        </span>
      </div>

      {/* status + waiting-room actions (top-centre, clear of the joystick/attack thumbs) */}
      <div className="lobby-head">
        <p className="lobby-status">
          {hostHere ? (
            <>
              รอ <span className="glow">Host</span> เริ่มการประลอง · พร้อม {readyCount}/{count}
            </>
          ) : (
            <>รอ Host เข้าห้อง…</>
          )}
        </p>
        <p className="lobby-hint">
          แตะจอย + ปุ่ม 🔨 เพื่อเดินและหยอกเพื่อน (ไม่เสียเลือด) · บนคอมใช้ WASD + Space
        </p>
        <div className="lobby-actions">
          <button className="pill pill--action" onClick={onCustomize}>
            👕 แต่งตัว
          </button>
          <button
            className={"pill pill--action " + (amReady ? "pill--ready" : "pill--go")}
            onClick={() => sendReady(!amReady)}
          >
            {amReady ? "✓ พร้อมแล้ว" : "✦ พร้อม!"}
          </button>
          <button className="pill pill--action" onClick={leaveRoom}>
            ออก
          </button>
        </div>
      </div>
    </>
  );
}
