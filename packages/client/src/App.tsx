import { useEffect, useState } from "react";
import { clamp } from "@hammer/shared";
import { Conn, useGame } from "./store";
import { leaveRoom } from "./net/session";
import { CONNECT_ERROR, SPLASH_TIPS } from "./config/copy";
import { SPLASH } from "./config/view";
import { GameCover } from "./components/GameCover";
import { JoinScreen } from "./screens/JoinScreen";
import { GameScreen } from "./screens/GameScreen";

/**
 * Screen routing. Everything is driven by the connection lifecycle (`conn`) plus the
 * one-shot `booted` flag — the GAME phase (lobby/playing/ended) is handled inside
 * `GameScreen`, which is a single live 3D world for all of them.
 */
export function App() {
  const conn = useGame((s) => s.conn);
  const booted = useGame((s) => s.booted);

  if (conn === Conn.Idle) return <JoinScreen />;
  if (conn === Conn.Error) return <ErrorScreen />;
  if (conn === Conn.Connecting || !booted) return <SplashScreen />;

  // connected and booted — one live 3D world drives every phase, for players and Host
  return <GameScreen />;
}

/** Branded entry splash: eases a progress bar up, finishes when the room is open. */
function SplashScreen() {
  const conn = useGame((s) => s.conn);
  const [pct, setPct] = useState<number>(SPLASH.startPct);
  const [tip] = useState(() => SPLASH_TIPS[Math.floor(Math.random() * SPLASH_TIPS.length)]);

  // creep toward the target: parked below the end until the room is actually open
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPct((current) => {
        const target = useGame.getState().conn === Conn.Open ? SPLASH.donePct : SPLASH.waitingPct;
        const step = Math.max(SPLASH.minStepPct, (target - current) * SPLASH.easeFactor);
        return Math.min(target, current + step);
      });
    }, SPLASH.tickMs);
    return () => window.clearInterval(timer);
  }, []);

  // let the finished bar be seen for a beat before the world appears
  useEffect(() => {
    if (conn !== Conn.Open) return;
    const timer = window.setTimeout(
      () => useGame.getState().set({ booted: true }),
      SPLASH.handoffMs,
    );
    return () => window.clearTimeout(timer);
  }, [conn]);

  return (
    <div className="screen">
      <div className="center-col">
        <div className="cover-block">
          <GameCover bob />
          <h1 className="hero-title">HAMMER PARTY</h1>
          <p className="hero-sub">ทุบให้เหลือคนสุดท้าย!</p>
        </div>

        <div className="progress">
          <div className="progress__track">
            <div className="progress__bar" style={{ width: `${clamp(pct, 0, 100)}%` }} />
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
          <p className="error-text mb-4">{error ?? CONNECT_ERROR.unknown}</p>
          <button className="btn btn--gold" onClick={leaveRoom}>
            กลับหน้าเข้าห้อง
          </button>
        </div>
      </div>
    </div>
  );
}
