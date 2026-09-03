import { useState } from "react";
import {
  BACKS,
  CosmeticSlot,
  FACES,
  HAIR_COLORS,
  HAMMERS,
  HATS,
  HammerKind,
  PLAYER_COLORS,
  type CosmeticMessage,
  type CosmeticOption,
} from "@hammer/shared";
import type { Cosmetic } from "../../store";
import { sendCosmetic } from "../../net/session";
import { DRESSING_COPY } from "../../config/copy";
import { BackIcon, FaceIcon, HairIcon, HammerIcon, HatIcon, ShirtIcon } from "./ItemIcon";

/**
 * The wardrobe: the panel of item grids that sits beside the mirror.
 *
 * Every pick goes straight to the server (`sendCosmetic`), which clamps it and
 * echoes it back — so what you see is always what everyone else sees, and there is
 * no local "pending" copy to drift out of step. The one exception is the HAMMER
 * grid, which is a preview and nothing else: hammers are picked up in the arena, so
 * choosing one here would be a stat, not a cosmetic, and this screen is not allowed
 * to hand out stats. It says so on the tab.
 */

/** Which grid is open. A superset of the cosmetic slots, because of the hammer tab. */
const Tab = {
  Color: "color",
  Hair: "hair",
  Hat: "hat",
  Face: "face",
  Back: "back",
  /** preview only — see `DRESSING_COPY.hammerNote` */
  Hammer: "hammer",
} as const;
type Tab = (typeof Tab)[keyof typeof Tab];

const TAB_ORDER: readonly Tab[] = [Tab.Color, Tab.Hair, Tab.Hat, Tab.Face, Tab.Back, Tab.Hammer];

/** The catalogs that live in a cosmetic SLOT, i.e. everything but the hammer tab. */
const SLOT_OF: Partial<Record<Tab, CosmeticSlot>> = {
  [Tab.Color]: CosmeticSlot.Color,
  [Tab.Hair]: CosmeticSlot.Hair,
  [Tab.Hat]: CosmeticSlot.Hat,
  [Tab.Face]: CosmeticSlot.Face,
  [Tab.Back]: CosmeticSlot.Back,
};

const CATALOG_OF: Partial<Record<Tab, readonly CosmeticOption[]>> = {
  [Tab.Hat]: HATS,
  [Tab.Face]: FACES,
  [Tab.Back]: BACKS,
};

/** Hammer kinds in the order the preview grid shows them: lightest first. */
const HAMMER_ORDER: readonly HammerKind[] = [
  HammerKind.Fast,
  HammerKind.Mid,
  HammerKind.Heavy,
  HammerKind.Golden,
];

export function Wardrobe({
  cosmetic,
  previewHammer,
  onPreviewHammer,
}: {
  cosmetic: Cosmetic;
  previewHammer: string;
  onPreviewHammer: (kind: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(Tab.Color);

  return (
    <div className="wardrobe">
      <nav className="wardrobe__tabs" role="tablist">
        {TAB_ORDER.map((one) => (
          <button
            key={one}
            role="tab"
            aria-selected={one === tab}
            className={"wtab" + (one === tab ? " wtab--on" : "")}
            onClick={() => setTab(one)}
          >
            {DRESSING_COPY.tabs[one]}
          </button>
        ))}
      </nav>

      <div className="wardrobe__grid">
        <Grid
          tab={tab}
          cosmetic={cosmetic}
          previewHammer={previewHammer}
          onPreviewHammer={onPreviewHammer}
        />
      </div>

      {tab === Tab.Hammer && <p className="wardrobe__note">ℹ️ {DRESSING_COPY.hammerNote}</p>}

      <button className="dice" onClick={() => sendCosmetic(randomOutfit())}>
        <DiceIcon />
        <span>{DRESSING_COPY.random}</span>
      </button>
    </div>
  );
}

/** The cells for whichever tab is open. */
function Grid({
  tab,
  cosmetic,
  previewHammer,
  onPreviewHammer,
}: {
  tab: Tab;
  cosmetic: Cosmetic;
  previewHammer: string;
  onPreviewHammer: (kind: string) => void;
}) {
  if (tab === Tab.Hammer) {
    return (
      <>
        {HAMMER_ORDER.map((kind) => (
          <Cell
            key={kind}
            label={HAMMERS[kind].label}
            selected={kind === previewHammer}
            onPick={() => onPreviewHammer(kind)}
          >
            <HammerIcon kind={kind} label={HAMMERS[kind].label} />
          </Cell>
        ))}
      </>
    );
  }

  const slot = SLOT_OF[tab];
  if (!slot) return null;
  const selected = cosmetic[slot];
  const pick = (index: number) => sendCosmetic({ [slot]: index });

  if (tab === Tab.Color) {
    return (
      <>
        {PLAYER_COLORS.map((color, index) => (
          <Cell
            key={color}
            label={`${DRESSING_COPY.tabs.color} ${index + 1}`}
            selected={index === selected}
            onPick={() => pick(index)}
          >
            <ShirtIcon color={color} label={`${DRESSING_COPY.tabs.color} ${index + 1}`} />
          </Cell>
        ))}
      </>
    );
  }

  if (tab === Tab.Hair) {
    return (
      <>
        {HAIR_COLORS.map((color, index) => (
          <Cell
            key={color}
            label={`${DRESSING_COPY.tabs.hair} ${index + 1}`}
            selected={index === selected}
            onPick={() => pick(index)}
          >
            <HairIcon color={color} label={`${DRESSING_COPY.tabs.hair} ${index + 1}`} />
          </Cell>
        ))}
      </>
    );
  }

  const catalog = CATALOG_OF[tab] ?? [];
  return (
    <>
      {catalog.map((option, index) => (
        <Cell
          key={option.id}
          label={option.label}
          selected={index === selected}
          onPick={() => pick(index)}
        >
          <SlotIcon tab={tab} id={option.id} label={option.label} />
        </Cell>
      ))}
    </>
  );
}

/** One grid cell: a painted preview with its name under it. */
function Cell({
  label,
  selected,
  onPick,
  children,
}: {
  label: string;
  selected: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={"item" + (selected ? " item--on" : "")}
      onClick={onPick}
      aria-pressed={selected}
    >
      {children}
      <span className="item__label">{label}</span>
      {selected && <span className="item__tick">✓</span>}
    </button>
  );
}

function SlotIcon({ tab, id, label }: { tab: Tab; id: string; label: string }) {
  if (tab === Tab.Hat) return <HatIcon id={id} label={label} />;
  if (tab === Tab.Face) return <FaceIcon id={id} label={label} />;
  return <BackIcon id={id} label={label} />;
}

/** A whole outfit at random — every slot at once, which is the point of the button. */
function randomOutfit(): CosmeticMessage {
  const roll = (length: number) => Math.floor(Math.random() * length);
  return {
    colorIndex: roll(PLAYER_COLORS.length),
    hairIndex: roll(HAIR_COLORS.length),
    hatIndex: roll(HATS.length),
    faceIndex: roll(FACES.length),
    backIndex: roll(BACKS.length),
  };
}

/** The die on the random button — three pips on a tilted face. */
function DiceIcon() {
  return (
    <svg className="dice__art" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" opacity="0.22" />
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="8.5" cy="8.5" r="1.9" fill="currentColor" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.9" fill="currentColor" />
    </svg>
  );
}
