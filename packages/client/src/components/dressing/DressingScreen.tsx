import { useEffect, useRef, useState } from "react";
import {
  selectMeReady,
  selectPlayerCount,
  selectReadyCount,
  useGame,
  type Cosmetic,
} from "../../store";
import { leaveRoom, sendReady } from "../../net/session";
import { DRESSING_COPY } from "../../config/copy";
import { Wardrobe } from "./Wardrobe";

/**
 * The dressing room's overlay: everything that is not the 3D room itself.
 *
 * Laid out as the brief asks — the character in the mirror on the LEFT, the item
 * grids on the RIGHT — and stacked instead on a phone held upright, where a
 * side-by-side split would leave two unusable columns. The mirror half is
 * `pointer-events-none` on purpose: it is a window onto the canvas behind, so a drag
 * there lands on the turntable rather than on this panel.
 *
 * The previewed HAMMER is passed in rather than owned here, because the mirror needs
 * it too and the mirror lives in the canvas: it is the one choice on this screen that
 * is not sent anywhere, since hammers are picked up in the arena and this is a look
 * at them, not a loadout.
 */
export function DressingScreen({
  cosmetic,
  previewHammer,
  onPreviewHammer,
  onDone,
}: {
  cosmetic: Cosmetic;
  previewHammer: string;
  onPreviewHammer: (kind: string) => void;
  onDone: () => void;
}) {
  const amReady = useGame(selectMeReady);
  const readyCount = useGame(selectReadyCount);
  const count = useGame(selectPlayerCount);
  const celebrate = useCelebration(amReady);

  return (
    <div className="dressing">
      <header className="dressing__bar">
        <button className="chip-btn" onClick={leaveRoom} aria-label={DRESSING_COPY.leave}>
          ✕
        </button>
        <h2 className="dressing__title">👗 {DRESSING_COPY.title}</h2>
        <button
          className={"ready-btn" + (amReady ? " ready-btn--on" : "")}
          onClick={() => sendReady(!amReady)}
        >
          <span className="ready-btn__mark">{amReady ? "✓" : "✦"}</span>
          <span>{amReady ? DRESSING_COPY.ready : DRESSING_COPY.notReady}</span>
          <span className="ready-btn__count">
            {readyCount}/{count}
          </span>
          {celebrate && <Sparkles />}
        </button>
      </header>

      <div className="dressing__body">
        {/* the mirror shows through here — nothing in this half may eat a pointer */}
        <div className="dressing__stage">
          <p className="dressing__hint">✋ {DRESSING_COPY.rotateHint}</p>
        </div>

        <section className="dressing__panel">
          <Wardrobe
            cosmetic={cosmetic}
            previewHammer={previewHammer}
            onPreviewHammer={onPreviewHammer}
          />
          <button className="done-btn" onClick={onDone}>
            ✓ {DRESSING_COPY.done}
          </button>
        </section>
      </div>
    </div>
  );
}

/**
 * True for a moment after the player presses ready — the cue the sparkle burst hangs
 * off. It fires on the RISING edge only: arriving in the room already ready is not
 * an achievement, pressing the button is.
 */
function useCelebration(ready: boolean): boolean {
  const [firing, setFiring] = useState(false);
  const was = useRef(ready);

  useEffect(() => {
    if (ready && !was.current) {
      setFiring(true);
      const timer = setTimeout(() => setFiring(false), CELEBRATION_MS);
      was.current = ready;
      return () => clearTimeout(timer);
    }
    was.current = ready;
  }, [ready]);

  return firing;
}

/** How long the ready burst lasts (ms) — matched to the `sparkle` keyframes. */
const CELEBRATION_MS = 900;

/** Eight sparks thrown out of the ready button. Pure CSS once they exist. */
function Sparkles() {
  return (
    <span className="sparkles" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <i key={i} style={{ "--spark-turn": `${(i / 8) * 360}deg` } as React.CSSProperties} />
      ))}
    </span>
  );
}
