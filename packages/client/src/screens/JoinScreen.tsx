import { useMemo, useState } from "react";
import { ROOM_CODE_LENGTH, randomRoomCode } from "@hammer/shared";
import { connect } from "../net/session";

/** ?room=CODE prefills the code (from a scanned QR); ?host = big-screen Host mode. */
function readUrl() {
  const q = new URLSearchParams(location.search);
  return {
    code: (q.get("room") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH),
    host: q.has("host"),
  };
}

export function JoinScreen() {
  const url = useMemo(readUrl, []);
  const knewCode = url.code.length === ROOM_CODE_LENGTH;

  const [name, setName] = useState("");
  const [code, setCode] = useState(url.code);
  const [editCode, setEditCode] = useState(!knewCode); // show the code field only when needed
  const [err, setErr] = useState("");

  const joinAsPlayer = () => {
    const n = name.trim();
    if (!n) return setErr("ตั้งชื่อตัวละครก่อนนะ");
    if (code.length !== ROOM_CODE_LENGTH) return setErr(`โค้ดห้องต้องมี ${ROOM_CODE_LENGTH} ตัว`);
    setErr("");
    void connect({ name: n, code });
  };

  const hostRoom = () => {
    setErr("");
    void connect({ name: "HOST", asHost: true, code: randomRoomCode() });
  };

  return (
    <div className="screen">
      <div className="center-col">
        <div>
          <h1 className="hero-title">HAMMER PARTY</h1>
          <p className="hero-sub">ทุบให้เหลือคนสุดท้าย!</p>
        </div>

        {url.host ? (
          <div className="panel">
            <p className="panel__title">เปิดจอ Host</p>
            <p className="muted" style={{ marginBottom: 16, lineHeight: 1.6 }}>
              สร้างห้องแล้วฉายจอนี้ขึ้นจอใหญ่ ผู้เล่นสแกน QR เข้าร่วมได้ทันที
            </p>
            <button className="btn btn--gold" onClick={hostRoom}>
              ✦ สร้างห้อง
            </button>
          </div>
        ) : (
          <div className="panel">
            <p className="panel__title">ตั้งชื่อแล้วลุยเลย!</p>

            <label className="field">
              <span className="field__label">ชื่อตัวละคร</span>
              <input
                className="input"
                value={name}
                maxLength={16}
                autoFocus
                placeholder="เช่น อัศวินค้อนทอง"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinAsPlayer()}
              />
            </label>

            {knewCode && !editCode ? (
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
                <span className="pill pill--code">⚔ ห้อง {code}</span>
                <button className="link-btn" onClick={() => setEditCode(true)}>
                  เข้าห้องอื่น?
                </button>
              </div>
            ) : (
              <label className="field">
                <span className="field__label">โค้ดห้อง (จากจอ Host)</span>
                <input
                  className="input input--code"
                  value={code}
                  maxLength={ROOM_CODE_LENGTH}
                  placeholder="ABCD"
                  autoCapitalize="characters"
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && joinAsPlayer()}
                />
              </label>
            )}

            {err && <p className="error-text" style={{ marginBottom: 12 }}>{err}</p>}

            <button className="btn btn--gold" onClick={joinAsPlayer}>
              ⚔ เข้าเล่น
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
