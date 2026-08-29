import { useMemo, useState } from "react";
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH, randomRoomCode } from "@hammer/shared";
import { connect } from "../net/session";
import { HOST_DISPLAY_NAME, JOIN_PARAM, normaliseRoomCode } from "../net/config";
import { NAME_SUGGESTIONS } from "../config/copy";
import { GameCover } from "../components/GameCover";

/**
 * The front door. Two ways in:
 *   - a player scans the QR (`?room=CODE`) and only has to pick a name
 *   - the big screen opens `?host` and creates a room
 *
 * A player arriving from a QR sees the cover art and ONE thing to do: type a name
 * and hit play. The room code they scanned is shown as a chip rather than a field,
 * because they never had to type it.
 */

const COPY = {
  missingName: "ตั้งชื่อตัวละครก่อนนะ",
  badCode: `โค้ดห้องต้องมี ${ROOM_CODE_LENGTH} ตัว`,
  nameLabel: "ตั้งชื่อตัวละคร",
  namePlaceholder: "พิมพ์ชื่อของคุณ",
  randomName: "🎲 สุ่มชื่อ",
  play: "⚔ เข้าเล่นเลย!",
  tagline: "ทุบให้เหลือคนสุดท้าย!",
  otherRoom: "เข้าห้องอื่น?",
  codeLabel: "โค้ดห้อง (จากจอ Host)",
  hostTitle: "เปิดจอ Host",
  hostLead: "สร้างห้องแล้วฉายจอนี้ขึ้นจอใหญ่ ผู้เล่นสแกน QR เข้าร่วมได้ทันที",
  hostAction: "✦ สร้างห้อง",
} as const;

/** `?room=CODE` prefills the code (from a scanned QR); `?host` = big-screen Host mode. */
function readJoinLink() {
  const query = new URLSearchParams(location.search);
  return {
    code: normaliseRoomCode(query.get(JOIN_PARAM.Room) ?? ""),
    isHost: query.has(JOIN_PARAM.Host),
  };
}

/** A suggestion that isn't the one already in the box. */
function suggestName(current: string): string {
  const options = NAME_SUGGESTIONS.filter((name) => name !== current);
  return options[Math.floor(Math.random() * options.length)];
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
        <div className="cover-block">
          <GameCover />
          <h1 className="hero-title">HAMMER PARTY</h1>
          <p className="hero-sub">{COPY.tagline}</p>
        </div>

        {link.isHost ? (
          <div className="panel">
            <p className="panel__title">{COPY.hostTitle}</p>
            <p className="muted mb-4 leading-relaxed">{COPY.hostLead}</p>
            <button className="btn btn--gold" onClick={hostRoom}>
              {COPY.hostAction}
            </button>
          </div>
        ) : (
          <div className="panel">
            <label className="field">
              <span className="field__label">{COPY.nameLabel}</span>
              <div className="name-row">
                <input
                  className="input"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  autoFocus
                  placeholder={COPY.namePlaceholder}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinAsPlayer()}
                />
                <button
                  type="button"
                  className="pill pill--action name-row__dice"
                  onClick={() => setName(suggestName(name))}
                >
                  {COPY.randomName}
                </button>
              </div>
            </label>

            {arrivedWithCode && !editingCode ? (
              <div className="row mb-[14px] justify-between">
                <span className="pill pill--code">⚔ ห้อง {code}</span>
                <button className="link-btn" onClick={() => setEditingCode(true)}>
                  {COPY.otherRoom}
                </button>
              </div>
            ) : (
              <label className="field">
                <span className="field__label">{COPY.codeLabel}</span>
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
              {COPY.play}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
