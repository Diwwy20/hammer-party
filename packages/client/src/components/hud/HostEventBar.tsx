import { EventKind } from "@hammer/shared";
import { sendEvent } from "../../net/session";
import { EVENT_COPY } from "../../config/copy";

/** Host-only: fire a random event by hand instead of waiting for its timer. */
export function HostEventBar() {
  return (
    <div className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
      {Object.values(EventKind).map((kind) => (
        <button key={kind} className="pill" onClick={() => sendEvent(kind)}>
          {EVENT_COPY[kind].button}
        </button>
      ))}
    </div>
  );
}
