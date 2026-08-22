import { useState } from "react";
import { BACKS, FACES, HATS, PLAYER_COLORS, type CosmeticOption } from "@hammer/shared";
import type { Cosmetic } from "../store";
import { sendCosmetic } from "../net/session";

type SlotKey = keyof Cosmetic;

interface Tab {
  key: string;
  label: string;
  slot: SlotKey;
  options?: readonly CosmeticOption[]; // undefined => colour swatches
}

const TABS: Tab[] = [
  { key: "color", label: "สีตัว", slot: "colorIndex" },
  { key: "hat", label: "หมวก", slot: "hatIndex", options: HATS },
  { key: "face", label: "แว่นตา", slot: "faceIndex", options: FACES },
  { key: "back", label: "หลัง", slot: "backIndex", options: BACKS },
];

export function Customizer({ cosmetic }: { cosmetic: Cosmetic }) {
  const [active, setActive] = useState("color");
  const tab = TABS.find((t) => t.key === active) ?? TABS[0];
  const current = cosmetic[tab.slot];

  return (
    <div className="customizer">
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"tab" + (t.key === active ? " tab--active" : "")}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="options">
        {tab.options
          ? tab.options.map((opt, i) => (
              <button
                key={opt.id}
                className={"opt" + (i === current ? " opt--active" : "")}
                onClick={() => sendCosmetic({ [tab.slot]: i })}
              >
                <span className="opt__icon">{opt.icon}</span>
                <span className="opt__label">{opt.label}</span>
              </button>
            ))
          : PLAYER_COLORS.map((c, i) => (
              <button
                key={c}
                className={"swatch" + (i === current ? " swatch--active" : "")}
                style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${c} 55%)` }}
                aria-label={`สี ${i + 1}`}
                onClick={() => sendCosmetic({ colorIndex: i })}
              />
            ))}
      </div>
    </div>
  );
}
