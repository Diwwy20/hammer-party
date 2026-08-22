import { QRCodeSVG } from "qrcode.react";
import {
  HP_MAX,
  MATCH_MAX_MINUTES,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
} from "@hammer/shared";
import { useGame } from "../store";
import { sendStart, leaveRoom } from "../net/session";

export function HostScreen() {
  const players = useGame((s) => s.players);
  const code = useGame((s) => s.code);
  const phase = useGame((s) => s.phase);

  const ids = Object.keys(players);
  const readyCount = ids.filter((id) => players[id].ready).length;
  const joinUrl = `${location.origin}/?room=${code}`;
  const canStart = phase === "lobby" && ids.length >= MIN_PLAYERS_TO_START;

  return (
    <div className="screen">
      <div className="topbar">
        <span className="brand">
          <span className="emoji">🔨</span> HAMMER PARTY <small>· จอ Host</small>
        </span>
        <span className="pill">
          ⚔ {ids.length}/{MAX_PLAYERS} · พร้อม {readyCount}
        </span>
      </div>

      <div className="screen__scroll">
        <div className="row w-full max-w-[980px] items-stretch gap-[22px]">
          {/* invite */}
          <div className="panel flex flex-[1_1_300px] flex-col items-center text-center">
            <p className="panel__title justify-center">สแกนเพื่อเข้าร่วม</p>
            <div className="qr-card mx-auto mt-1 mb-4 w-fit">
              <QRCodeSVG
                value={joinUrl}
                size={210}
                level="M"
                bgColor="transparent"
                fgColor="#1a1206"
              />
            </div>
            <div className="code-big">{code || "----"}</div>
            <p className="muted mt-[10px]">{joinUrl}</p>
          </div>

          {/* roster */}
          <div className="panel flex-[2_1_400px]">
            <p className="panel__title">
              <span>ผู้ท้าชิง</span>
              <span className="muted">
                {ids.length}/{MAX_PLAYERS}
              </span>
            </p>
            {ids.length === 0 ? (
              <p className="muted py-6 text-center">ยังไม่มีผู้ท้าชิง — ให้ทุกคนสแกน QR ทางซ้าย</p>
            ) : (
              <div className="grid-cards">
                {ids.map((id) => {
                  const p = players[id];
                  return (
                    <div key={id} className={"card" + (p.ready ? " card--ready" : "")}>
                      <span
                        className="chip__dot"
                        style={{ background: PLAYER_COLORS[p.colorIndex] ?? PLAYER_COLORS[0] }}
                      >
                        {p.ready ? "✓" : ""}
                      </span>
                      <span className="chip__name">{p.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <p className="muted text-center">
          ⚙ เลือด {HP_MAX} · เวลาสูงสุด {MATCH_MAX_MINUTES} นาที
          <span className="opacity-60"> (ปรับได้ทีหลัง)</span>
        </p>
      </div>

      <div className="actionbar">
        <button className="btn btn--gold max-w-[520px]" disabled={!canStart} onClick={sendStart}>
          {ids.length < MIN_PLAYERS_TO_START
            ? `รอผู้ท้าชิง (อย่างน้อย ${MIN_PLAYERS_TO_START})`
            : "✦ เริ่มการประลอง"}
        </button>
        <button className="btn btn--ghost max-w-[200px]" onClick={leaveRoom}>
          ปิดห้อง
        </button>
      </div>
    </div>
  );
}
