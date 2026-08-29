import { GamePhase, HAMMERS, HP_MAX, type HammerKind } from "@hammer/shared";
import { selectAliveCount, selectMeAlive, selectMeHammer, selectMeHp, useGame } from "../../store";
import { hpColor, hpRatio } from "../../config/theme";

/**
 * The top-left status box during a match and on the results screen: how many are
 * left, plus your own weapon + HP while you're still in it.
 */
export function MatchHud() {
  const isHost = useGame((s) => s.isHost);
  const phase = useGame((s) => s.phase);
  const aliveCount = useGame(selectAliveCount);
  const meAlive = useGame(selectMeAlive);
  const meHp = useGame(selectMeHp);
  const meHammer = useGame(selectMeHammer);

  const isPlaying = phase === GamePhase.Playing;
  const isFighting = !isHost && meAlive && isPlaying;
  const isSpectating = !isHost && !meAlive && isPlaying;
  const ratio = hpRatio(meHp, HP_MAX);
  const hammerLabel = HAMMERS[meHammer as HammerKind]?.label ?? meHammer;

  return (
    <div className="hud">
      <div>
        <b>⚔ กำลังประลอง</b> · {aliveCount} รอด
      </div>

      {isFighting && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[11px] font-bold">🔨 {hammerLabel}</span>
          <div className="h-[9px] w-[120px] overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full"
              style={{
                width: `${ratio * 100}%`,
                background: hpColor(ratio),
                transition: "width 120ms linear",
              }}
            />
          </div>
          <span className="text-[11px] font-bold">{Math.ceil(meHp)}</span>
        </div>
      )}

      {isSpectating && (
        <div className="muted mt-1 text-[11px]">
          ☠️ ตกรอบแล้ว — หมุนดูสนาม + ป่วนคนที่ยังรอดได้!
        </div>
      )}

      {/* "Host" stays in English per the agreed wording — never "เจ้าภาพ". */}
      {isHost && <div className="muted text-[11px]">มุมมอง Host · ลากเพื่อหมุนกล้อง</div>}
    </div>
  );
}
