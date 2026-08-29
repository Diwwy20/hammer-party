import type { Room } from "colyseus.js";
import {
  ClientMsg,
  DEFAULT_STAGE_ID,
  GamePhase,
  JoinError,
  ROOM_NAME,
  ServerMsg,
  StageTheme,
  WeatherKind,
  type BoomEvent,
  type CosmeticMessage,
  type DiedEvent,
  type EventKind,
  type PrankKind,
  type StageId,
  type PrankEvent,
  type HitEvent,
  type SwingEvent,
} from "@hammer/shared";
import { colyseus } from "./client";
import { RECONNECT, WS_NORMAL_CLOSE } from "./config";
import { Conn, useGame, type HazardView, type PickupView, type PlayerView } from "../store";
import { recordSnapshot, resetBuffer, type Pos } from "./movement";
import {
  markBoom,
  markDied,
  markHit,
  markPrank,
  markSwing,
  resetCombatFx,
} from "../runtime/combatFx";
import { CONNECT_ERROR } from "../config/copy";
import { sfx } from "../audio";

/**
 * The socket: connect, mirror room state into the store, and send intents up.
 *
 * This is the ONLY module that talks to Colyseus. Everything above it reads the
 * store; everything below it is the server's business.
 */

/** The live room. Kept module-level (non-serialisable) — never put it in the store. */
let room: Room | undefined;
let inputSeq = 0;
/** The code we joined with — fallback for the store while state.code is empty. */
let joinedCode = "";
/** True while we deliberately left, so an expected onLeave doesn't try to reconnect. */
let leaving = false;

export interface ConnectOpts {
  name: string;
  code: string;
  asHost?: boolean;
}

/**
 * Host → `create` (always a fresh room, stamped with the code).
 * Player → `join` (existing room matching the code, or an error if none).
 */
export async function connect(opts: ConnectOpts): Promise<void> {
  useGame.getState().set({
    conn: Conn.Connecting,
    isHost: !!opts.asHost,
    code: opts.code,
    error: undefined,
  });
  leaving = false;
  joinedCode = opts.code;

  try {
    const joinOpts = { name: opts.name, asHost: opts.asHost, code: opts.code };
    room = opts.asHost
      ? await colyseus.create(ROOM_NAME, joinOpts)
      : await colyseus.join(ROOM_NAME, joinOpts);
    adoptRoom(room);
  } catch (e: unknown) {
    console.error("[net] connect failed:", e);
    useGame.getState().set({ conn: Conn.Error, error: friendlyError(e) });
  }
}

/** Take a freshly (re)connected room as the live one: reset FX, mirror, wire handlers. */
function adoptRoom(r: Room): void {
  inputSeq = 0;
  resetBuffer();
  resetCombatFx();
  useGame.getState().set({ conn: Conn.Open, roomId: r.roomId, sessionId: r.sessionId });

  applyState(r.state as DecodedState);
  r.onStateChange(() => applyState(r.state as DecodedState));

  // Transient combat FX → the per-frame maps (never the store).
  r.onMessage(ServerMsg.Swing, (m: SwingEvent) => markSwing(m.id));
  r.onMessage(ServerMsg.Hit, (m: HitEvent) => markHit(m.id));
  // the avatar's switch to a ghost is driven by the synced `alive` flag; this is only
  // so the puff of dust lands on the frame they went down, not on the next patch
  r.onMessage(ServerMsg.Died, (m: DiedEvent) => markDied(m.id));
  r.onMessage(ServerMsg.Boom, (m: BoomEvent) => {
    markBoom(m.x, m.z, m.radius);
    sfx.boom();
  });
  r.onMessage(ServerMsg.Prank, (m: PrankEvent) => {
    markPrank(m.id, m.kind);
    markHit(m.id);
    if (m.id === useGame.getState().sessionId) sfx.prank();
  });

  r.onLeave((code) => void onRoomLeave(code));
}

// ── State mirroring ───────────────────────────────────────────────────────────

/** What the reflection decoder hands us — the schema's shape, without its classes. */
interface DecodedMap<T> {
  forEach(each: (value: T, key: string) => void): void;
}

interface DecodedState {
  players?: DecodedMap<PlayerView & Pos>;
  pickups?: DecodedMap<PickupView>;
  hazards?: DecodedMap<HazardView>;
  phase: GamePhase;
  code?: string;
  hostSessionId?: string;
  winnerId?: string;
  arenaRadius: number;
  zoneRadius: number;
  stageId?: StageId;
  stageTheme?: string;
  activeEvent?: EventKind | "";
  weather?: WeatherKind;
  awardsJson?: string;
  standingsJson?: string;
}

/**
 * Rebuild the render-friendly view on every state patch. Positions/dir feed the
 * interpolation buffer (read per-frame), NOT the store — that would re-render 20×/s.
 */
