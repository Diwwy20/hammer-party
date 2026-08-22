import { Room, type Client } from "colyseus";
import { GameState, Player } from "@hammer/shared/schema";
import {
  ARENA_RADIUS,
  BACKS,
  ClientMsg,
  DEFAULT_HAMMER,
  FACES,
  HAMMERS,
  HATS,
  HP_MAX,
  KNOCKBACK_DECAY,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  MOVE_SPEED,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  RECONNECT_SECONDS,
  ServerMsg,
  SPAWN_RADIUS,
  TICK_RATE,
  type CosmeticMessage,
  type DiedEvent,
  type HammerKind,
  type HitEvent,
  type InputMessage,
  type JoinOptions,
  type ReadyMessage,
  type SwingEvent,
} from "@hammer/shared";

/** Per-player simulation state kept OUT of the synced schema (server-only). */
interface CombatState {
  /** knockback velocity (m/s), decays every tick */
  vx: number;
  vz: number;
  /** frozen until this Date.now() timestamp (heavy-hammer stun) */
  stunUntil: number;
  /** last swing time for cooldown gating */
  lastAttackAt: number;
  /** kills this match (awards live in Phase 04; tracked cheaply now) */
  kills: number;
}

/**
 * The one room. Lobby slice (Phase 01): players join by code, ready-up, pick
 * cosmetics; an invisible Host starts the match. Phase 02 adds combat: attacks
 * resolve on the server (reach + swing arc), damage/knockback/stun apply, death
 * flips a player to spectator, and the last one standing ends the match.
 *
 * Host model: the big-screen client joins with `asHost:true`. It is the room's
 * director — NOT a player, not in `state.players`, not counted toward MAX_PLAYERS,
 * and the only one allowed to Start / Restart.
 */
export class GameRoom extends Room<GameState> {
  // host occupies one connection slot on top of the player cap
  maxClients = MAX_PLAYERS + 1;

  /** Latest movement intent per player (server-side only; never in the schema). */
  private inputs = new Map<string, { dx: number; dz: number }>();

  /** Server-only combat sim state per player (velocity, stun, cooldown, kills). */
  private combat = new Map<string, CombatState>();

  /** How many players were alive at the whistle — guards the win check for solo tests. */
  private aliveAtStart = 0;

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

    // Combat: attack intent. The server gates cooldown, then resolves the swing.
    this.onMessage(ClientMsg.Attack, (client) => this.handleAttack(client.sessionId));

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

    // Host-only: end the match and drop everyone back to the lobby for a rematch.
    this.onMessage(ClientMsg.Restart, (client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase === "lobby") return;
      this.resetToLobby();
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
    this.combat.set(client.sessionId, { vx: 0, vz: 0, stunUntil: 0, lastAttackAt: 0, kills: 0 });
    console.log(
      `[room ${this.roomId}] + ${player.name} (${client.sessionId}) — ${this.state.players.size}/${MAX_PLAYERS}`,
    );
  }

  async onLeave(client: Client, consented?: boolean) {
    this.inputs.delete(client.sessionId);

    if (client.sessionId === this.state.hostSessionId) {
      this.state.hostSessionId = "";
      console.log(`[room ${this.roomId}] - HOST left`);
      return;
    }

    const p = this.state.players.get(client.sessionId);
    if (!p) return;

    // An unintended drop mid-match: hold the seat open briefly so the phone can
    // reconnect (spotty party wifi). A deliberate "leave" (consented) skips this.
    if (!consented && this.state.phase === "playing" && p.alive) {
      p.connected = false;
      console.log(`[room ${this.roomId}] … ${p.name} dropped — holding seat ${RECONNECT_SECONDS}s`);
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        p.connected = true;
        console.log(`[room ${this.roomId}] ↩ ${p.name} reconnected`);
        return;
      } catch {
        // reconnection window expired — fall through and remove them
      }
    }

