import { HTTP_URL } from "./client";

export interface LeaderboardEntry {
  name: string;
  matches: number;
  wins: number;
  kills: number;
  bestSurvivedMs: number;
}

export interface LeaderboardResp {
  period: string;
  entries: LeaderboardEntry[];
}

/** Fetch the monthly standings from the server's HTTP API (Phase 05). */
export async function fetchLeaderboard(period?: string): Promise<LeaderboardResp> {
  const url = `${HTTP_URL}/api/leaderboard${period ? `?period=${encodeURIComponent(period)}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  return res.json();
}
