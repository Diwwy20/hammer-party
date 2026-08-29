import { useMemo, useState } from "react";
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH, randomRoomCode } from "@hammer/shared";
import { connect } from "../net/session";
import { HOST_DISPLAY_NAME, JOIN_PARAM, normaliseRoomCode } from "../net/config";

/**
 * The front door. Two ways in:
 *   - a player scans the QR (`?room=CODE`) and only has to pick a name
 *   - the big screen opens `?host` and creates a room
 */

const COPY = {
  missingName: "ตั้งชื่อตัวละครก่อนนะ",
  badCode: `โค้ดห้องต้องมี ${ROOM_CODE_LENGTH} ตัว`,
} as const;

/** `?room=CODE` prefills the code (from a scanned QR); `?host` = big-screen Host mode. */
function readJoinLink() {
  const query = new URLSearchParams(location.search);
  return {
    code: normaliseRoomCode(query.get(JOIN_PARAM.Room) ?? ""),
    isHost: query.has(JOIN_PARAM.Host),
  };
}

export function JoinScreen() {
  const link = useMemo(readJoinLink, []);
  const arrivedWithCode = link.code.length === ROOM_CODE_LENGTH;

  const [name, setName] = useState("");
  const [code, setCode] = useState(link.code);
  const [editingCode, setEditingCode] = useState(!arrivedWithCode); // show the field only when needed
  const [error, setError] = useState("");

  const joinAsPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError(COPY.missingName);
    if (code.length !== ROOM_CODE_LENGTH) return setError(COPY.badCode);
    setError("");
    void connect({ name: trimmed, code });
  };

  const hostRoom = () => {
    setError("");
    void connect({ name: HOST_DISPLAY_NAME, asHost: true, code: randomRoomCode() });
  };

  return (
    <div className="screen">
      <div className="center-col">
        <div>
          <h1 className="hero-title">HAMMER PARTY</h1>
          <p className="hero-sub">ทุบให้เหลือคนสุดท้าย!</p>
        </div>

        {link.isHost ? (
          <div className="panel">
            <p className="panel__title">เปิดจอ Host</p>
            <p className="muted mb-4 leading-relaxed">
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
                maxLength={MAX_NAME_LENGTH}
                autoFocus
                placeholder="เช่น อัศวินค้อนทอง"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinAsPlayer()}
              />
            </label>

            {arrivedWithCode && !editingCode ? (
              <div className="row mb-[14px] justify-between">
                <span className="pill pill--code">⚔ ห้อง {code}</span>
                <button className="link-btn" onClick={() => setEditingCode(true)}>
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
                  onChange={(e) => setCode(normaliseRoomCode(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && joinAsPlayer()}
                />
              </label>
            )}

            {error && <p className="error-text mb-3">{error}</p>}

            <button className="btn btn--gold" onClick={joinAsPlayer}>
              ⚔ เข้าเล่น
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
