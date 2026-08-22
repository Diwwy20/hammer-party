import type { Room } from "colyseus.js";
import {
  ClientMsg,
  ROOM_NAME,
  ServerMsg,
  type CosmeticMessage,
  type DiedEvent,
  type EventKind,
  type HitEvent,
  type SwingEvent,
} from "@hammer/shared";
import { colyseus } from "./client";
import { useGame, type PickupView, type PlayerView } from "../store";
import { recordSnapshot, resetBuffer, type Pos } from "./movement";
import { markHit, markSwing, resetCombatFx } from "./combat";

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
  const g = useGame.getState();
  g.set({ conn: "connecting", isHost: !!opts.asHost, code: opts.code, error: undefined });
  leaving = false;
  joinedCode = opts.code;

  try {
    const joinOpts = { name: opts.name, asHost: opts.asHost, code: opts.code };
    room = opts.asHost
      ? await colyseus.create(ROOM_NAME, joinOpts)
      : await colyseus.join(ROOM_NAME, joinOpts);

    inputSeq = 0;
    resetBuffer();
    resetCombatFx();
    useGame.getState().set({
      conn: "open",
      roomId: room.roomId,
      sessionId: room.sessionId,
    });
    wireRoom(room);
  } catch (e: unknown) {
    console.error("[net] connect failed:", e);
    useGame.getState().set({ conn: "error", error: friendlyError(e) });
  }
}

/** Attach state + combat-event + leave handlers to a (freshly (re)connected) room. */
function wireRoom(r: Room): void {
  applyState(r.state);
  r.onStateChange(() => applyState(r.state));

  // Transient combat FX → the per-frame maps (never the store).
  r.onMessage(ServerMsg.Swing, (m: SwingEvent) => markSwing(m.id));
  r.onMessage(ServerMsg.Hit, (m: HitEvent) => markHit(m.id));
  r.onMessage(ServerMsg.Died, (_m: DiedEvent) => {
    /* death ragdoll is driven by the synced `alive` flag; nothing to flash here */
  });

  r.onLeave((code) => onRoomLeave(code));
}

/** Rebuild the render-friendly view on every state patch. Positions/dir feed the
 * interpolation buffer (read per-frame), NOT the store — that would re-render 20×/s. */
function applyState(state: any): void {
  const players: Record<string, PlayerView> = {};
  const pos: Record<string, Pos> = {};
  state.players?.forEach((p: any, key: string) => {
    players[key] = {
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
    };
    pos[key] = { x: p.x, z: p.z, dir: p.dir };
  });
  const pickups: Record<string, PickupView> = {};
  state.pickups?.forEach((pk: any, key: string) => {
    pickups[key] = { kind: pk.kind, x: pk.x, z: pk.z, active: pk.active };
  });
  recordSnapshot(pos);
  useGame.getState().set({
    players,
    pickups,
    phase: state.phase,
    code: state.code || joinedCode,
    hostSessionId: state.hostSessionId,
    winnerId: state.winnerId ?? "",
    arenaRadius: state.arenaRadius,
    zoneRadius: state.zoneRadius,
    stageTheme: state.stageTheme ?? "",
    eventBanner: state.eventBanner ?? "",
  });
}

/**
 * Handle an unexpected disconnect. A deliberate leave (or a normal close) drops
 * to the error screen; a mid-match drop tries to reconnect a few times so a phone
 * that blipped off the party wifi rejoins the same seat (server holds it open).
 */
async function onRoomLeave(code: number): Promise<void> {
  if (leaving) return;

  const g = useGame.getState();
  const wasPlaying = g.phase === "playing";
  const token = room?.reconnectionToken;

  // Normal close (1000) or nothing to reconnect into → just surface the drop.
  if (code === 1000 || !wasPlaying || !token) {
    useGame.getState().set({ conn: "error", error: "หลุดจากห้อง" });
    return;
  }

  useGame.getState().set({ conn: "reconnecting" });
  for (let attempt = 0; attempt < 6 && !leaving; attempt++) {
    try {
      const r = await colyseus.reconnect(token);
      room = r;
      inputSeq = 0;
      resetBuffer();
      resetCombatFx();
      useGame.getState().set({ conn: "open", roomId: r.roomId, sessionId: r.sessionId });
      wireRoom(r);
      return;
    } catch {
      await sleep(1500);
    }
  }
  if (!leaving) useGame.getState().set({ conn: "error", error: "กลับเข้าห้องไม่สำเร็จ" });
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

/** Send movement intent (a normalised vector). The server decides the outcome. */
export function sendInput(dx: number, dz: number): void {
  if (useGame.getState().conn !== "open") return;
  room?.send(ClientMsg.Input, { seq: ++inputSeq, dx, dz });
}

/** Ask to swing. The server gates cooldown and resolves any hits. */
export function sendAttack(): void {
  if (useGame.getState().conn !== "open") return;
  room?.send(ClientMsg.Attack, { seq: ++inputSeq });
}

export function leaveRoom(): void {
  leaving = true;
  void room?.leave();
  room = undefined;
  useGame.getState().reset();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function friendlyError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  if (msg.includes("room-full")) return "ห้องเต็มแล้ว (สูงสุด 25 คน)";
  if (/not found|no rooms|seat|matchmak/i.test(msg))
    return "ไม่พบห้องรหัสนี้ — ลองตรวจโค้ดอีกครั้ง";
  return "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง";
}
