import { PrankKind } from "@hammer/shared";
import { sendPrank } from "../../net/session";
import { PRANK_COPY } from "../../config/copy";

/**
 * Dead-player toolbar: lob something at a random survivor. Pranks harass but can
 * never eliminate — nobody sits idle after they're out.
 */
export function PrankBar() {
  return (
    <div className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
      {Object.values(PrankKind).map((kind) => (
        <button key={kind} className="pill" onClick={() => sendPrank(kind)}>
          {PRANK_COPY[kind].button}
        </button>
      ))}
    </div>
  );
}
