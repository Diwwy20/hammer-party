import { Room, type Client } from "colyseus";
import { GameState, Pickup, Player } from "@hammer/shared/schema";
import {
  BACKS,
  ClientMsg,
  COLOSSEUM,
  DEFAULT_HAMMER,
  DEFAULT_STAGE_ID,
  EVENT_BANNER_MS,
  FACES,
  HAMMERS,
  HATS,
  HEAL_ORB_HP,
  HP_MAX,
  KNOCKBACK_DECAY,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  MOVE_SPEED,
  PICKUP_RADIUS,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  RECONNECT_SECONDS,
  ServerMsg,
  STAGES,
  TICK_RATE,
  WEAPON_RESPAWN_MS,
  zoneRadiusAt,
  type CosmeticMessage,
  type DiedEvent,
  type EventKind,
  type EventMessage,
  type HammerKind,
  type HitEvent,
  type InputMessage,
  type JoinOptions,
  type ReadyMessage,
  type StageConfig,
  type SwingEvent,
} from "@hammer/shared";

/** Per-player simulation state kept OUT of the synced schema (server-only). */
interface CombatState {
  vx: number; // knockback velocity (m/s), decays each tick
  vz: number;
  stunUntil: number; // frozen until this Date.now()
  lastAttackAt: number; // cooldown gate
  lastSlamAt: number; // wall-slam debounce
  kills: number;
}

/**
 * The one room. Phase 01 lobby + Phase 02 combat + Phase 03 arena/zone/weapons.
 *
 * The active STAGE is data (`shared/stages.ts`): it drives arena radius, spawns,
 * the shrinking safe-zone, weapon-pickup points and wall-slam tuning — so a future
 * map only swaps config, never combat code. The zone shrinks over the match and
 * accelerates late to force a finish; standing outside it bleeds HP. Fast/Heavy
 * hammers are map pickups; Golden Hammer + Heal orbs are events (auto + Host).
 */
export class GameRoom extends Room<GameState> {
  maxClients = MAX_PLAYERS + 1; // host occupies one slot on top of the player cap

  private inputs = new Map<string, { dx: number; dz: number }>();
  private combat = new Map<string, CombatState>();
  private aliveAtStart = 0;

  /** active stage config (data-driven). */
  private stage: StageConfig = COLOSSEUM;
  /** weapon pickup id → elapsedMs at which it respawns. */
  private pickupRespawnAt = new Map<string, number>();
  private eventPickupSeq = 0;
  private goldenFired = false;
  private healFired = false;
  private eventBannerUntil = 0;

