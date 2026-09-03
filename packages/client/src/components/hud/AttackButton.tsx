import { useEffect, useRef } from "react";
import { selectMeHammer, useGame } from "../../store";
import { sendAttack } from "../../net/session";
import { markSwing } from "../../runtime/combatFx";
import { swingRepeatMs } from "../../runtime/input";
import { sfx } from "../../audio";

/**
 * Big thumb-friendly attack button. Holding it swings repeatedly; the server still
 * gates the real cooldown, so spamming can't out-swing the hammer.
 *
 * It repeats at THIS HAMMER's own cadence (`swingRepeatMs`) rather than on a fixed
 * timer — see that function for why the fixed one was worse than it looked.
 */
export function AttackButton({ sessionId }: { sessionId?: string }) {
  const repeat = useRef<number>();
  const hammer = useGame(selectMeHammer);

  const swing = () => {
    if (sessionId) markSwing(sessionId); // show OUR swing instantly, don't wait for the echo
    sendAttack();
  };

  const stop = () => {
    if (!repeat.current) return;
    window.clearInterval(repeat.current);
    repeat.current = undefined;
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    sfx.swing();
    swing();
    stop();
    repeat.current = window.setInterval(swing, swingRepeatMs(hammer));
  };

  useEffect(() => stop, []);

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="fixed right-6 bottom-8 z-20 grid h-[112px] w-[112px] touch-none place-items-center rounded-full border-4 border-white/80 bg-coral text-[44px] shadow-[0_7px_0_var(--color-coral-d),var(--shadow-soft)] transition-transform select-none active:translate-y-1.5 active:scale-95"
      aria-label="โจมตี"
    >
      🔨
    </button>
  );
}
