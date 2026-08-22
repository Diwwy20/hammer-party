import { Room, type Client } from "colyseus";
import { GameState, Player } from "@hammer/shared/schema";
import {
  BACKS,
  ClientMsg,
  FACES,
  HATS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PLAYER_COLORS,
  TICK_RATE,
  type CosmeticMessage,
  type InputMessage,
  type JoinOptions,
  type ReadyMessage,
} from "@hammer/shared";

/**
 * The one room. Phase 01 (lobby slice): players join by code, appear in shared
 * state, ready-up and pick cosmetics; an invisible Host (the big screen) starts
 * the match. Movement/combat arrive later — the sim loop already runs at
 * TICK_RATE so the authoritative wiring is real from day one.
 *
 * Host model: the big-screen client joins with `asHost:true`. It is the room's
 * director — NOT a player, not in `state.players`, not counted toward MAX_PLAYERS,
 * and the only one allowed to Start.
 */
export class GameRoom extends Room<GameState> {
  // host occupies one connection slot on top of the player cap
  maxClients = MAX_PLAYERS + 1;

  onCreate(options?: JoinOptions) {
    const state = new GameState();
    state.code = (options?.code ?? "").toUpperCase();
    this.setState(state);

    // Fixed-rate authoritative loop (empty until movement lands).
    this.setSimulationInterval((dt) => this.update(dt), 1000 / TICK_RATE);

    // Movement intent — acknowledged now, applied when movement lands.
    this.onMessage(ClientMsg.Input, (_client, _msg: InputMessage) => {
      /* later */
    });

    // Lobby: ready toggle.
    this.onMessage(ClientMsg.Ready, (client, msg: ReadyMessage) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = !!msg?.ready;
    });

    // Lobby: cosmetic pick (no stats). Clamp so a bad client can't set junk.
    this.onMessage(ClientMsg.SetCosmetic, (client, msg: CosmeticMessage) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (typeof msg?.colorIndex === "number") {
        p.colorIndex = clamp(msg.colorIndex, 0, PLAYER_COLORS.length - 1);
      }
      if (typeof msg?.hatIndex === "number") {
        p.hatIndex = clamp(msg.hatIndex, 0, HATS.length - 1);
      }
      if (typeof msg?.faceIndex === "number") {
        p.faceIndex = clamp(msg.faceIndex, 0, FACES.length - 1);
      }
      if (typeof msg?.backIndex === "number") {
        p.backIndex = clamp(msg.backIndex, 0, BACKS.length - 1);
      }
    });

    // Host-only: begin the match.
    this.onMessage(ClientMsg.Start, (client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby") return;
      if (this.state.players.size < MIN_PLAYERS_TO_START) return;
      this.state.phase = "playing";
      this.state.elapsedMs = 0;
      console.log(`[room ${this.roomId}] ▶ match started (${this.state.players.size} players)`);
    });

    console.log(`[room ${this.roomId}] created (code=${state.code || "—"})`);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const asHost = !!options?.asHost;

    // First host to arrive claims the director slot (not a player).
    if (asHost && this.state.hostSessionId === "") {
      this.state.hostSessionId = client.sessionId;
      if (!this.state.code && options?.code) this.state.code = options.code.toUpperCase();
      console.log(`[room ${this.roomId}] + HOST (${client.sessionId})`);
      return;
    }

    // Otherwise: a player. Enforce the player cap (host is separate).
    if (this.state.players.size >= MAX_PLAYERS) {
      throw new Error("room-full");
    }

    const player = new Player();
    player.name = (options?.name ?? "player").toString().trim().slice(0, 16) || "player";
    this.state.players.set(client.sessionId, player);
    console.log(
      `[room ${this.roomId}] + ${player.name} (${client.sessionId}) — ${this.state.players.size}/${MAX_PLAYERS}`,
    );
  }

  onLeave(client: Client) {
    if (client.sessionId === this.state.hostSessionId) {
      this.state.hostSessionId = "";
      console.log(`[room ${this.roomId}] - HOST left`);
      return;
    }
    this.state.players.delete(client.sessionId);
    console.log(`[room ${this.roomId}] - ${client.sessionId} — ${this.state.players.size} remaining`);
  }

  private update(_deltaMs: number) {
    // No simulation yet. Kept so the loop wiring is real from day one.
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
