import {
  DEFAULT_HAMMER,
  GamePhase,
  HP_MAX,
  LOBBY_RADIUS,
  MATCH_MAX_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_FOR_WIN,
  MIN_PLAYERS_TO_START,
  findStage,
  type CosmeticMessage,
  type EventKind,
  type PrankKind,
} from "@hammer/shared";
import { GameState, NOT_STARTED_MS, NO_SESSION, Player } from "@hammer/shared/schema";
import type { Logger } from "../logger";
import { resolveAttack, resolvePrank } from "./combat";
import {
  createCombatState,
  createMatchBookkeeping,
  createSimContext,
  type Broadcaster,
  type SimContext,
} from "./context";
import { applyCosmetic } from "./cosmetics";
import { clearExpiredBanner, fireDueAutoEvents, fireEvent } from "./events";
import { clearHazards, stepHazards } from "./hazards";
import { stepLobby, stepMatch } from "./movement";
import { spawnStageWeapons } from "./pickups";
import { collectStatRows, computeAwards, computeStandings } from "./results";
import { spawnForMatch, spawnIntoLobby } from "./spawn";

/**
 * The authoritative game, with no networking in it.
 *
 * `GameRoom` owns the socket (who connected, what they sent, was it well-formed);
 * this class owns the world (what actually happens). Every rule lives in one of the
 * `game/` modules and is driven from here, so the room never touches game state
 * directly and the sim never touches a `Client`.
 */
export class MatchSimulation {
  private readonly ctx: SimContext;

  constructor(state: GameState, broadcast: Broadcaster, log: Logger) {
    this.ctx = createSimContext(state, broadcast, log);
    // the lobby is a walkable plaza — size the world to it until a match starts
    state.arenaRadius = LOBBY_RADIUS;
    state.zoneRadius = LOBBY_RADIUS;
    state.stageId = this.ctx.selectedStageId;
    state.stageTheme = this.ctx.stage.theme;
  }

  // ── Roster ────────────────────────────────────────────────────────────────

  get playerCount(): number {
    return this.ctx.state.players.size;
  }

  get isFull(): boolean {
    return this.playerCount >= MAX_PLAYERS;
  }

  /** Seat a new player in the plaza. Returns the schema object for logging. */
  addPlayer(id: string, name: string): Player {
    const player = new Player();
    player.name = name;
    this.ctx.state.players.set(id, player);
    this.ctx.combat.set(id, createCombatState());
    spawnIntoLobby(this.ctx, id);
    return player;
  }

  removePlayer(id: string): void {
    this.ctx.combat.delete(id);
    this.ctx.inputs.delete(id);
    this.ctx.state.players.delete(id);
  }

  hasPlayer(id: string): boolean {
    return this.ctx.state.players.has(id);
  }

  getPlayerName(id: string): string {
    return this.ctx.state.players.get(id)?.name ?? "";
  }

  /** Mark a held-open seat as (dis)connected while a reconnect window is running. */
  setConnected(id: string, connected: boolean): boolean {
    const player = this.ctx.state.players.get(id);
    if (!player) return false;
    player.connected = connected;
    return true;
  }

  isAlive(id: string): boolean {
    return this.ctx.state.players.get(id)?.alive ?? false;
  }

  // ── Host / room ───────────────────────────────────────────────────────────

  get phase(): GamePhase {
    return this.ctx.state.phase;
  }

  isHost(id: string): boolean {
    return this.ctx.state.hostSessionId === id;
  }

  get hasHost(): boolean {
    return this.ctx.state.hostSessionId !== NO_SESSION;
  }

  claimHost(id: string): void {
    this.ctx.state.hostSessionId = id;
  }

  releaseHost(): void {
    this.ctx.state.hostSessionId = NO_SESSION;
  }

  get roomCode(): string {
    return this.ctx.state.code;
  }

  setRoomCode(code: string): void {
    this.ctx.state.code = code.toUpperCase();
  }

  // ── Player intents ────────────────────────────────────────────────────────

  /** Store a movement intent. `dx/dz` must already be a unit-ish vector. */
  setInput(id: string, dx: number, dz: number): void {
    if (!this.hasPlayer(id)) return;
    this.ctx.inputs.set(id, { dx, dz });
  }

  /** Forget a movement intent — a disconnected player must not keep sliding. */
  clearInput(id: string): void {
    this.ctx.inputs.delete(id);
  }

  setReady(id: string, ready: boolean): void {
    const player = this.ctx.state.players.get(id);
    if (player) player.ready = ready;
  }

  setCosmetic(id: string, choice: CosmeticMessage): void {
    const player = this.ctx.state.players.get(id);
    if (player) applyCosmetic(player, choice);
  }

  attack(id: string): void {
    resolveAttack(this.ctx, id);
    if (this.ctx.state.phase === GamePhase.Playing) this.checkWin();
  }

  prank(id: string, kind: PrankKind): void {
    resolvePrank(this.ctx, id, kind);
  }

  // ── Host intents ──────────────────────────────────────────────────────────

  get canStart(): boolean {
    return this.ctx.state.phase === GamePhase.Lobby && this.playerCount >= MIN_PLAYERS_TO_START;
  }