    this.combat.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    console.log(`[room ${this.roomId}] - ${client.sessionId} — ${this.state.players.size} remaining`);
    this.checkWin();
  }

  // ── Combat ────────────────────────────────────────────────────────────────

  /** Resolve one attack: cooldown gate → cone hit test → damage/knockback/stun. */
  private handleAttack(id: string) {
    if (this.state.phase !== "playing") return;
    const attacker = this.state.players.get(id);
    const cs = this.combat.get(id);
    if (!attacker || !attacker.alive || !cs) return;

    const now = Date.now();
    if (now < cs.stunUntil) return; // can't swing while stunned
    const hammer = HAMMERS[(attacker.hammer as HammerKind)] ?? HAMMERS[DEFAULT_HAMMER];
    if (now - cs.lastAttackAt < hammer.cooldownMs) return;
    cs.lastAttackAt = now;

    // Everyone animates the swing (client-only visual).
    this.broadcast(ServerMsg.Swing, { id, hammer: attacker.hammer } as SwingEvent);

    // Attacker's facing as a forward unit vector (dir = atan2(dx, dz)).
    const fx = Math.sin(attacker.dir);
    const fz = Math.cos(attacker.dir);
    const arcCos = Math.cos((hammer.arcDeg * Math.PI) / 180);

    this.state.players.forEach((target, tid) => {
      if (tid === id || !target.alive) return;
      const ddx = target.x - attacker.x;
      const ddz = target.z - attacker.z;
      const dist = Math.hypot(ddx, ddz);
      if (dist > hammer.reach || dist < 1e-4) return;
      // inside the swing cone?
      const facing = (ddx * fx + ddz * fz) / dist;
      if (facing < arcCos) return;

      target.hp = Math.max(0, target.hp - hammer.dmg);

      const tcs = this.combat.get(tid);
      if (tcs) {
        // impulse away from the attacker
        tcs.vx += (ddx / dist) * hammer.knockback;
        tcs.vz += (ddz / dist) * hammer.knockback;
        if (hammer.stunMs > 0) tcs.stunUntil = now + hammer.stunMs;
      }

      this.broadcast(ServerMsg.Hit, {
        id: tid,
        by: id,
        dmg: hammer.dmg,
        hp: target.hp,
      } as HitEvent);

      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        target.stunned = false;
        cs.kills += 1;
        this.broadcast(ServerMsg.Died, { id: tid, by: id } as DiedEvent);
        console.log(`[room ${this.roomId}] ☠ ${target.name} defeated by ${attacker.name}`);
      }
    });

    this.checkWin();
  }

  /** Last one standing ends the match. Skipped for solo (<2) test rooms. */
  private checkWin() {
    if (this.state.phase !== "playing") return;
    if (this.aliveAtStart < 2) return;

    let aliveCount = 0;
    let last = "";
    this.state.players.forEach((p, pid) => {
      if (p.alive) {
        aliveCount++;
        last = pid;
      }
    });

    if (aliveCount <= 1) {
      this.state.winnerId = aliveCount === 1 ? last : "";
      this.state.phase = "ended";
      const w = this.state.players.get(last);
      console.log(`[room ${this.roomId}] 🏆 match ended — winner: ${w?.name ?? "—"}`);
    }
  }

  // ── Match lifecycle ─────────────────────────────────────────────────────────

  /** Scatter players on a ring facing centre and give everyone a fresh loadout. */
  private spawnPlayers() {
    const ids = [...this.state.players.keys()];
    const n = ids.length;
    ids.forEach((id, i) => {
      const p = this.state.players.get(id)!;
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      p.x = Math.cos(a) * SPAWN_RADIUS;
      p.z = Math.sin(a) * SPAWN_RADIUS;
      p.dir = Math.atan2(-p.x, -p.z); // look toward centre
      p.hp = HP_MAX;
      p.alive = true;
      p.stunned = false;
      p.hammer = DEFAULT_HAMMER;
      this.inputs.set(id, { dx: 0, dz: 0 });
      this.combat.set(id, { vx: 0, vz: 0, stunUntil: 0, lastAttackAt: 0, kills: 0 });
    });
    this.aliveAtStart = n;
    this.state.winnerId = "";
  }

  /** Back to the lobby for a rematch — keep players/cosmetics, reset combat + ready. */
  private resetToLobby() {
    this.state.phase = "lobby";
    this.state.elapsedMs = -1;
    this.state.winnerId = "";
    this.aliveAtStart = 0;
    this.inputs.clear();
    this.combat.forEach((cs) => {
      cs.vx = 0;
      cs.vz = 0;
      cs.stunUntil = 0;
      cs.lastAttackAt = 0;
      cs.kills = 0;
    });
    this.state.players.forEach((p) => {
      p.hp = HP_MAX;
      p.alive = true;
      p.stunned = false;
      p.ready = false;
      p.hammer = DEFAULT_HAMMER;
    });
    console.log(`[room ${this.roomId}] ↺ reset to lobby`);
  }

  /** Authoritative movement + knockback step. */
  private update(deltaMs: number) {
    if (this.state.phase !== "playing") return;
    const dt = deltaMs / 1000;
    const maxR = ARENA_RADIUS - PLAYER_RADIUS;
    const now = Date.now();
    const decay = Math.exp(-KNOCKBACK_DECAY * dt);

    this.state.players.forEach((p, id) => {
      if (!p.alive) return; // the dead don't move (client-only ragdoll takes over)

      const cs = this.combat.get(id);
      const stunned = !!cs && now < cs.stunUntil;
      p.stunned = stunned;

      let x = p.x;
      let z = p.z;

      // walk toward the input, unless frozen
      const input = this.inputs.get(id);
      if (!stunned && input && (input.dx !== 0 || input.dz !== 0)) {
        x += input.dx * MOVE_SPEED * dt;
        z += input.dz * MOVE_SPEED * dt;
        p.dir = Math.atan2(input.dx, input.dz); // face direction of travel
      }

      // knockback velocity (decays toward zero)
      if (cs && (cs.vx !== 0 || cs.vz !== 0)) {
        x += cs.vx * dt;
        z += cs.vz * dt;
        cs.vx *= decay;
        cs.vz *= decay;
        if (Math.hypot(cs.vx, cs.vz) < 0.05) {
          cs.vx = 0;
          cs.vz = 0;
        }
      }

      // keep inside the arena
      const r = Math.hypot(x, z);
      if (r > maxR) {
        x = (x / r) * maxR;
        z = (z / r) * maxR;
      }

      p.x = x;
      p.z = z;
    });

    this.state.elapsedMs += deltaMs;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
