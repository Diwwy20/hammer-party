import { useEffect, useState } from "react";
import { GamePhase } from "@hammer/shared";
import { useGame } from "../../store";
import { localPlayer } from "../../runtime/localPlayer";
import { HUD } from "../../config/view";

/**
 * Red vignette + shout while you're standing outside the safe zone.
 *
 * Your distance from the centre changes every frame, so it's polled off the game
 * loop's scratch value on a timer instead of living in the store — a per-frame
 * React re-render of the whole HUD would be far more expensive than this.
 */
export function ZoneWarning() {
  const outside = useOutOfZone();
  if (!outside) return null;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-10"
        style={{ boxShadow: "inset 0 0 120px 40px rgba(225,75,61,0.55)" }}
      />
      <div className="fixed inset-x-0 top-24 z-10 flex justify-center">
        <div className="rounded-full bg-coral px-4 py-1.5 text-sm font-bold text-white shadow">
          ⚠ ออกนอกเขตปลอดภัย — รีบกลับเข้าวง!
        </div>
      </div>
    </>
  );
}

function useOutOfZone(): boolean {
  const [outside, setOutside] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = useGame.getState();
      const alive = state.sessionId ? (state.players[state.sessionId]?.alive ?? true) : true;
      const inMatch = !state.isHost && alive && state.phase === GamePhase.Playing;
      setOutside(inMatch && localPlayer.distanceFromCentre > state.zoneRadius + HUD.zoneMarginM);
    }, HUD.zonePollMs);
    return () => window.clearInterval(timer);
  }, []);

  return outside;
}
