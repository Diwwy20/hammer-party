/**
 * End-to-end smoke against a RUNNING server (`pnpm dev:server`, then `pnpm test:e2e`).
 *
 * This lives OUTSIDE `packages/` on purpose: it isn't part of the product, it drives
 * the product from the outside — a real socket, the real matchmaker, a real match.
 * That also keeps it out of the unit runner, which must stay in milliseconds.
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
  HazardPhase,
  LOBBY_RADIUS,
  METEOR,
  PIT,
  PLAYER_RADIUS,
  PRANK,
  PrankKind,
  StageId,
  WeatherKind,
} from "@hammer/shared";

const SERVER_URL = process.env.SMOKE_SERVER_URL ?? "ws://localhost:2567";

/** close enough to swing, far enough not to walk past (the swing is a forward cone) */
const HOLD_RANGE_M = 1.6;
/** a nudge that turns you to face someone without closing the gap */
const CREEP = 0.02;
/** how far inside a prop we will forgive: one tick of overshoot before the push-out. */
const COVER_TOLERANCE_M = 0.05;
const FIGHT_TIMEOUT_MS = 120_000;
const SETTLE_MS = 400;
const TICK_MS = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The slice of the decoded room state this smoke reads. colyseus.js types
 * `room.state` as `unknown` (the client decodes by reflection, without the schema
 * classes), so we name what we expect instead of reaching through `any`.
 */
interface SmokePlayer {
  name: string;
  x: number;
  z: number;
  hp: number;
  alive: boolean;
  hammer: string;
}

interface SmokeCollection<T> {
  size: number;
  get(id: string): T;
  values(): Iterable<T>;
}

/** A live meteor strike as the client sees it: where, how big, and how far along. */
interface SmokeHazard {
  kind: string;
  phase: string;
  x: number;
  z: number;
  radius: number;
}

