import { useGame } from "../../store";
import { EVENT_COPY } from "../../config/copy";

/**
 * The random-event toast. The server publishes only the event KIND (and clears it
 * after `EVENT_BANNER_MS`); the wording lives in `config/copy.ts`.
 */
export function EventBanner() {
  const activeEvent = useGame((s) => s.activeEvent);
  if (!activeEvent) return null;

  return (
    <div className="fixed inset-x-0 top-3 z-20 flex justify-center">
      <div className="rounded-full bg-yellow px-5 py-2 font-display text-base font-extrabold text-ink shadow-soft">
        {EVENT_COPY[activeEvent].banner}
      </div>
    </div>
  );
}
