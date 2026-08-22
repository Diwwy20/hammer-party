import { Room, type Client } from "colyseus";
import { GameState, Player } from "@hammer/shared/schema";
import {
  ARENA_RADIUS,
  BACKS,
  ClientMsg,
  FACES,
  HATS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  MOVE_SPEED,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  SPAWN_RADIUS,
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

  /** Latest movement intent per player (server-side only; never in the schema). */
  private inputs = new Map<string, { dx: number; dz: number }>();

  onCreate(options?: JoinOptions) {
    const state = new GameState();
    state.code = (options?.code ?? "").toUpperCase();
    this.setState(state);

    // Fixed-rate authoritative loop.
    this.setSimulationInterval((dt) => this.update(dt), 1000 / TICK_RATE);

    // Movement intent — the client sends only where it wants to go; the server
    // decides the outcome. Store the latest normalised vector; apply it in update().
    this.onMessage(ClientMsg.Input, (client, msg: InputMessage) => {
      if (!this.state.players.has(client.sessionId)) return;
      let dx = Number(msg?.dx) || 0;
      let dz = Number(msg?.dz) || 0;
      const mag = Math.hypot(dx, dz);
      if (mag > 1) {
        dx /= mag;
        dz /= mag;
      }
      this.inputs.set(client.sessionId, { dx, dz });
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
      this.spawnPlayers();
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
    this.inputs.delete(client.sessionId);
    if (client.sessionId === this.state.hostSessionId) {
      this.state.hostSessionId = "";
      console.log(`[room ${this.roomId}] - HOST left`);
      return;
    }
    this.state.players.delete(client.sessionId);
    console.log(`[room ${this.roomId}] - ${client.sessionId} — ${this.state.players.size} remaining`);
  }

  /** Scatter players on a ring facing the centre when the match begins. */
  private spawnPlayers() {
    const ids = [...this.state.players.keys()];
    const n = ids.length;
    ids.forEach((id, i) => {
      const p = this.state.players.get(id)!;
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      p.x = Math.cos(a) * SPAWN_RADIUS;
      p.z = Math.sin(a) * SPAWN_RADIUS;
      p.dir = Math.atan2(-p.x, -p.z); // look toward centre
      this.inputs.set(id, { dx: 0, dz: 0 });
    });
  }

  /** Authoritative movement step. */
  private update(deltaMs: number) {
    if (this.state.phase !== "playing") return;
    const dt = deltaMs / 1000;
    const maxR = ARENA_RADIUS - PLAYER_RADIUS;

    this.state.players.forEach((p, id) => {
      const input = this.inputs.get(id);
      if (!input || (input.dx === 0 && input.dz === 0)) return;

      let x = p.x + input.dx * MOVE_SPEED * dt;
      let z = p.z + input.dz * MOVE_SPEED * dt;

      // keep inside the arena
      const r = Math.hypot(x, z);
      if (r > maxR) {
        x = (x / r) * maxR;
        z = (z / r) * maxR;
      }

      p.x = x;
      p.z = z;
      p.dir = Math.atan2(input.dx, input.dz); // face the direction of travel
    });

    this.state.elapsedMs += deltaMs;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