interface SmokeState {
  phase: string;
  code: string;
  arenaRadius: number;
  stageId: string;
  activeEvent: string;
  winnerId: string;
  standingsJson: string;
  awardsJson: string;
  weather: string;
  players: SmokeCollection<SmokePlayer>;
  pickups: { size: number };
  hazards: SmokeCollection<SmokeHazard>;
}

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
  // Cid mostly stands about: with three players a single death still leaves two
  // alive, which is the only way the ghost half of the game is observable at all
  const cid = await client.joinById(host.roomId, { name: "Cid", code });
  silenceFxWarnings(host, ann, bob, cid);
  await sleep(SETTLE_MS);

  const state = () => host.state as SmokeState;
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

  /** Send `room` walking toward a fixed point on the floor. */
  const steerTo = (room: Room, x: number, z: number, seq: number) => {
    const me = playerOf(room.sessionId);
    const dx = x - me.x;
    const dz = z - me.z;
    const distance = Math.hypot(dx, dz) || 1;
    room.send("input", { seq, dx: dx / distance, dz: dz / distance });
  };

  const aliveCount = () => [...state().players.values()].filter((p) => p.alive).length;

  /** total HP still standing — the simplest way to see a prank land on *somebody*. */
  const healthOfTheLiving = () =>
    [...state().players.values()].reduce((sum, p) => sum + (p.alive ? p.hp : 0), 0);

  // ── the plaza ──────────────────────────────────────────────────────────────
  check(
    state().phase === GamePhase.Lobby && state().players.size === 3,
    `lobby plaza with ${state().players.size} players (code ${state().code})`,
    `expected a 3-player lobby, got ${state().players.size} in phase "${state().phase}"`,
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
  // ── solid cover blocks movement, identically on both sides ────────────────────
  const wall = PIT.obstacles[0];
  const minGap = wall.radius + PLAYER_RADIUS;
  let deepestBreach = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 60; i++) {
    steerTo(cid, wall.x, wall.z, i); // walk straight at its dead centre
    await sleep(50);
    const me = playerOf(cid.sessionId);
    deepestBreach = Math.min(deepestBreach, Math.hypot(me.x - wall.x, me.z - wall.z));
  }
  stop(cid);
  await sleep(SETTLE_MS);
  check(
    deepestBreach >= minGap - COVER_TOLERANCE_M,
    `cover is solid — closest approach ${deepestBreach.toFixed(2)}m vs ${minGap}m`,
    `walked ${deepestBreach.toFixed(2)}m into a prop that should stop you at ${minGap}m`,
  );

  // ── rain: weather is game state, not decoration ───────────────────────────────
  host.send("event", { kind: EventKind.Rain });
  await sleep(SETTLE_MS);
  check(
    state().weather === WeatherKind.Rain,
    "rain event put the whole room on a slick floor",
    `expected weather "${WeatherKind.Rain}", got "${state().weather}"`,
  );

  // ── meteors: telegraphed on the floor, then they land ─────────────────────────
  let booms = 0;
  host.onMessage("boom", () => booms++);

  host.send("event", { kind: EventKind.Meteor });
  await sleep(SETTLE_MS);
  const telegraphed = [...state().hazards.values()].some(
    (h) => h.phase === HazardPhase.Warn && h.radius === METEOR.blastRadius,
  );
  check(
    state().hazards.size > 0 && telegraphed,
    `meteor storm telegraphed on the floor (${state().hazards.size} marker(s) down)`,
    "the meteor storm dropped no warning markers",
  );

  await sleep(METEOR.warnMs + SETTLE_MS);
  check(
    booms > 0,
    `meteors landed and were broadcast (${booms} so far)`,
    "a meteor warning never turned into an impact",
  );

  let deathBroadcast = false;
  bob.onMessage("died", () => (deathBroadcast = true));

  const startedAt = Date.now();
  const everyoneStanding = state().players.size;
  for (let round = 0; state().phase === GamePhase.Playing; round++) {
    if (Date.now() - startedAt > FIGHT_TIMEOUT_MS) break;
    if (aliveCount() < everyoneStanding) break; // first blood — go and look at the ghost
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

  // ── the dead stay in the world as ghosts ────────────────────────────────────
  const fallen = [...state().players.values()].find((p) => !p.alive);
  const ghostRoom = [ann, bob, cid].find((room) => !playerOf(room.sessionId).alive);
  check(
    !!fallen && !!ghostRoom,
    `${fallen?.name ?? "somebody"} went down — the match carries on with ${aliveCount()} alive`,
    "nobody died, so there is no ghost to test",
  );

  if (ghostRoom) {
    // a ghost still drives: they can drift about the arena, they just cannot fight
    const from = { x: playerOf(ghostRoom.sessionId).x, z: playerOf(ghostRoom.sessionId).z };
    for (let i = 0; i < 20; i++) {
      ghostRoom.send("input", { seq: 1000 + i, dx: 1, dz: 0 });
      await sleep(50);
    }
    stop(ghostRoom);
    await sleep(SETTLE_MS);
    const to = playerOf(ghostRoom.sessionId);
    check(
      Math.hypot(to.x - from.x, to.z - from.z) > 1,
      `a ghost still drifts around the arena (moved ${Math.hypot(to.x - from.x, to.z - from.z).toFixed(1)}m)`,
      "a dead player was frozen in place instead of becoming a ghost",
    );

    // ...and can still harass the living, on a cooldown, without ever taking a kill
    let pranked = 0;
    ghostRoom.onMessage("prank", () => pranked++);
    const hpBefore = healthOfTheLiving();
    ghostRoom.send("prank", { kind: PrankKind.Bomb });
    ghostRoom.send("prank", { kind: PrankKind.Bomb }); // instantly again: must be ignored
    await sleep(SETTLE_MS);
    check(
      pranked === 1,
      `a ghost prank landed, and the cooldown swallowed the second (${PRANK.cooldownMs}ms)`,
      `expected exactly 1 prank through the cooldown, got ${pranked}`,
    );
    check(
      healthOfTheLiving() < hpBefore && aliveCount() > 0,
      "the prank hurt a survivor without eliminating anybody",
      "a ghost prank did no damage at all",
    );
  }

  // ── finish it off ───────────────────────────────────────────────────────────
  const survivors = [ann, bob, cid].filter((room) => playerOf(room.sessionId).alive);
  for (let round = 0; state().phase === GamePhase.Playing; round++) {
    if (Date.now() - startedAt > FIGHT_TIMEOUT_MS) break;
    for (const room of survivors) {
      const foe = survivors.find((other) => other !== room);
      if (!foe) continue;
      const gap = gapBetween(room.sessionId, foe.sessionId);
      steerToward(room, foe.sessionId, gap > HOLD_RANGE_M ? 1 : CREEP, round);
      if (gap <= HOLD_RANGE_M + 1) room.send("attack", { seq: round });
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
    standings.length === 3 && standings[0].place === 1 && standings[0].name === winner?.name,
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
  const players = [...state().players.values()];
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
  check(
    state().hazards.size === 0 && state().weather === WeatherKind.Clear,
    "the storm and the rain did not follow everyone back to the plaza",
    `restart left ${state().hazards.size} crater(s) and weather "${state().weather}"`,
  );

  await Promise.all([ann.leave(), bob.leave(), cid.leave(), host.leave()]);
  await sleep(SETTLE_MS);
}

/** colyseus.js warns loudly about FX messages nothing listens for; we don't render. */
function silenceFxWarnings(...rooms: Room[]): void {
  for (const room of rooms) {
    for (const type of ["swing", "hit", "died", "prank", "boom"]) room.onMessage(type, () => {});
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
