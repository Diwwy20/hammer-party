import { useState } from "react";
import {
  BACKS,
  CosmeticSlot,
  FACES,
  HATS,
  PLAYER_COLORS,
  type CosmeticOption,
} from "@hammer/shared";
import type { Cosmetic } from "../store";
import { sendCosmetic } from "../net/session";

/**
 * The dress-up picker: a tab per cosmetic slot. Every pick goes straight to the
 * server (`sendCosmetic`), which clamps it and echoes it back — so what you see is
 * always what everyone else sees, and there is no local "pending" copy to drift.
 */

interface SlotTab {
  slot: CosmeticSlot;
  label: string;
  /** the catalog to show; omitted for the colour tab, which draws swatches instead */
  options?: readonly CosmeticOption[];
}

const TABS: readonly SlotTab[] = [
  { slot: CosmeticSlot.Color, label: "สีตัว" },
  { slot: CosmeticSlot.Hat, label: "หมวก", options: HATS },
  { slot: CosmeticSlot.Face, label: "แว่นตา", options: FACES },
  { slot: CosmeticSlot.Back, label: "หลัง", options: BACKS },
];

export function Customizer({ cosmetic }: { cosmetic: Cosmetic }) {
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>(CosmeticSlot.Color);
  const tab = TABS.find((t) => t.slot === activeSlot) ?? TABS[0];
  const selected = cosmetic[tab.slot];

  return (
    <div className="customizer">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.slot}
            className={"tab" + (t.slot === activeSlot ? " tab--active" : "")}
            onClick={() => setActiveSlot(t.slot)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="options">
        {tab.options
          ? tab.options.map((option, index) => (
              <button
                key={option.id}
                className={"opt" + (index === selected ? " opt--active" : "")}
                onClick={() => sendCosmetic({ [tab.slot]: index })}
              >
                <span className="opt__icon">{option.icon}</span>
                <span className="opt__label">{option.label}</span>
              </button>
            ))
          : PLAYER_COLORS.map((color, index) => (
              <button
                key={color}
                className={"swatch" + (index === selected ? " swatch--active" : "")}
                style={{
                  background: `radial-gradient(circle at 35% 30%, #ffffff55, ${color} 55%)`,
                }}
                aria-label={`สี ${index + 1}`}
                onClick={() => sendCosmetic({ [CosmeticSlot.Color]: index })}
              />
            ))}
      </div>
    </div>
  );
}
