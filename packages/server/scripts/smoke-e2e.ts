/**
 * End-to-end smoke against a RUNNING server (`pnpm dev:server`, then `pnpm test:e2e`).
 *
 * The vitest suite covers the pure rules; this covers the wiring those rules sit in —
 * a real socket, a real room, a real match — which is exactly what mocks can't tell
 * you. It drives a Host plus two players through one full loop and asserts the
 * things that would ruin a party if they broke:
 *
 *   plaza bonks cost no HP → the stage picker applies → the match starts → an event
 *   reaches the clients as a KIND (no server-side copy) → someone actually dies →
 *   results carry standings + structured awards → restart puts everyone back in the
 *   plaza on the starting hammer.
 *
 * Exits non-zero on the first broken expectation. Safe to re-run: each run creates
 * its own room and leaves it empty afterwards.
 */
import { Client, type Room } from "colyseus.js";
import {
  ARENA_RADIUS,
  EventKind,
  GamePhase,
  HP_MAX,
  HammerKind,
  LOBBY_RADIUS,
  PIT,
  StageId,
} from "@hammer/shared";

const SERVER_URL = process.env.SMOKE_SERVER_URL ?? "ws://localhost:2567";

/** close enough to swing, far enough not to walk past (the swing is a forward cone) */
const HOLD_RANGE_M = 1.6;
/** a nudge that turns you to face someone without closing the gap */
const CREEP = 0.02;
const FIGHT_TIMEOUT_MS = 120_000;
const SETTLE_MS = 400;
const TICK_MS = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
const ok = (message: string) => console.log("✅", message);
const check = (condition: boolean, good: string, bad: string) => {
  if (condition) return ok(good);
  console.error("❌", bad);
  failures++;
};

