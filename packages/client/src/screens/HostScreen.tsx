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
        <span className="pill">⚔ {ids.length}/{MAX_PLAYERS} · พร้อม {readyCount}</span>
      </div>

      <div className="screen__scroll">
        <div className="row" style={{ alignItems: "stretch", gap: 22, width: "100%", maxWidth: 980 }}>
          {/* invite */}
          <div className="panel" style={{ flex: "1 1 300px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <p className="panel__title" style={{ justifyContent: "center" }}>สแกนเพื่อเข้าร่วม</p>
            <div className="qr-card" style={{ width: "fit-content", margin: "4px auto 16px" }}>
              <QRCodeSVG value={joinUrl} size={210} level="M" bgColor="transparent" fgColor="#1a1206" />
            </div>
            <div className="code-big">{code || "----"}</div>
            <p className="muted" style={{ marginTop: 10 }}>{joinUrl}</p>
          </div>

          {/* roster */}
          <div className="panel" style={{ flex: "2 1 400px" }}>
            <p className="panel__title">
              <span>ผู้ท้าชิง</span>
              <span className="muted">{ids.length}/{MAX_PLAYERS}</span>
            </p>
            {ids.length === 0 ? (
              <p className="muted" style={{ padding: "24px 0", textAlign: "center" }}>
                ยังไม่มีผู้ท้าชิง — ให้ทุกคนสแกน QR ทางซ้าย
              </p>
            ) : (
              <div className="grid">
                {ids.map((id) => {
                  const p = players[id];
                  return (
                    <div key={id} className={"card" + (p.ready ? " card--ready" : "")}>
                      <span className="chip__dot" style={{ background: PLAYER_COLORS[p.colorIndex] ?? PLAYER_COLORS[0] }}>
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

        <p className="muted" style={{ textAlign: "center" }}>
          ⚙ เลือด {HP_MAX} · เวลาสูงสุด {MATCH_MAX_MINUTES} นาที
          <span style={{ opacity: 0.6 }}> (ปรับได้ทีหลัง)</span>
        </p>
      </div>

      <div className="actionbar">
        <button className="btn btn--gold" disabled={!canStart} onClick={sendStart} style={{ maxWidth: 520 }}>
          {ids.length < MIN_PLAYERS_TO_START
            ? `รอผู้ท้าชิง (อย่างน้อย ${MIN_PLAYERS_TO_START})`
            : "✦ เริ่มการประลอง"}
        </button>
        <button className="btn btn--ghost" style={{ maxWidth: 200 }} onClick={leaveRoom}>
          ปิดห้อง
        </button>
      </div>
    </div>
  );
}
