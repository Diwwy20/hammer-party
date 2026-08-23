import {
  DEFAULT_BACK_INDEX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_FACE_INDEX,
  DEFAULT_HAT_INDEX,
} from "@hammer/shared";
import { useGame, type Cosmetic } from "../store";
import { Customizer } from "./Customizer";

/**
 * Bottom-sheet dress-up for the plaza. Wraps the existing Customizer; edits apply
 * live (sendCosmetic → server → the avatar in the 3D world updates immediately), so
 * no second 3D preview canvas is needed here (keeps mobile perf up). Cosmetic slots
 * are read as primitives so the 20Hz movement stream doesn't churn this component.
 */
export function CustomizeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const colorIndex = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.colorIndex ?? DEFAULT_COLOR_INDEX) : DEFAULT_COLOR_INDEX));
  const hatIndex = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.hatIndex ?? DEFAULT_HAT_INDEX) : DEFAULT_HAT_INDEX));
  const faceIndex = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.faceIndex ?? DEFAULT_FACE_INDEX) : DEFAULT_FACE_INDEX));
  const backIndex = useGame((s) => (s.sessionId ? (s.players[s.sessionId]?.backIndex ?? DEFAULT_BACK_INDEX) : DEFAULT_BACK_INDEX));

  if (!open) return null;
  const cosmetic: Cosmetic = { colorIndex, hatIndex, faceIndex, backIndex };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        <div className="sheet__head">
          <span className="font-display text-base font-bold text-ink">แต่งตัว</span>
          <button className="link-btn" onClick={onClose}>
            เสร็จแล้ว
          </button>
        </div>
        <Customizer cosmetic={cosmetic} />
      </div>
    </div>
  );
}
