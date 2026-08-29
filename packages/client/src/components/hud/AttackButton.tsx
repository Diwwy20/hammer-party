import { useEffect, useRef } from "react";
import { sendAttack } from "../../net/session";
import { markSwing } from "../../runtime/combatFx";
import { sfx } from "../../audio";
import { HUD } from "../../config/view";

/**
 * Big thumb-friendly attack button. Holding it swings repeatedly; the server still
 * gates the real cooldown, so spamming can't out-swing the hammer.
 */
export function AttackButton({ sessionId }: { sessionId?: string }) {
  const repeat = useRef<number>();

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
    repeat.current = window.setInterval(swing, HUD.swingRepeatMs);
  };

  useEffect(() => stop, []);

  return (
    <button
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="fixed right-7 bottom-10 grid h-[104px] w-[104px] touch-none place-items-center rounded-full bg-coral text-[42px] shadow-[0_6px_0_var(--color-coral-d),var(--shadow-soft)] transition-transform select-none active:translate-y-1 active:scale-95"
      aria-label="โจมตี"
    >
      🔨
    </button>
  );
}
