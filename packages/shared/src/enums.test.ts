import { describe, expect, it } from "vitest";
import {
  BACKS,
  FACES,
  HAMMERS,
  HATS,
  MAX_PLAYERS,
  MIN_PLAYERS_FOR_WIN,
  PLAYER_COLORS,
  ROOM_CODE_LENGTH,
  randomRoomCode,
} from "./constants";
import {
  BackId,
  COSMETIC_NONE_ID,
  FaceId,
  HammerKind,
  HatId,
  PickupKind,
  WEAPON_KINDS,
  isHammerPickup,
  isWeaponPickup,
} from "./enums";

describe("pickup classification", () => {
  it("treats every hammer pickup as a weapon swap", () => {
    expect(isHammerPickup(PickupKind.Fast)).toBe(true);
    expect(isHammerPickup(PickupKind.Heavy)).toBe(true);
    expect(isHammerPickup(PickupKind.Golden)).toBe(true);
  });

  it("treats the heal orb as the one non-hammer pickup", () => {
    expect(isHammerPickup(PickupKind.Heal)).toBe(false);
  });

  it("respawns only the map weapons — event drops are one-shot", () => {
    expect(isWeaponPickup(PickupKind.Fast)).toBe(true);
    expect(isWeaponPickup(PickupKind.Heavy)).toBe(true);
    expect(isWeaponPickup(PickupKind.Golden)).toBe(false);
    expect(isWeaponPickup(PickupKind.Heal)).toBe(false);
  });

  it("only classifies weapons that are real hammers", () => {
    for (const kind of WEAPON_KINDS) expect(HAMMERS[kind]).toBeDefined();
  });
});

describe("hammer tuning", () => {
  it("defines every hammer kind", () => {
    for (const kind of Object.values(HammerKind)) expect(HAMMERS[kind]).toBeDefined();
  });

  it("keeps the design ratio: fast < mid < heavy < golden in damage", () => {
    const { Fast, Mid, Heavy, Golden } = HammerKind;
    expect(HAMMERS[Fast].dmg).toBeLessThan(HAMMERS[Mid].dmg);
    expect(HAMMERS[Mid].dmg).toBeLessThan(HAMMERS[Heavy].dmg);
    expect(HAMMERS[Heavy].dmg).toBeLessThan(HAMMERS[Golden].dmg);
  });

  it("makes a harder hit slower and pushier — the trade-off the game is built on", () => {
    const { Fast, Mid, Heavy } = HammerKind;
    expect(HAMMERS[Fast].cooldownMs).toBeLessThan(HAMMERS[Mid].cooldownMs);
    expect(HAMMERS[Mid].cooldownMs).toBeLessThan(HAMMERS[Heavy].cooldownMs);
    expect(HAMMERS[Fast].knockback).toBeLessThan(HAMMERS[Heavy].knockback);
  });
});

describe("cosmetic catalogs", () => {
  const catalogs = [
    { name: "hats", catalog: HATS, ids: HatId },
    { name: "faces", catalog: FACES, ids: FaceId },
    { name: "backs", catalog: BACKS, ids: BackId },
  ];

  it.each(catalogs)("$name start with the 'none' entry at index 0", ({ catalog }) => {
    expect(catalog[0].id).toBe(COSMETIC_NONE_ID);
  });

  it.each(catalogs)("$name only use ids declared in the enum", ({ catalog, ids }) => {
    const declared = new Set<string>(Object.values(ids));
    for (const option of catalog) expect(declared.has(option.id)).toBe(true);
  });

  it.each(catalogs)("$name have unique ids and non-empty labels", ({ catalog }) => {
    expect(new Set(catalog.map((o) => o.id)).size).toBe(catalog.length);
    for (const option of catalog) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.icon.length).toBeGreaterThan(0);
    }
  });

  it("offers a colour for every player in a full room… or at least several to choose from", () => {
    expect(PLAYER_COLORS.length).toBeGreaterThan(1);
    expect(new Set(PLAYER_COLORS).size).toBe(PLAYER_COLORS.length);
  });
});

describe("randomRoomCode", () => {
  it("is the advertised length", () => {
    expect(randomRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
    expect(randomRoomCode(6)).toHaveLength(6);
  });

  it("never emits a character that misreads off a big screen (0/O/1/I)", () => {
    for (let i = 0; i < 500; i++) {
      expect(randomRoomCode(8)).not.toMatch(/[0O1I]/);
      expect(randomRoomCode(8)).toMatch(/^[A-Z2-9]+$/);
    }
  });
});

describe("room limits", () => {
  it("can't declare a winner in a room that never had a real field", () => {
    expect(MIN_PLAYERS_FOR_WIN).toBeGreaterThan(1);
    expect(MIN_PLAYERS_FOR_WIN).toBeLessThanOrEqual(MAX_PLAYERS);
  });
});
