import { useEffect, useState } from "react";
import { PRANK, PrankKind } from "@hammer/shared";
import { sendPrank } from "../../net/session";
import { markPrankThrown, prankThrownAt } from "../../runtime/combatFx";
import { GHOST_COPY, PRANK_COPY } from "../../config/copy";
import { HUD, MS_PER_SECOND } from "../../config/view";

/**
 * The ghost's toolbar: lob something at whoever you are floating nearest to.
 *
 * Pranks harass but can never eliminate — nobody sits idle after they're out, and
 * nobody gets knocked out by a spectator either.
 *
 * The cooldown shown here is a LOCAL mirror of `PRANK.cooldownMs`, started when we
 * send. The server enforces the real one and silently drops anything early; this is
 * only so the button can tell you why nothing happened.
 */
export function PrankBar() {
  const remaining = useCooldown();
  const cooling = remaining > 0;

  const throwPrank = (kind: PrankKind) => {
    if (cooling) return;
    markPrankThrown();
    sendPrank(kind);
  };

  return (
    <div className="prank-bar">
      <p className="prank-bar__hint">{GHOST_COPY.hint}</p>
      <div className="row justify-center gap-2">
        {Object.values(PrankKind).map((kind) => (
          <button
            key={kind}
            className={"pill pill--action" + (cooling ? " pill--cooling" : "")}
            disabled={cooling}
            onClick={() => throwPrank(kind)}
          >
            {cooling
              ? `${GHOST_COPY.cooling} ${(remaining / MS_PER_SECOND).toFixed(1)}s`
              : PRANK_COPY[kind].button}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Milliseconds left on the throw cooldown, polled rather than kept in the store —
 * the timestamp lives outside React precisely so nothing re-renders on it.
 */
function useCooldown(): number {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - prankThrownAt.t;
      setRemaining(Math.max(0, PRANK.cooldownMs - elapsed));
    }, HUD.cooldownPollMs);
    return () => window.clearInterval(timer);
  }, []);

  return remaining;
}