async function main(): Promise<void> {
  const client = new Client(SERVER_URL);
  const code = "SMK" + Math.floor(Math.random() * 10);

  const host = await client.create("game", { name: "HOST", asHost: true, code });
  const ann = await client.joinById(host.roomId, { name: "Ann", code });
  const bob = await client.joinById(host.roomId, { name: "Bob", code });
  silenceFxWarnings(host, ann, bob);
  await sleep(SETTLE_MS);

  const state = () => host.state;
  const playerOf = (id: string) => state().players.get(id);
  const gapBetween = (a: string, b: string) =>
    Math.hypot(playerOf(b).x - playerOf(a).x, playerOf(b).z - playerOf(a).z);

  /** Send `room` walking toward `targetId` at `scale` of full speed. */
  const steerToward = (room: Room, targetId: string, scale: number, seq: number) => {
    const me = playerOf(room.sessionId);
    const them = playerOf(targetId);
    const dx = them.x - me.x;
    const dz = them.z - me.z;
    const distance = Math.hypot(dx, dz) || 1;
    room.send("input", { seq, dx: (dx / distance) * scale, dz: (dz / distance) * scale });
  };
  const stop = (room: Room) => room.send("input", { seq: Number.MAX_SAFE_INTEGER, dx: 0, dz: 0 });

  // ── the plaza ──────────────────────────────────────────────────────────────
  check(
    state().phase === GamePhase.Lobby && state().players.size === 2,
    `lobby plaza with ${state().players.size} players (code ${state().code})`,
    `expected a 2-player lobby, got ${state().players.size} in phase "${state().phase}"`,
  );
  check(
    state().arenaRadius === LOBBY_RADIUS,
    `world sized to the plaza (r=${LOBBY_RADIUS})`,
    `expected plaza radius ${LOBBY_RADIUS}, got ${state().arenaRadius}`,
  );

  // walk them into each other, then bonk: knockback yes, damage no
  for (let i = 0; i < 40; i++) {
    steerToward(ann, bob.sessionId, 1, i);
    steerToward(bob, ann.sessionId, 1, i);
    await sleep(50);
  }
  stop(ann);
  stop(bob);
  await sleep(SETTLE_MS);

  for (let i = 0; i < 10; i++) {
    ann.send("attack", { seq: i });
    await sleep(120);
  }
  await sleep(SETTLE_MS);
  check(
    playerOf(ann.sessionId).hp === HP_MAX && playerOf(bob.sessionId).hp === HP_MAX,
    "plaza bonks cost no HP",
    "a plaza bonk took HP off someone",
  );

  // ── starting a match on a chosen stage ─────────────────────────────────────
  host.send("setstage", { stageId: StageId.Pit });
  await sleep(SETTLE_MS);
  check(
    state().stageId === StageId.Pit,
    `Host stage picker applied (${state().stageId})`,
    `stage picker failed: ${state().stageId}`,
  );

  host.send("start");
  await sleep(SETTLE_MS);
  check(
    state().phase === GamePhase.Playing &&
      state().arenaRadius === PIT.radius &&
      state().pickups.size === PIT.weaponSpawns.length,
    `match started on ${state().stageId} (r=${state().arenaRadius}, ${state().pickups.size} pickups)`,
    `match did not start on the picked stage (phase=${state().phase}, r=${state().arenaRadius})`,
  );
  check(
    state().arenaRadius !== ARENA_RADIUS,
    "the picked stage overrode the default arena size",
    "the picked stage did not change the arena size",
  );

  // ── an event reaches the clients as a KIND, not a sentence ─────────────────
  host.send("event", { kind: EventKind.Golden });
  await sleep(SETTLE_MS);
  check(
    state().activeEvent === EventKind.Golden,
    "event banner carries the event kind (no server-side copy)",
    `expected activeEvent "${EventKind.Golden}", got "${state().activeEvent}"`,
  );

  // ── fight to the death ─────────────────────────────────────────────────────
  let deathBroadcast = false;
  bob.onMessage("died", () => (deathBroadcast = true));

  const startedAt = Date.now();
  for (let round = 0; state().phase === GamePhase.Playing; round++) {
    if (Date.now() - startedAt > FIGHT_TIMEOUT_MS) break;
    const gap = gapBetween(ann.sessionId, bob.sessionId);
    const scale = gap > HOLD_RANGE_M ? 1 : CREEP;
    steerToward(ann, bob.sessionId, scale, round);
    steerToward(bob, ann.sessionId, scale, round);
    if (gap <= HOLD_RANGE_M + 1) {
      ann.send("attack", { seq: round });
      bob.send("attack", { seq: round });
    }
    await sleep(TICK_MS);
  }
  await sleep(SETTLE_MS);

  const winner = state().players.get(state().winnerId);
  check(
    state().phase === GamePhase.Ended,
    `match ended — winner: ${winner?.name ?? "nobody"}`,
    `match never ended (${((Date.now() - startedAt) / 1000).toFixed(0)}s elapsed)`,
  );
  check(
    deathBroadcast,
    "the death was broadcast to the clients",
    "no death broadcast reached a client",
  );

  // ── results ────────────────────────────────────────────────────────────────
  const standings = parse(state().standingsJson);
  const awards = parse(state().awardsJson);
  console.log("   standings:", JSON.stringify(standings));
  console.log("   awards:   ", JSON.stringify(awards));

  check(
    standings.length === 2 && standings[0].place === 1 && standings[0].name === winner?.name,
    "standings ranked winner-first",
    "standings are missing or not ranked winner-first",
  );
  check(
    awards.length > 0 &&
      awards.every(
        (a) =>
          typeof a.kind === "string" && typeof a.name === "string" && typeof a.value === "number",
      ),
    `awards are structured data: ${awards.map((a) => a.kind).join(", ")}`,
    "awards are malformed (expected {kind, name, value} — no UI copy from the server)",
  );

  // ── restart ────────────────────────────────────────────────────────────────
  host.send("restart");
  await sleep(SETTLE_MS);
  const players = [...state().players.values()] as { hp: number; alive: boolean; hammer: string }[];
  check(
    state().phase === GamePhase.Lobby &&
      state().arenaRadius === LOBBY_RADIUS &&
      players.every((p) => p.hp === HP_MAX && p.alive),
    "restart returned everyone to a fresh plaza",
    "restart did not reset the room",
  );
  check(
    players.every((p) => p.hammer === HammerKind.Mid),
    "everyone is back on the starting hammer",
    "a pickup survived the restart",
  );

  await Promise.all([ann.leave(), bob.leave(), host.leave()]);
  await sleep(SETTLE_MS);
}

/** colyseus.js warns loudly about FX messages nothing listens for; we don't render. */
function silenceFxWarnings(...rooms: Room[]): void {
  for (const room of rooms) {
    for (const type of ["swing", "hit", "died", "prank"]) room.onMessage(type, () => {});
  }
}

function parse(json: string): { place: number; name: string; kind: string; value: number }[] {
  try {
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

main()
  .then(() => {
    console.log(failures ? "\nSMOKE FAILED" : "\nSMOKE PASSED");
    process.exit(failures ? 1 : 0);
  })
  .catch((err) => {
    console.error("\nSMOKE CRASHED:", err);
    process.exit(1);
  });
