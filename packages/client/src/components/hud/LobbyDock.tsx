import { selectMeReady, selectPlayerCount, selectReadyCount, useGame } from "../../store";
import { sendReady } from "../../net/session";

/**
 * The player's lobby controls: get dressed, and say you're ready.
 *
 * Two buttons, floating above the thumbs — no status paragraph, no control hints.
 * The one number anybody actually wants (how many of us have pressed ready) rides
 * INSIDE the ready button, where it explains what the button is for; the Host is
 * the one who starts the match, and telling everybody that in a sentence they read
 * once and then ignore is not worth a line of screen.
 *
 * Selectors return primitives, so the 20Hz position stream never re-renders this.
 */
export function LobbyDock({ onCustomize }: { onCustomize: () => void }) {
  const count = useGame(selectPlayerCount);
  const readyCount = useGame(selectReadyCount);
  const amReady = useGame(selectMeReady);

  return (
    <div className="dock">
      <button className="dock__icon" onClick={onCustomize} aria-label="แต่งตัว">
        👕
      </button>
      <button
        className={"dock__go" + (amReady ? " dock__go--done" : "")}
        onClick={() => sendReady(!amReady)}
      >
        <span>{amReady ? "✓ พร้อมแล้ว" : "✦ พร้อม!"}</span>
        <span className="dock__count">
          {readyCount}/{count}
        </span>
      </button>
    </div>
  );
}
