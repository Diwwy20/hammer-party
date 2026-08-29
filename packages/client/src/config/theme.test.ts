import { describe, expect, it } from "vitest";
import { HP_MAX, PickupKind, StageId, StageTheme, STAGES, STAGE_ORDER } from "@hammer/shared";
import { hpColor, hpRatio, pickupStyle, stagePalette } from "./theme";

describe("hpRatio", () => {
  it("maps HP onto 0…1", () => {
    expect(hpRatio(HP_MAX, HP_MAX)).toBe(1);
    expect(hpRatio(HP_MAX / 2, HP_MAX)).toBe(0.5);
    expect(hpRatio(0, HP_MAX)).toBe(0);
  });

  it("clamps, so a bar can never overflow its track", () => {
    expect(hpRatio(HP_MAX * 2, HP_MAX)).toBe(1);
    expect(hpRatio(-50, HP_MAX)).toBe(0);
  });
});

describe("hpColor", () => {
  it("walks green → amber → red as HP drops", () => {
    const healthy = hpColor(1);
    const hurt = hpColor(0.4);
    const critical = hpColor(0.05);

    expect(healthy).not.toBe(hurt);
    expect(hurt).not.toBe(critical);
    expect(healthy).not.toBe(critical);
  });

  it("returns a colour for every ratio, including the extremes", () => {
    for (const ratio of [0, 0.22, 0.5, 0.75, 1]) {
      expect(hpColor(ratio)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("never gets brighter as HP falls", () => {
    const seen: string[] = [];
    for (let r = 1; r >= 0; r -= 0.05) {
      const colour = hpColor(r);
      if (seen[seen.length - 1] !== colour) seen.push(colour);
    }
    // exactly one transition per threshold, and never back again
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
  });
});

describe("stagePalette", () => {
  it("has a palette for every theme a stage can ask for", () => {
    for (const id of STAGE_ORDER) {
      const palette = stagePalette(STAGES[id].theme);
      expect(palette.sky).toMatch(/^#/);
      expect(palette.safe).toMatch(/^#/);
    }
  });

  it("gives the plaza its own friendly look", () => {
    expect(stagePalette(StageTheme.Lobby)).not.toEqual(stagePalette(StageTheme.Colosseum));
  });

  it("falls back to the default look for an unknown theme rather than rendering nothing", () => {
    expect(stagePalette("neon-city")).toEqual(stagePalette(StageTheme.Colosseum));
    expect(stagePalette("")).toEqual(stagePalette(StageTheme.Colosseum));
  });
});

describe("pickupStyle", () => {
  it("styles every pickup kind distinctly", () => {
    const colours = Object.values(PickupKind).map((kind) => pickupStyle(kind).color);
    expect(new Set(colours).size).toBe(colours.length);
  });

  it("makes the event drops glow harder than the map weapons", () => {
    expect(pickupStyle(PickupKind.Golden).glow).toBeGreaterThan(pickupStyle(PickupKind.Fast).glow);
    expect(pickupStyle(PickupKind.Heal).glow).toBeGreaterThan(pickupStyle(PickupKind.Heavy).glow);
  });

  it("falls back for an unknown kind", () => {
    expect(pickupStyle("rocket")).toEqual(pickupStyle(PickupKind.Fast));
  });
});

describe("stage ids stay in sync with themes", () => {
  it("every stage names a theme this client can draw", () => {
    const known = new Set<string>(Object.values(StageTheme));
    for (const id of Object.values(StageId)) {
      expect(known.has(STAGES[id].theme)).toBe(true);
    }
  });
});
