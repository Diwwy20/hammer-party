import { describe, expect, it } from "vitest";
import { AWARD_NO_VALUE, AwardKind } from "@hammer/shared";
import { computeAwards, computeStandings, type PlayerStatRow } from "./results";

/** A stat row with sensible defaults, so each test only states what it cares about. */
function row(overrides: Partial<PlayerStatRow> & { id: string }): PlayerStatRow {
  return {
    name: overrides.id,
    colorIndex: 0,
    kills: 0,
    damageDealt: 0,
    wallSlamsTaken: 0,
    survivedMs: 0,
    ...overrides,
  };
}

describe("computeStandings", () => {
  it("puts the winner first, then everyone else by who died last", () => {
    const rows = [
      row({ id: "first-out", survivedMs: 10_000 }),
      row({ id: "winner", survivedMs: 90_000 }),
      row({ id: "runner-up", survivedMs: 80_000 }),
    ];

    const standings = computeStandings(rows, "winner");

    expect(standings.map((s) => s.name)).toEqual(["winner", "runner-up", "first-out"]);
    expect(standings.map((s) => s.place)).toEqual([1, 2, 3]);
  });

  it("crowns the winner even when someone else's clock says otherwise", () => {
    const rows = [
      row({ id: "loser", survivedMs: 99_000 }),
      row({ id: "winner", survivedMs: 1_000 }),
    ];
    expect(computeStandings(rows, "winner")[0].name).toBe("winner");
  });

  it("still ranks everyone when nobody survived (winnerId is empty)", () => {
    const rows = [row({ id: "a", survivedMs: 20_000 }), row({ id: "b", survivedMs: 50_000 })];
    const standings = computeStandings(rows, "");
    expect(standings.map((s) => s.name)).toEqual(["b", "a"]);
    expect(standings.map((s) => s.place)).toEqual([1, 2]);
  });

  it("rounds damage — the screen shows whole numbers", () => {
    const standings = computeStandings([row({ id: "a", damageDealt: 123.6 })], "a");
    expect(standings[0].dmg).toBe(124);
  });

  it("does not mutate the rows it was given", () => {
    const rows = [row({ id: "a", survivedMs: 1 }), row({ id: "b", survivedMs: 2 })];
    computeStandings(rows, "b");
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("handles an empty room", () => {
    expect(computeStandings([], "")).toEqual([]);
  });
});

describe("computeAwards", () => {
  const context = { firstBloodName: "", winnerId: "winner", matchDurationMs: 120_000 };
  const kinds = (rows: PlayerStatRow[], ctx = context) =>
    computeAwards(rows, ctx).map((a) => a.kind);
  const find = (rows: PlayerStatRow[], kind: AwardKind, ctx = context) =>
    computeAwards(rows, ctx).find((a) => a.kind === kind);

  it("returns nothing for an empty room", () => {
    expect(computeAwards([], context)).toEqual([]);
  });

  it("hands Most Kills to the top scorer, with the count", () => {
    const rows = [row({ id: "a", kills: 1 }), row({ id: "winner", kills: 4 })];
    expect(find(rows, AwardKind.MostKills)).toEqual({
      kind: AwardKind.MostKills,
      name: "winner",
      value: 4,
    });
  });

  it("skips Most Kills entirely when nobody landed one — no award for a zero", () => {
    const rows = [row({ id: "a" }), row({ id: "winner" })];
    expect(kinds(rows)).not.toContain(AwardKind.MostKills);
  });

  it("skips Most Wall-slams until someone actually hits a wall", () => {
    expect(kinds([row({ id: "a" }), row({ id: "winner" })])).not.toContain(AwardKind.MostWallSlams);

    const bruised = [row({ id: "a", wallSlamsTaken: 3 }), row({ id: "winner" })];
    expect(find(bruised, AwardKind.MostWallSlams)?.name).toBe("a");
    expect(find(bruised, AwardKind.MostWallSlams)?.value).toBe(3);
  });

  it("reports First Blood by name, with no number to show", () => {
    const rows = [row({ id: "winner", kills: 1 })];
    const award = find(rows, AwardKind.FirstBlood, { ...context, firstBloodName: "Ann" });
    expect(award).toEqual({ kind: AwardKind.FirstBlood, name: "Ann", value: AWARD_NO_VALUE });
  });

  it("omits First Blood when the match had no kills at all", () => {
    expect(kinds([row({ id: "winner" })])).not.toContain(AwardKind.FirstBlood);
  });

  it("credits Longest Survivor to the winner for the whole match", () => {
    const rows = [row({ id: "a", survivedMs: 30_000 }), row({ id: "winner", survivedMs: 90_000 })];
    expect(find(rows, AwardKind.LongestSurvivor)).toEqual({
      kind: AwardKind.LongestSurvivor,
      name: "winner",
      value: context.matchDurationMs,
    });
  });

  it("falls back to whoever lasted longest when nobody won", () => {
    const rows = [row({ id: "a", survivedMs: 30_000 }), row({ id: "b", survivedMs: 75_000 })];
    const award = find(rows, AwardKind.LongestSurvivor, { ...context, winnerId: "" });
    expect(award?.name).toBe("b");
    expect(award?.value).toBe(75_000);
  });

  it("gives Pacifist to the least damage dealt", () => {
    const rows = [row({ id: "brawler", damageDealt: 400 }), row({ id: "winner", damageDealt: 12 })];
    expect(find(rows, AwardKind.Pacifist)?.name).toBe("winner");
    expect(find(rows, AwardKind.Pacifist)?.value).toBe(12);
  });

  it("breaks a Pacifist tie in favour of whoever stayed out of trouble longest", () => {
    const rows = [
      row({ id: "early", damageDealt: 0, survivedMs: 10_000 }),
      row({ id: "late", damageDealt: 0, survivedMs: 80_000 }),
    ];
    expect(find(rows, AwardKind.Pacifist)?.name).toBe("late");
  });

  it("skips Pacifist in a one-player room — there is nobody to be gentler than", () => {
    expect(kinds([row({ id: "winner" })])).not.toContain(AwardKind.Pacifist);
  });

  it("never awards the same kind twice", () => {
    const rows = [
      row({ id: "a", kills: 2, damageDealt: 300, wallSlamsTaken: 1, survivedMs: 40_000 }),
      row({ id: "winner", kills: 5, damageDealt: 500, wallSlamsTaken: 4, survivedMs: 120_000 }),
    ];
    const all = kinds(rows, { ...context, firstBloodName: "winner" });
    expect(new Set(all).size).toBe(all.length);
  });
});