  onCreate(options?: JoinOptions) {
    const state = new GameState();
    state.code = (options?.code ?? "").toUpperCase();
    this.setState(state);

    this.setSimulationInterval((dt) => this.update(dt), 1000 / TICK_RATE);

    // Movement intent — client sends where it wants to go; server decides.
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

    // Combat: attack intent → cooldown gate → cone hit test.
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
      if (typeof msg?.colorIndex === "number") p.colorIndex = clamp(msg.colorIndex, 0, PLAYER_COLORS.length - 1);
      if (typeof msg?.hatIndex === "number") p.hatIndex = clamp(msg.hatIndex, 0, HATS.length - 1);
      if (typeof msg?.faceIndex === "number") p.faceIndex = clamp(msg.faceIndex, 0, FACES.length - 1);
      if (typeof msg?.backIndex === "number") p.backIndex = clamp(msg.backIndex, 0, BACKS.length - 1);
    });

    // Host-only: begin the match.
    this.onMessage(ClientMsg.Start, (client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby") return;
      if (this.state.players.size < MIN_PLAYERS_TO_START) return;
      this.beginMatch();
    });

    // Host-only: end the match, back to lobby for a rematch.
    this.onMessage(ClientMsg.Restart, (client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase === "lobby") return;
      this.resetToLobby();
    });

    // Host-only: trigger a random event.
    this.onMessage(ClientMsg.Event, (client, msg: EventMessage) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "playing") return;
      if (msg?.kind === "golden" || msg?.kind === "heal") this.fireEvent(msg.kind);
    });

    console.log(`[room ${this.roomId}] created (code=${state.code || "—"})`);
  }

  onJoin(client: Client, options?: JoinOptions) {
    const asHost = !!options?.asHost;

    if (asHost && this.state.hostSessionId === "") {
      this.state.hostSessionId = client.sessionId;
      if (!this.state.code && options?.code) this.state.code = options.code.toUpperCase();
      console.log(`[room ${this.roomId}] + HOST (${client.sessionId})`);
      return;
    }

    if (this.state.players.size >= MAX_PLAYERS) throw new Error("room-full");

    const player = new Player();
    player.name = (options?.name ?? "player").toString().trim().slice(0, 16) || "player";
    this.state.players.set(client.sessionId, player);
    this.combat.set(client.sessionId, { vx: 0, vz: 0, stunUntil: 0, lastAttackAt: 0, lastSlamAt: 0, kills: 0 });
    console.log(`[room ${this.roomId}] + ${player.name} (${client.sessionId}) — ${this.state.players.size}/${MAX_PLAYERS}`);
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

    // Unintended drop mid-match: hold the seat for a reconnect (flaky party wifi).
    if (!consented && this.state.phase === "playing" && p.alive) {
      p.connected = false;
      console.log(`[room ${this.roomId}] … ${p.name} dropped — holding seat ${RECONNECT_SECONDS}s`);
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        p.connected = true;
        console.log(`[room ${this.roomId}] ↩ ${p.name} reconnected`);
        return;
      } catch {
        /* window expired — remove below */
      }
    }

    this.combat.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    console.log(`[room ${this.roomId}] - ${client.sessionId} — ${this.state.players.size} remaining`);
    this.checkWin();
  }

  // ── Combat ────────────────────────────────────────────────────────────────

  private handleAttack(id: string) {
    if (this.state.phase !== "playing") return;
    const attacker = this.state.players.get(id);
    const cs = this.combat.get(id);
    if (!attacker || !attacker.alive || !cs) return;

    const now = Date.now();
    if (now < cs.stunUntil) return;
    const hammer = HAMMERS[(attacker.hammer as HammerKind)] ?? HAMMERS[DEFAULT_HAMMER];
    if (now - cs.lastAttackAt < hammer.cooldownMs) return;
    cs.lastAttackAt = now;

    this.broadcast(ServerMsg.Swing, { id, hammer: attacker.hammer } as SwingEvent);

    const fx = Math.sin(attacker.dir);
    const fz = Math.cos(attacker.dir);
    const arcCos = Math.cos((hammer.arcDeg * Math.PI) / 180);

    this.state.players.forEach((target, tid) => {
      if (tid === id || !target.alive) return;
      const ddx = target.x - attacker.x;
      const ddz = target.z - attacker.z;
      const dist = Math.hypot(ddx, ddz);
      if (dist > hammer.reach || dist < 1e-4) return;
      if ((ddx * fx + ddz * fz) / dist < arcCos) return; // outside the swing cone

      target.hp = Math.max(0, target.hp - hammer.dmg);
      const tcs = this.combat.get(tid);
      if (tcs) {
        tcs.vx += (ddx / dist) * hammer.knockback;
        tcs.vz += (ddz / dist) * hammer.knockback;
        if (hammer.stunMs > 0) tcs.stunUntil = now + hammer.stunMs;
      }
      this.broadcast(ServerMsg.Hit, { id: tid, by: id, dmg: hammer.dmg, hp: target.hp } as HitEvent);
      if (target.hp <= 0) this.killPlayer(tid, id);
    });

    this.checkWin();
  }

  /** Flip a player to spectator. `by` = attacker id for a kill credit, "" for zone/wall. */
  private killPlayer(id: string, by: string) {
    const p = this.state.players.get(id);
    if (!p || !p.alive) return;
    p.alive = false;
    p.stunned = false;
    const cs = this.combat.get(id);
    if (cs) {
      cs.vx = 0;
      cs.vz = 0;
    }
    if (by) {
      const k = this.combat.get(by);
      if (k) k.kills += 1;
    }
    this.broadcast(ServerMsg.Died, { id, by } as DiedEvent);
    console.log(`[room ${this.roomId}] ☠ ${p.name} died (by ${by || "zone/wall"})`);
  }

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

  // ── Events / pickups ────────────────────────────────────────────────────────

  private fireEvent(kind: EventKind) {
    if (kind === "golden") {
      this.addEventPickup("golden", 0, 0);
      this.setBanner("⚡ ค้อนทองคำปรากฏกลางสนาม!");
    } else if (kind === "heal") {
      for (const [x, z] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) this.addEventPickup("heal", x, z);
      this.setBanner("💚 ออร์บพลังชีวิตปรากฏ!");
    }
  }

  private addEventPickup(kind: string, x: number, z: number) {
    const pk = new Pickup();
    pk.kind = kind;
    pk.x = x;
    pk.z = z;
    pk.active = true;
    this.state.pickups.set("e" + this.eventPickupSeq++, pk);
  }

  private setBanner(text: string) {
    this.state.eventBanner = text;
    this.eventBannerUntil = this.state.elapsedMs + EVENT_BANNER_MS;
  }

  private collect(p: Player, pk: Pickup, pid: string) {
    pk.active = false;
    if (pk.kind === "heal") {
      p.hp = Math.min(HP_MAX, p.hp + HEAL_ORB_HP);
    } else {
      p.hammer = pk.kind; // fast / heavy / golden
    }
    if (pk.kind === "fast" || pk.kind === "heavy") {
      this.pickupRespawnAt.set(pid, this.state.elapsedMs + WEAPON_RESPAWN_MS);
    } else {
      this.state.pickups.delete(pid); // event items are one-shot
    }
  }

  // ── Match lifecycle ─────────────────────────────────────────────────────────

  private beginMatch() {
    this.stage = STAGES[DEFAULT_STAGE_ID] ?? COLOSSEUM;
    this.state.stageId = this.stage.id;
    this.state.stageTheme = this.stage.theme;
    this.state.arenaRadius = this.stage.radius;
    this.state.zoneRadius = this.stage.radius;
    this.state.eventBanner = "";
    this.eventBannerUntil = 0;
    this.goldenFired = false;
    this.healFired = false;

    this.spawnWeaponPickups();
    this.spawnPlayers();

    this.state.phase = "playing";
    this.state.elapsedMs = 0;
    console.log(`[room ${this.roomId}] ▶ match started (${this.state.players.size} players, stage=${this.stage.id})`);
  }

  private spawnWeaponPickups() {
    this.state.pickups.clear();
    this.pickupRespawnAt.clear();
    this.eventPickupSeq = 0;
    this.stage.weaponSpawns.forEach((w, i) => {
      const pk = new Pickup();
      pk.kind = w.kind;
      pk.x = w.x;
      pk.z = w.z;
      pk.active = true;
      this.state.pickups.set("w" + i, pk);
    });
  }

  private spawnPlayers() {
    const ids = [...this.state.players.keys()];
    const n = ids.length;
    ids.forEach((id, i) => {
      const p = this.state.players.get(id)!;
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      p.x = Math.cos(a) * this.stage.spawnRadius;
      p.z = Math.sin(a) * this.stage.spawnRadius;
      p.dir = Math.atan2(-p.x, -p.z);
      p.hp = HP_MAX;
      p.alive = true;
      p.stunned = false;
      p.hammer = DEFAULT_HAMMER;
      this.inputs.set(id, { dx: 0, dz: 0 });
      this.combat.set(id, { vx: 0, vz: 0, stunUntil: 0, lastAttackAt: 0, lastSlamAt: 0, kills: 0 });
    });
    this.aliveAtStart = n;
    this.state.winnerId = "";
  }

  private resetToLobby() {
    this.state.phase = "lobby";
    this.state.elapsedMs = -1;
    this.state.winnerId = "";
    this.state.zoneRadius = this.state.arenaRadius;
    this.state.eventBanner = "";
    this.aliveAtStart = 0;
    this.inputs.clear();
    this.state.pickups.clear();
    this.pickupRespawnAt.clear();
    this.combat.forEach((cs) => {
      cs.vx = 0;
      cs.vz = 0;
      cs.stunUntil = 0;
      cs.lastAttackAt = 0;
      cs.lastSlamAt = 0;
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

  /** Authoritative step: movement + knockback + wall-slam + zone + pickups + events. */
  private update(deltaMs: number) {
    if (this.state.phase !== "playing") return;
    const dt = deltaMs / 1000;
    const maxR = this.stage.radius - PLAYER_RADIUS;
    const now = Date.now();
    const decay = Math.exp(-KNOCKBACK_DECAY * dt);
    const zone = this.stage.zone;

    // shrinking safe zone
    this.state.zoneRadius = zoneRadiusAt(zone, this.state.elapsedMs, this.stage.radius);
    const zoneR = this.state.zoneRadius;

    this.state.players.forEach((p, id) => {
      if (!p.alive) return;

      const cs = this.combat.get(id);
      const stunned = !!cs && now < cs.stunUntil;
      p.stunned = stunned;
      const kbSpeed = cs ? Math.hypot(cs.vx, cs.vz) : 0;

      let x = p.x;
      let z = p.z;

      // walk toward input unless frozen
      const input = this.inputs.get(id);
      if (!stunned && input && (input.dx !== 0 || input.dz !== 0)) {
        x += input.dx * MOVE_SPEED * dt;
        z += input.dz * MOVE_SPEED * dt;
        p.dir = Math.atan2(input.dx, input.dz);
      }

      // knockback velocity (decays)
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

      // clamp to the wall — a fast knockback into it is a wall-slam (extra dmg + stun)
      const r = Math.hypot(x, z);
      if (r > maxR) {
        x = (x / r) * maxR;
        z = (z / r) * maxR;
        if (cs && kbSpeed > this.stage.wallSlam.minSpeed && now - cs.lastSlamAt > 400) {
          cs.lastSlamAt = now;
          cs.vx = 0;
          cs.vz = 0;
          cs.stunUntil = now + this.stage.wallSlam.stunMs;
          p.hp = Math.max(0, p.hp - this.stage.wallSlam.dmg);
          this.broadcast(ServerMsg.Hit, { id, by: "", dmg: this.stage.wallSlam.dmg, hp: p.hp } as HitEvent);
          if (p.hp <= 0) {
            this.killPlayer(id, "");
            return;
          }
        }
      }

      p.x = x;
      p.z = z;

      // outside the safe zone: bleed HP
      if (Math.hypot(x, z) > zoneR) {
        p.hp = Math.max(0, p.hp - zone.dmgPerSec * dt);
        if (p.hp <= 0) {
          this.killPlayer(id, "");
          return;
        }
      }

      // pickups
      this.state.pickups.forEach((pk, pid) => {
        if (!pk.active) return;
        if (Math.hypot(x - pk.x, z - pk.z) <= PICKUP_RADIUS) this.collect(p, pk, pid);
      });
    });

    // weapon pickups respawn on their timer
    if (this.pickupRespawnAt.size) {
      this.pickupRespawnAt.forEach((at, pid) => {
        if (this.state.elapsedMs >= at) {
          const pk = this.state.pickups.get(pid);
          if (pk) pk.active = true;
          this.pickupRespawnAt.delete(pid);
        }
      });
    }

    // automatic events
    if (!this.goldenFired && this.state.elapsedMs >= 90_000) {
      this.goldenFired = true;
      this.fireEvent("golden");
    }
    if (!this.healFired && this.state.elapsedMs >= 150_000) {
      this.healFired = true;
      this.fireEvent("heal");
    }

    // clear a spent event banner
    if (this.state.eventBanner && this.state.elapsedMs > this.eventBannerUntil) this.state.eventBanner = "";

    this.state.elapsedMs += deltaMs;
    this.checkWin();
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