  /** Pick the stage for the NEXT match. Ignores an unknown id. */
  selectStage(stageId: string): void {
    const stage = findStage(stageId);
    if (!stage) return;
    this.ctx.selectedStageId = stage.id;
    this.ctx.state.stageId = stage.id;
    this.ctx.state.stageTheme = stage.theme;
  }

  triggerEvent(kind: EventKind): void {
    if (this.ctx.state.phase !== GamePhase.Playing) return;
    fireEvent(this.ctx, kind);
  }

  // ── Match lifecycle ───────────────────────────────────────────────────────

  beginMatch(): void {
    const { ctx } = this;
    ctx.match = createMatchBookkeeping();
    ctx.stage = findStage(ctx.selectedStageId) ?? ctx.stage;

    ctx.state.stageId = ctx.stage.id;
    ctx.state.stageTheme = ctx.stage.theme;
    ctx.state.arenaRadius = ctx.stage.radius;
    ctx.state.zoneRadius = ctx.stage.radius;
    ctx.state.activeEvent = NO_SESSION;
    ctx.state.awardsJson = "";
    ctx.state.standingsJson = "";
    ctx.state.elapsedMs = 0;

    clearHazards(ctx);
    spawnStageWeapons(ctx);
    ctx.match.aliveAtStart = spawnForMatch(ctx);

    ctx.state.phase = GamePhase.Playing;
    ctx.log.info(`▶ match started (${ctx.match.aliveAtStart} players, stage=${ctx.stage.id})`);
  }

  /** Send everyone back to the plaza for a rematch. */
  resetToLobby(): void {
    const { ctx } = this;
    ctx.match = createMatchBookkeeping();
    ctx.state.phase = GamePhase.Lobby;
    ctx.state.elapsedMs = NOT_STARTED_MS;
    ctx.state.winnerId = NO_SESSION;
    ctx.state.arenaRadius = LOBBY_RADIUS;
    ctx.state.zoneRadius = LOBBY_RADIUS;
    ctx.state.activeEvent = NO_SESSION;
    ctx.state.awardsJson = "";
    ctx.state.standingsJson = "";
    ctx.state.pickups.clear();
    clearHazards(ctx);
    ctx.inputs.clear();

    ctx.state.players.forEach((player, id) => {
      player.hp = HP_MAX;
      player.alive = true;
      player.stunned = false;
      player.ready = false;
      player.hammer = DEFAULT_HAMMER;
      player.kills = 0;
      ctx.combat.set(id, createCombatState());
      spawnIntoLobby(ctx, id); // re-scatter across the plaza
    });

    ctx.log.info("↺ reset to lobby");
  }

  /** One authoritative tick. Dispatches on phase; `ended` freezes the world. */
  step(deltaMs: number): void {
    if (this.ctx.state.phase === GamePhase.Lobby) {
      stepLobby(this.ctx, deltaMs);
      return;
    }
    if (this.ctx.state.phase !== GamePhase.Playing) return;

    stepMatch(this.ctx, deltaMs);
    stepHazards(this.ctx);
    fireDueAutoEvents(this.ctx);
    clearExpiredBanner(this.ctx);

    if (this.enforceTimeLimit()) return;
    this.checkWin();
  }

  /**
   * End the match once one player (or nobody) is left standing. A match that never
   * had a real field can't be "won" — that keeps a solo test from ending instantly.
   */
  checkWin(): void {
    const { ctx } = this;
    if (ctx.state.phase !== GamePhase.Playing) return;
    if (ctx.match.aliveAtStart < MIN_PLAYERS_FOR_WIN) return;

    let aliveCount = 0;
    let lastAlive = NO_SESSION;
    ctx.state.players.forEach((player, id) => {
      if (!player.alive) return;
      aliveCount++;
      lastAlive = id;
    });

    if (aliveCount > 1) return;
    this.endMatch(aliveCount === 1 ? lastAlive : NO_SESSION);
  }

  /**
   * Failsafe for the documented hard cap: the shrinking zone should always finish a
   * match long before this, so reaching it means something went wrong. The healthiest
   * survivor takes the win rather than letting the room hang forever.
   */
  private enforceTimeLimit(): boolean {
    const { ctx } = this;
    if (ctx.state.elapsedMs < MATCH_MAX_MS) return false;

    let winnerId = NO_SESSION;
    let bestHp = -1;
    ctx.state.players.forEach((player, id) => {
      if (player.alive && player.hp > bestHp) {
        bestHp = player.hp;
        winnerId = id;
      }
    });

    ctx.log.info(`⏱ hard time cap reached (${MATCH_MAX_MS}ms) — ending the match`);
    this.endMatch(winnerId);
    return true;
  }

  /** Freeze the world, compute the results, and switch everyone to the Results screen. */
  private endMatch(winnerId: string): void {
    const { ctx } = this;
    ctx.state.winnerId = winnerId;

    const rows = collectStatRows(ctx);
    ctx.state.awardsJson = JSON.stringify(
      computeAwards(rows, {
        firstBloodName: ctx.match.firstBloodName,
        winnerId,
        matchDurationMs: ctx.state.elapsedMs,
      }),
    );
    ctx.state.standingsJson = JSON.stringify(computeStandings(rows, winnerId));
    ctx.state.phase = GamePhase.Ended;

    const winnerName = winnerId === NO_SESSION ? "—" : this.getPlayerName(winnerId);
    ctx.log.info(`🏆 match ended — winner: ${winnerName}`);
  }
}
