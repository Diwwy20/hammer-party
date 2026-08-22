import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Phase 05 leaderboard store. Deliberately a flat JSON file, not a real DB: a
 * monthly company party is tiny, single-server, and must run offline on a LAN —
 * a file needs no native module and no setup. Swap for SQLite later if it grows.
 *
 * Players have no accounts, so results aggregate by display name.
 */

/** One player's line from one finished match. */
export interface MatchRow {
  name: string;
  kills: number;
  dmg: number;
  survivedMs: number;
  won: boolean;
  ts: number; // Date.now() at match end
}

/** Aggregated standings for a period. */
export interface LeaderboardEntry {
  name: string;
  matches: number;
  wins: number;
  kills: number;
  bestSurvivedMs: number;
}

const FILE = resolve(process.cwd(), "data", "leaderboard.json");

function readAll(): MatchRow[] {
  try {
    if (!existsSync(FILE)) return [];
    const raw = readFileSync(FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return []; // corrupt/locked file → behave as empty rather than crash the room
  }
}

/** Append one match's rows to the store. Best-effort; never throws into the sim. */
export function recordMatch(rows: MatchRow[]): void {
  if (rows.length === 0) return;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    const all = readAll();
    all.push(...rows);
    writeFileSync(FILE, JSON.stringify(all), "utf8");
  } catch (e) {
    console.error("[leaderboard] write failed:", e);
  }
}

function ymKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/**
 * Standings for a month (default: the current month). Grouped by name, ranked by
 * wins then kills. `period` is a "YYYY-M" key (getMonth() is 0-based) or "all".
 */
export function getLeaderboard(period?: string): { period: string; entries: LeaderboardEntry[] } {
  const rows = readAll();
  const key = period && period !== "all" ? period : ymKey(Date.now());
  const scoped = period === "all" ? rows : rows.filter((r) => ymKey(r.ts) === key);

  const byName = new Map<string, LeaderboardEntry>();
  for (const r of scoped) {
    const e = byName.get(r.name) ?? { name: r.name, matches: 0, wins: 0, kills: 0, bestSurvivedMs: 0 };
    e.matches += 1;
    e.wins += r.won ? 1 : 0;
    e.kills += r.kills;
    e.bestSurvivedMs = Math.max(e.bestSurvivedMs, r.survivedMs);
    byName.set(r.name, e);
  }

  const entries = [...byName.values()].sort((a, b) => b.wins - a.wins || b.kills - a.kills || b.bestSurvivedMs - a.bestSurvivedMs);
  return { period: period === "all" ? "all" : key, entries };
}
