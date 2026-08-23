import { useEffect, useState } from "react";
import { useGame } from "./store";
import { leaveRoom } from "./net/session";
import { JoinScreen } from "./screens/JoinScreen";
import { GameScreen } from "./screens/GameScreen";

const TIPS = [
  "ค้อนแรงเหวี่ยงไกล แต่ตีช้า — จังหวะคือทุกอย่าง",
  "โดนผลักไปชนกำแพงหนาม = เจ็บกว่าเดิม ระวังขอบสนาม",
  "เก็บค้อนในแมพเพื่อเปลี่ยนสไตล์การเล่น",
  "ตายแล้วยังป่วนต่อได้ — ปาของใส่คนที่ยังรอด",
];

/** Branded entry splash: eases a progress bar up, finishes when the room is open. */
function SplashScreen() {
  const conn = useGame((s) => s.conn);
  const [pct, setPct] = useState(6);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => {
        const target = useGame.getState().conn === "open" ? 100 : 90;
        return Math.min(target, p + Math.max(0.6, (target - p) * 0.09));
      });
    }, 55);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (conn !== "open") return;
    const t = setTimeout(() => useGame.getState().set({ booted: true }), 650);
    return () => clearTimeout(t);
  }, [conn]);

  return (
    <div className="screen">
      <div className="center-col">
        <div className="splash__mark">🔨</div>
        <div>
          <h1 className="hero-title">HAMMER PARTY</h1>
          <p className="hero-sub">ทุบให้เหลือคนสุดท้าย!</p>
        </div>

        <div className="progress">
          <div className="progress__track">
            <div className="progress__bar" style={{ width: `${pct}%` }} />
          </div>
          <span className="progress__pct">{Math.round(pct)}%</span>
        </div>

        <p className="tip">
          <span className="tip__k">เกร็ด</span> {tip}
        </p>
      </div>
    </div>
  );
}

function ErrorScreen() {
  const error = useGame((s) => s.error);
  return (
    <div className="screen">
      <div className="center-col">
        <div className="panel text-center">
          <p className="error-text mb-4">{error ?? "เกิดข้อผิดพลาด"}</p>
          <button className="btn btn--gold" onClick={leaveRoom}>
            กลับหน้าเข้าห้อง
          </button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const conn = useGame((s) => s.conn);
  const booted = useGame((s) => s.booted);

  if (conn === "idle") return <JoinScreen />;
  if (conn === "error") return <ErrorScreen />;
  if (conn === "connecting" || !booted) return <SplashScreen />;

  // conn === "open" && booted — one live 3D world drives every phase
  // (lobby plaza · match · results), for both players and the Host.
  return <GameScreen />;
}
