import { AWARD_NO_VALUE, AwardKind, type MatchAward, type MatchStanding } from "@hammer/shared";
import { ALIVE, type SimContext } from "./context";

/**
 * End-of-match results: the standings table and the funny awards.
 *
 * Both are computed from a flat snapshot of per-player stats, so the ranking rules
 * are pure functions — no schema, no sockets, easy to reason about and to test.
 * They state FACTS only (who won what, and the number behind it); the icons and
 * Thai wording live on the client.
 */

/** One player's match summary — the only input the ranking rules need. */
export interface PlayerStatRow {
  id: string;
  name: string;
  colorIndex: number;
  kills: number;
  damageDealt: number;
  wallSlamsTaken: number;
  /** ms this player lasted (their death time, or the whole match if they survived) */
  survivedMs: number;
}

/** Snapshot every player's stats out of the live simulation. */
export function collectStatRows(ctx: SimContext): PlayerStatRow[] {
  const rows: PlayerStatRow[] = [];
  ctx.state.players.forEach((player, id) => {
    const combat = ctx.combat.get(id);
    const diedAtMs = combat && combat.diedAtMs !== ALIVE ? combat.diedAtMs : ctx.state.elapsedMs;
    rows.push({
      id,
      name: player.name,
      colorIndex: player.colorIndex,
      kills: player.kills,
      damageDealt: combat?.damageDealt ?? 0,
      wallSlamsTaken: combat?.wallSlamsTaken ?? 0,
      survivedMs: diedAtMs,
    });
  });
  return rows;
}

/**
 * Final placement: the winner first, then everyone else by time-of-death (last to
 * die ranks higher). Per-match only — nothing is persisted.
 */
export function computeStandings(rows: PlayerStatRow[], winnerId: string): MatchStanding[] {
  return [...rows]
    .sort((a, b) => {
      if (a.id === winnerId) return -1;
      if (b.id === winnerId) return 1;
      return b.survivedMs - a.survivedMs; // later death = better place
    })
    .map((row, index) => ({
      place: index + 1,
      name: row.name,
      colorIndex: row.colorIndex,
      kills: row.kills,
      dmg: Math.round(row.damageDealt),
    }));
}

/** Pacifist and friends only make sense once there's someone to compare against. */
const MIN_ROWS_FOR_PACIFIST = 2;

/** The row with the highest `score`; assumes a non-empty list. */
function best<T>(rows: T[], score: (row: T) => number): T {
  return rows.reduce((leader, row) => (score(row) > score(leader) ? row : leader));
}

/**
 * Funny end-of-match awards. Any award with no qualifier (nobody got a kill, nobody
 * hit a wall) is simply left out rather than handed to a zero.
 */
export function computeAwards(
  rows: PlayerStatRow[],
  context: { firstBloodName: string; winnerId: string; matchDurationMs: number },
): MatchAward[] {
  if (rows.length === 0) return [];
  const awards: MatchAward[] = [];

  const topKills = best(rows, (row) => row.kills);
  if (topKills.kills > 0) {
    awards.push({ kind: AwardKind.MostKills, name: topKills.name, value: topKills.kills });
  }

  if (context.firstBloodName) {
    awards.push({
      kind: AwardKind.FirstBlood,
      name: context.firstBloodName,
      value: AWARD_NO_VALUE,
    });
  }

  const winner = rows.find((row) => row.id === context.winnerId);
  const survivor = winner ?? best(rows, (row) => row.survivedMs);
  awards.push({
    kind: AwardKind.LongestSurvivor,
    name: survivor.name,
    value: winner ? context.matchDurationMs : survivor.survivedMs,
  });

  if (rows.length >= MIN_ROWS_FOR_PACIFIST) {
    // least damage dealt; a tie goes to whoever managed to stay out of trouble longest
    const pacifist = rows.reduce((leader, row) =>
      row.damageDealt < leader.damageDealt ||
      (row.damageDealt === leader.damageDealt && row.survivedMs > leader.survivedMs)
        ? row
        : leader,
    );
    awards.push({
      kind: AwardKind.Pacifist,
      name: pacifist.name,
      value: Math.round(pacifist.damageDealt),
    });
  }

  const topSlams = best(rows, (row) => row.wallSlamsTaken);
  if (topSlams.wallSlamsTaken > 0) {
    awards.push({
      kind: AwardKind.MostWallSlams,
      name: topSlams.name,
      value: topSlams.wallSlamsTaken,
    });
  }

  return awards;
}
