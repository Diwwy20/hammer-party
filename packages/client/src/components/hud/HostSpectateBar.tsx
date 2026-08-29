import { idsFromKey, selectAliveIdsKey, useGame } from "../../store";
import { SPECTATE_COPY } from "../../config/copy";

/**
 * Host-only: pick whose shoulder the big screen is looking over.
 *
 * Only LIVING players are offered. Watching a ghost drift about is not a show, and
 * the whole point of the Host cam is to be on the fight — so the list is exactly the
 * survivors, and it empties itself as they are knocked out.
 *
 * The choice is local to this screen (`spectateId` in the store) and never leaves it:
 * nothing about who the Host is watching is sent to the server or to anyone else.
 */
export function HostSpectateBar() {
  const aliveIds = idsFromKey(useGame(selectAliveIdsKey));
  const spectateId = useGame((s) => s.spectateId);
  const set = useGame((s) => s.set);

  // whoever we were watching may have just been eliminated — fall back to the wide shot
  const watching = aliveIds.includes(spectateId) ? spectateId : "";
  const index = aliveIds.indexOf(watching);

  const step = (delta: number) => {
    if (aliveIds.length === 0) return;
    const next = (index + delta + aliveIds.length) % aliveIds.length;
    set({ spectateId: aliveIds[next] });
  };

  if (aliveIds.length === 0) return null;

  return (
    <div className="spectate-bar">
      <span className="spectate-bar__label">{SPECTATE_COPY.label}</span>

      <button
        className={"pill pill--action" + (watching ? "" : " pill--go")}
        onClick={() => set({ spectateId: "" })}
      >
        {SPECTATE_COPY.free}
      </button>

      <button className="pill pill--action" onClick={() => step(-1)} aria-label="ก่อนหน้า">
        {SPECTATE_COPY.prev}
      </button>

      <div className="spectate-bar__list">
        {aliveIds.map((id) => (
          <SpectateChip
            key={id}
            id={id}
            active={id === watching}
            onPick={() => set({ spectateId: id })}
          />
        ))}
      </div>

      <button className="pill pill--action" onClick={() => step(1)} aria-label="ถัดไป">
        {SPECTATE_COPY.next}
      </button>
    </div>
  );
}

/** One survivor's button. Reads its own row, so the bar isn't re-rendered per patch. */
function SpectateChip({ id, active, onPick }: { id: string; active: boolean; onPick: () => void }) {
  const name = useGame((s) => s.players[id]?.name ?? "");
  const kills = useGame((s) => s.players[id]?.kills ?? 0);

  return (
    <button className={"pill pill--action" + (active ? " pill--ready" : "")} onClick={onPick}>
      {name}
      {kills > 0 && <span className="text-ink-faint"> ⚔{kills}</span>}
    </button>
  );
}
