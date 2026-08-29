import { Room, type Client } from "colyseus";
import { GameState } from "@hammer/shared/schema";
import {
  ClientMsg,
  JoinError,
  MAX_PLAYERS,
  RECONNECT_SECONDS,
  TICK_MS,
  GamePhase,
  type JoinOptions,
} from "@hammer/shared";
import { createLogger, type Logger } from "../logger";
import { MatchSimulation } from "../game/simulation";
import {
  cleanName,
  cosmeticSchema,
  eventSchema,
  inputSchema,
  prankSchema,
  readySchema,
  stageSchema,
} from "../net/validate";

/**
 * The Colyseus adapter: connections in, validated intents out.
 *
 * It deliberately knows nothing about hammers, zones or awards — every rule lives in
 * `MatchSimulation` (`src/game/`). This room only answers three questions:
 *   1. who is this connection (player / Host / a reconnect)?
 *   2. is what they sent well-formed and are they allowed to send it?
 *   3. when does the world tick?
 */
export class GameRoom extends Room<GameState> {
  /** the host occupies one slot on top of the player cap */
  maxClients = MAX_PLAYERS + 1;

  private sim!: MatchSimulation;
  private log: Logger = createLogger("room");

  onCreate(options?: JoinOptions) {
    const state = new GameState();
    this.setState(state);

    this.log = createLogger(`room ${this.roomId}`);
    this.sim = new MatchSimulation(
      state,
      (type, message) => this.broadcast(type, message),
      this.log,
    );
    if (options?.code) this.sim.setRoomCode(options.code);

    this.setSimulationInterval((deltaMs) => this.sim.step(deltaMs), TICK_MS);
    this.registerMessageHandlers();

    this.log.info(`created (code=${this.sim.roomCode || "—"})`);
  }

  // ── Message routing ─────────────────────────────────────────────────────────

  private registerMessageHandlers(): void {
    // Movement intent — the client says where it wants to go, the server decides.
    this.onMessage(ClientMsg.Input, (client, message) => {
      const parsed = inputSchema.safeParse(message);
      if (!parsed.success) return;
      const { dx, dz } = normalise(parsed.data.dx, parsed.data.dz);
      this.sim.setInput(client.sessionId, dx, dz);
    });

    this.onMessage(ClientMsg.Attack, (client) => this.sim.attack(client.sessionId));

    this.onMessage(ClientMsg.Ready, (client, message) => {
      const parsed = readySchema.safeParse(message);
      if (parsed.success) this.sim.setReady(client.sessionId, parsed.data.ready);
    });

    this.onMessage(ClientMsg.SetCosmetic, (client, message) => {
      const parsed = cosmeticSchema.safeParse(message);
      if (parsed.success) this.sim.setCosmetic(client.sessionId, parsed.data);
    });

    // Dead-player only (the sim enforces that) — lob a prank at a random survivor.
    this.onMessage(ClientMsg.Prank, (client, message) => {
      const parsed = prankSchema.safeParse(message);
      if (parsed.success) this.sim.prank(client.sessionId, parsed.data.kind);
    });

    this.onHostMessage(ClientMsg.Start, () => {
      if (this.sim.canStart) this.sim.beginMatch();
    });

    this.onHostMessage(ClientMsg.Restart, () => {
      if (this.sim.phase !== GamePhase.Lobby) this.sim.resetToLobby();
    });

    this.onHostMessage(ClientMsg.Event, (message) => {
      const parsed = eventSchema.safeParse(message);
      if (parsed.success) this.sim.triggerEvent(parsed.data.kind);
    });

    this.onHostMessage(ClientMsg.SetStage, (message) => {
      if (this.sim.phase !== GamePhase.Lobby) return;
      const parsed = stageSchema.safeParse(message);
      if (parsed.success) this.sim.selectStage(parsed.data.stageId);
    });
  }

  /** Register a handler that only the big-screen Host may trigger. */
  private onHostMessage(type: string, handle: (message: unknown) => void): void {
    this.onMessage(type, (client, message) => {
      if (!this.sim.isHost(client.sessionId)) return;
      handle(message);
    });
  }

  // ── Connection lifecycle ────────────────────────────────────────────────────

  onJoin(client: Client, options?: JoinOptions) {
    // The first connection asking to be Host becomes the director: not a player,
    // not counted, and the only one allowed to start/restart the match.
    if (options?.asHost && !this.sim.hasHost) {
      this.sim.claimHost(client.sessionId);
      if (!this.sim.roomCode && options.code) this.sim.setRoomCode(options.code);
      this.log.info(`+ HOST (${client.sessionId})`);
      return;
    }

    if (this.sim.isFull) throw new Error(JoinError.RoomFull);

    const player = this.sim.addPlayer(client.sessionId, cleanName(options?.name));
    this.log.info(
      `+ ${player.name} (${client.sessionId}) — ${this.sim.playerCount}/${MAX_PLAYERS}`,
    );
  }

  async onLeave(client: Client, consented?: boolean) {
    const { sessionId } = client;
    this.sim.clearInput(sessionId); // stop dead where they dropped

    if (this.sim.isHost(sessionId)) {
      this.sim.releaseHost();
      this.log.info("- HOST left");
      return;
    }

    if (!this.sim.hasPlayer(sessionId)) return;
    const name = this.sim.getPlayerName(sessionId);

    if (!consented && (await this.holdSeatForReconnect(client, name))) return;

    this.sim.removePlayer(sessionId);
    this.log.info(`- ${name} (${sessionId}) — ${this.sim.playerCount} remaining`);
    this.sim.checkWin();
  }

  /**
   * An unintended drop mid-match keeps the seat warm for a moment: party wifi blips,
   * and re-joining as a fresh corpse would be worse than a few seconds of standing
   * still. Returns true when the player made it back.
   */
  private async holdSeatForReconnect(client: Client, name: string): Promise<boolean> {
    const { sessionId } = client;
    if (this.sim.phase !== GamePhase.Playing || !this.sim.isAlive(sessionId)) return false;

    this.sim.setConnected(sessionId, false);
    this.log.info(`… ${name} dropped — holding seat ${RECONNECT_SECONDS}s`);
    try {
      await this.allowReconnection(client, RECONNECT_SECONDS);
      this.sim.setConnected(sessionId, true);
      this.log.info(`↩ ${name} reconnected`);
      return true;
    } catch {
      return false; // window expired — the caller removes them
    }
  }
}

/** Clamp a movement intent to the unit disc so nobody can out-run the walk speed. */
function normalise(dx: number, dz: number): { dx: number; dz: number } {
  const magnitude = Math.hypot(dx, dz);
  if (magnitude <= 1) return { dx, dz };
  return { dx: dx / magnitude, dz: dz / magnitude };
}
