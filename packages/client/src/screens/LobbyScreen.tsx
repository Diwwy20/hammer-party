import { PLAYER_COLORS, MAX_PLAYERS } from "@hammer/shared";
import { useGame, FALLBACK_COSMETIC, type Cosmetic } from "../store";
import { sendReady, leaveRoom } from "../net/session";
import { CharacterPreview } from "../three/CharacterPreview";
import { Customizer } from "../components/Customizer";

export function LobbyScreen() {
  const players = useGame((s) => s.players);
  const sessionId = useGame((s) => s.sessionId);
  const code = useGame((s) => s.code);
  const hostSessionId = useGame((s) => s.hostSessionId);

  const ids = Object.keys(players);
  const others = ids.filter((id) => id !== sessionId);
  const me = sessionId ? players[sessionId] : undefined;
  const myCos: Cosmetic = me
    ? {
        colorIndex: me.colorIndex,
        hatIndex: me.hatIndex,
        faceIndex: me.faceIndex,
        backIndex: me.backIndex,
      }
    : FALLBACK_COSMETIC;
  const amReady = !!me?.ready;
  const readyCount = ids.filter((id) => players[id].ready).length;

  return (
    <div className="screen">
      <div className="topbar">
        <span className="brand">
          <span className="emoji">🔨</span> HAMMER PARTY
        </span>
        <span className="row gap-2">
          <span className="pill pill--code">{code || "----"}</span>
          <span className="pill">
            ⚔ {ids.length}/{MAX_PLAYERS}
          </span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[10px] px-4 pt-[10px]">
        <p className="status-line text-sm">
          {hostSessionId ? (
            <>
              รอ <span className="glow">Host</span> เริ่มการประลอง · พร้อม {readyCount}/{ids.length}
            </>
          ) : (
            <>รอ Host เข้าห้อง…</>
          )}
        </p>

        <div className="stage min-h-[200px]">
          <div className="stage__canvas">
            <CharacterPreview cosmetic={myCos} />
          </div>
          <span className="stage__hint">ลากเพื่อหมุน</span>
          <div className="stage__plate">
            <span className="chip__dot" style={{ background: PLAYER_COLORS[myCos.colorIndex] }} />
            <span className="name">{me?.name ?? "…"}</span>
          </div>
        </div>

        <Customizer cosmetic={myCos} />

        <div className="roster-strip">
          <span className="roster-strip__count">
            👥 ในห้อง {ids.length}/{MAX_PLAYERS}
          </span>
          <div className="roster-strip__row">
            {others.length === 0 ? (
              <span className="muted">ยังไม่มีผู้เล่นอื่น รอเพื่อนสแกนเข้ามา…</span>
            ) : (
              others.map((id) => {
                const p = players[id];
                return (
                  <span key={id} className={"chip" + (p.ready ? " chip--ready" : "")}>
                    <span
                      className="chip__dot"
                      style={{ background: PLAYER_COLORS[p.colorIndex] ?? PLAYER_COLORS[0] }}
                    >
                      {p.ready ? "✓" : ""}
                    </span>
                    <span className="chip__name">{p.name}</span>
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="actionbar">
        <button
          className={"btn " + (amReady ? "btn--danger" : "btn--jade")}
          onClick={() => sendReady(!amReady)}
        >
          {amReady ? "ยกเลิกความพร้อม" : "✦ พร้อมประลอง!"}
        </button>
        <button className="btn btn--ghost max-w-[200px]" onClick={leaveRoom}>
          ออกจากห้อง
        </button>
      </div>
    </div>
  );
}