function applyState(state: DecodedState): void {
  const players: Record<string, PlayerView> = {};
  const positions: Record<string, Pos> = {};
  state.players?.forEach((p, id) => {
    players[id] = {
      name: p.name,
      x: p.x,
      z: p.z,
      ready: p.ready,
      colorIndex: p.colorIndex,
      hatIndex: p.hatIndex,
      faceIndex: p.faceIndex,
      backIndex: p.backIndex,
      hp: p.hp,
      alive: p.alive,
      hammer: p.hammer,
      stunned: p.stunned,
      connected: p.connected,
      kills: p.kills,
    };
    positions[id] = { x: p.x, z: p.z, dir: p.dir };
  });

  const pickups: Record<string, PickupView> = {};
  state.pickups?.forEach((pk, id) => {
    pickups[id] = { kind: pk.kind, x: pk.x, z: pk.z, active: pk.active };
  });

  const hazards: Record<string, HazardView> = {};
  state.hazards?.forEach((hz, id) => {
    hazards[id] = { kind: hz.kind, phase: hz.phase, x: hz.x, z: hz.z, radius: hz.radius };
  });

  recordSnapshot(positions);
  useGame.getState().set({
    players,
    pickups,
    hazards,
    phase: state.phase,
    code: state.code || joinedCode,
    hostSessionId: state.hostSessionId ?? "",
    winnerId: state.winnerId ?? "",
    arenaRadius: state.arenaRadius,
    zoneRadius: state.zoneRadius,
    stageId: state.stageId ?? DEFAULT_STAGE_ID,
    stageTheme: state.stageTheme || StageTheme.Colosseum,
    activeEvent: state.activeEvent ?? "",
    weather: state.weather ?? WeatherKind.Clear,
    awardsJson: state.awardsJson ?? "",
    standingsJson: state.standingsJson ?? "",
  });
}

// ── Disconnects ───────────────────────────────────────────────────────────────

/**
 * Handle an unexpected disconnect. A deliberate leave (or a normal close) drops
 * to the error screen; a mid-match drop retries a few times so a phone that blipped
 * off the party wifi rejoins the same seat (the server holds it open).
 */
async function onRoomLeave(closeCode: number): Promise<void> {
  if (leaving) return;

  const { phase } = useGame.getState();
  const token = room?.reconnectionToken;
  const canRetry = closeCode !== WS_NORMAL_CLOSE && phase === GamePhase.Playing && !!token;
  if (!canRetry) {
    useGame.getState().set({ conn: Conn.Error, error: CONNECT_ERROR.dropped });
    return;
  }

  useGame.getState().set({ conn: Conn.Reconnecting });
  for (let attempt = 0; attempt < RECONNECT.attempts && !leaving; attempt++) {
    try {
      room = await colyseus.reconnect(token);
      adoptRoom(room);
      return;
    } catch {
      await sleep(RECONNECT.retryDelayMs);
    }
  }
  if (!leaving) useGame.getState().set({ conn: Conn.Error, error: CONNECT_ERROR.reconnectFailed });
}

// ── Outbound ──────────────────────────────────────────────────────────────────

export function sendReady(ready: boolean): void {
  room?.send(ClientMsg.Ready, { ready });
}

export function sendCosmetic(msg: CosmeticMessage): void {
  room?.send(ClientMsg.SetCosmetic, msg);
}

export function sendStart(): void {
  room?.send(ClientMsg.Start);
}

export function sendRestart(): void {
  room?.send(ClientMsg.Restart);
}

/** Host-only: trigger a random event (Golden Hammer / Heal orbs). */
export function sendEvent(kind: EventKind): void {
  room?.send(ClientMsg.Event, { kind });
}

/** Dead-player only: throw a prank (banana/bomb) at a random survivor. */
export function sendPrank(kind: PrankKind): void {
  room?.send(ClientMsg.Prank, { kind });
}

/** Host-only: pick the stage for the next match (lobby only). */
export function sendStage(stageId: StageId): void {
  room?.send(ClientMsg.SetStage, { stageId });
}

/** Send movement intent (a normalised vector). The server decides the outcome. */
export function sendInput(dx: number, dz: number): void {
  if (useGame.getState().conn !== Conn.Open) return;
  room?.send(ClientMsg.Input, { seq: ++inputSeq, dx, dz });
}

/** Ask to swing. The server gates cooldown and resolves any hits. */
export function sendAttack(): void {
  if (useGame.getState().conn !== Conn.Open) return;
  room?.send(ClientMsg.Attack, { seq: ++inputSeq });
}

export function leaveRoom(): void {
  leaving = true;
  void room?.leave();
  room = undefined;
  useGame.getState().reset();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Map whatever the server/transport threw into something a player can read. */
function friendlyError(e: unknown): string {
  const message = String((e as { message?: string })?.message ?? e ?? "");
  if (message.includes(JoinError.RoomFull)) return CONNECT_ERROR.roomFull;
  if (/not found|no rooms|seat|matchmak/i.test(message)) return CONNECT_ERROR.noSuchRoom;
  return CONNECT_ERROR.generic;
}
