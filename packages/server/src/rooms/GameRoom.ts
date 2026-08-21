import { Room, type Client } from "colyseus";
import { GameState, Player } from "@hammer/shared/schema";
import {
  ClientMsg,
  MAX_PLAYERS,
  TICK_RATE,
  type InputMessage,
  type JoinOptions,
  type ReadyMessage,
} from "@hammer/shared";

/**
 * The one and only room for Phase 00. It just proves the handshake:
 * players join, appear in shared state, and leave. No movement/combat yet —
 * that arrives in Phase 01 / 02. The simulation loop runs at TICK_RATE so the
 * scaffolding for authoritative sim is already in place.
 */
export class GameRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS;

  onCreate() {
    this.setState(new GameState());

    // Fixed-rate authoritative loop (empty for now).
    this.setSimulationInterval((dt) => this.update(dt), 1000 / TICK_RATE);

    // Movement intent — acknowledged now, applied in Phase 01.
    this.onMessage(ClientMsg.Input, (_client, _msg: InputMessage) => {
      /* Phase 01 */
    });

    // Lobby ready-toggle (ties into the Lobby screen design).
    this.onMessage(ClientMsg.Ready, (client, msg: ReadyMessage) => {
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = !!msg?.ready;
    });

    console.log(`[room ${this.roomId}] created (maxClients=${this.maxClients})`);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const player = new Player();
    player.name = (options?.name ?? "player").toString().slice(0, 16);
    this.state.players.set(client.sessionId, player);
    console.log(
      `[room ${this.roomId}] + ${player.name} (${client.sessionId}) — ${this.state.players.size}/${this.maxClients}`,
    );
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    console.log(`[room ${this.roomId}] - ${client.sessionId} — ${this.state.players.size} remaining`);
  }

  private update(_deltaMs: number) {
    // Phase 00: no simulation. Kept so the loop wiring is real from day one.
  }
}
