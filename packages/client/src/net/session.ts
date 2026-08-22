import type { Room } from "colyseus.js";
import { ClientMsg, ROOM_NAME, type CosmeticMessage } from "@hammer/shared";
import { colyseus } from "./client";
import { useGame, type PlayerView } from "../store";
import { recordSnapshot, resetBuffer, type Pos } from "./movement";

/** The live room. Kept module-level (non-serialisable) — never put it in the store. */
let room: Room | undefined;
let inputSeq = 0;

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

  try {
    const joinOpts = { name: opts.name, asHost: opts.asHost, code: opts.code };
    room = opts.asHost
      ? await colyseus.create(ROOM_NAME, joinOpts)
      : await colyseus.join(ROOM_NAME, joinOpts);

    inputSeq = 0;
    resetBuffer();
    useGame.getState().set({
      conn: "open",
      roomId: room.roomId,
      sessionId: room.sessionId,
    });

    // Rebuild the render-friendly view on every state patch. Cheap for 25
    // players @ 20Hz; granular callbacks can come later if profiling asks.
    // Positions/dir go to the interpolation buffer (read per-frame in the game),
    // NOT the zustand store — that would re-render React 20×/s.
    const apply = (state: any) => {
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
        };
        pos[key] = { x: p.x, z: p.z, dir: p.dir };
      });
      recordSnapshot(pos);
      useGame.getState().set({
        players,
        phase: state.phase,
        code: state.code || opts.code,
        hostSessionId: state.hostSessionId,
      });
    };
    apply(room.state);
    room.onStateChange(() => apply(room!.state));
    room.onLeave(() => useGame.getState().set({ conn: "error", error: "หลุดจากห้อง" }));
  } catch (e: unknown) {
    console.error("[net] connect failed:", e);
    useGame.getState().set({ conn: "error", error: friendlyError(e) });
  }
}

export function sendReady(ready: boolean): void {
  room?.send(ClientMsg.Ready, { ready });
}

export function sendCosmetic(msg: CosmeticMessage): void {
  room?.send(ClientMsg.SetCosmetic, msg);
}

export function sendStart(): void {
  room?.send(ClientMsg.Start);
}

/** Send movement intent (a normalised vector). The server decides the outcome. */
export function sendInput(dx: number, dz: number): void {
  room?.send(ClientMsg.Input, { seq: ++inputSeq, dx, dz });
}

export function leaveRoom(): void {
  void room?.leave();
  room = undefined;
  useGame.getState().reset();
}

function friendlyError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  if (msg.includes("room-full")) return "ห้องเต็มแล้ว (สูงสุด 25 คน)";
  if (/not found|no rooms|seat|matchmak/i.test(msg))
    return "ไม่พบห้องรหัสนี้ — ลองตรวจโค้ดอีกครั้ง";
  return "เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง";
}
