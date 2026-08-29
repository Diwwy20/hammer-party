import { useMemo, useState } from "react";
import { AWARD_NO_VALUE, PLAYER_COLORS, type MatchAward, type MatchStanding } from "@hammer/shared";
import { useGame } from "../../store";
import { leaveRoom, sendRestart } from "../../net/session";
import { AWARD_COPY } from "../../config/copy";
import { parseJson } from "../../lib/json";

/**
 * Final standings + funny awards, shown when a match ends.
 *
 * Closeable, but dismissing is LOCAL only — nothing is persisted and the Host
 * simply leaves it up on the big screen for the room to read.
 */
export function ResultsOverlay() {
  const [dismissed, setDismissed] = useState(false);
  const winnerId = useGame((s) => s.winnerId);
  const sessionId = useGame((s) => s.sessionId);
  const isHost = useGame((s) => s.isHost);
  const winnerName = useGame((s) => (s.winnerId ? (s.players[s.winnerId]?.name ?? "") : ""));
  const awardsJson = useGame((s) => s.awardsJson);
  const standingsJson = useGame((s) => s.standingsJson);
  const awards = useMemo(() => parseJson<MatchAward[]>(awardsJson, []), [awardsJson]);
  const standings = useMemo(() => parseJson<MatchStanding[]>(standingsJson, []), [standingsJson]);
  const iWon = !!sessionId && winnerId === sessionId;

  if (dismissed) {
    return (
      <button
        className="pill fixed bottom-6 left-1/2 z-30 -translate-x-1/2"
        onClick={() => setDismissed(false)}
      >
        📊 ดูสรุปผล
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-ink/45 px-5 py-8 backdrop-blur-sm">
      <div className="panel max-w-[560px] text-center">
        <div className="mb-1 text-[54px]">🏆</div>
        <h2 className="mb-1 font-display text-2xl font-extrabold text-ink">
          {winnerName ? `${winnerName} ชนะ!` : "จบเกม"}
        </h2>
        <p className="muted mb-4">
          {isHost
            ? "อันดับการประลองรอบนี้"
            : iWon
              ? "คุณคือคนสุดท้ายที่รอด! 🎉"
              : "รอบนี้คุณตกรอบ — ไว้เจอกันรอบหน้า"}
        </p>

        {standings.length > 0 && <StandingsList standings={standings} />}
        {awards.length > 0 && <AwardGrid awards={awards} />}

        {isHost && (
          <button className="btn btn--jade" onClick={sendRestart}>
            เริ่มรอบใหม่
          </button>
        )}
        <button className="btn btn--ghost mt-2" onClick={() => setDismissed(true)}>
          ปิดหน้าต่าง
        </button>
        <button className="link-btn mt-3" onClick={leaveRoom}>
          ออกจากห้อง
        </button>
      </div>
    </div>
  );
}

/** The champion's row gets the crown + gold treatment. */
const FIRST_PLACE = 1;

/** Winner first, then everyone else by how long they lasted. */
function StandingsList({ standings }: { standings: MatchStanding[] }) {
  return (
    <ol className="mb-4 flex flex-col gap-1 text-left">
      {standings.map((row) => (
        <li
          key={row.place}
          className={
            "flex items-center gap-3 rounded-field border-2 px-3 py-2 " +
            (row.place === FIRST_PLACE ? "border-yellow bg-[#fff7e0]" : "border-line bg-surface-2")
          }
        >
          <span className="w-7 flex-none text-center font-display text-lg font-extrabold text-blue-d">
            {row.place === FIRST_PLACE ? "👑" : row.place}
          </span>
          <span
            className="chip__dot flex-none"
            style={{ background: PLAYER_COLORS[row.colorIndex] ?? PLAYER_COLORS[0] }}
          />
          <span className="chip__name flex-1 font-display font-bold text-ink">{row.name}</span>
          <span className="text-[12px] font-semibold whitespace-nowrap text-ink-soft">
            ⚔ {row.kills} · 💥 {row.dmg}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The funny awards. The server sends kind + winner + a number; the copy is ours. */
function AwardGrid({ awards }: { awards: MatchAward[] }) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {awards.map((award) => {
        const copy = AWARD_COPY[award.kind];
        if (!copy) return null;
        const detail = award.value === AWARD_NO_VALUE ? "" : (copy.detail?.(award.value) ?? "");
        return (
          <div
            key={award.kind}
            className="flex items-center gap-3 rounded-field border-2 border-line bg-surface-2 px-3 py-2 text-left"
          >
            <span className="text-2xl">{copy.icon}</span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-ink-soft">{copy.label}</div>
              <div className="truncate font-display font-bold text-ink">{award.name}</div>
              {detail && <div className="text-[11px] text-ink-faint">{detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
