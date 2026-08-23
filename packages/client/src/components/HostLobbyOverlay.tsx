import { QRCodeSVG } from "qrcode.react";
import { MAX_PLAYERS, MIN_PLAYERS_TO_START, STAGES, STAGE_ORDER } from "@hammer/shared";
import { useGame } from "../store";
import { sendStart, sendStage, leaveRoom } from "../net/session";

/**
 * Host big-screen overlay for the waiting-room plaza. The 3D plaza (everyone's
 * avatars gathering) shows behind; this pinned panel carries the join QR, room
 * code, count, the stage picker and Start. No name roster — the plaza avatars ARE
 * the roster. Primitive selectors keep the 20Hz stream from re-rendering it.
 */
export function HostLobbyOverlay() {
  const code = useGame((s) => s.code);
  const count = useGame((s) => Object.keys(s.players).length);
  const readyCount = useGame((s) => Object.values(s.players).filter((p) => p.ready).length);
  const stageId = useGame((s) => s.stageId);

  const joinUrl = `${location.origin}/?room=${code}`;
  const canStart = count >= MIN_PLAYERS_TO_START;

  return (
    <div className="host-overlay">
      <span className="brand">
        <span className="emoji">🔨</span> HAMMER PARTY <small>· จอ Host</small>
      </span>

      <p className="host-overlay__lead">สแกนเพื่อเข้าร่วม</p>
      <div className="qr-card mx-auto w-fit">
        <QRCodeSVG value={joinUrl} size={168} level="M" bgColor="transparent" fgColor="#1a1206" />
      </div>
      <div className="code-big text-center">{code || "----"}</div>

      <div className="row justify-center gap-2">
        <span className="pill">
          👥 {count}/{MAX_PLAYERS}
        </span>
        <span className="pill">✦ พร้อม {readyCount}</span>
      </div>

      <div>
        <p className="mb-1.5 text-center font-display text-[13px] font-bold text-ink">เลือกด่าน</p>
        <div className="row justify-center gap-2">
          {STAGE_ORDER.map((id) => (
            <button
              key={id}
              className={"tab" + (id === stageId ? " tab--active" : "")}
              onClick={() => sendStage(id)}
            >
              {STAGES[id].label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn--gold" disabled={!canStart} onClick={sendStart}>
        {canStart ? "✦ เริ่มการประลอง" : `รอผู้ท้าชิง (อย่างน้อย ${MIN_PLAYERS_TO_START})`}
      </button>
      <button className="link-btn" onClick={leaveRoom}>
        ปิดห้อง
      </button>
    </div>
  );
}
