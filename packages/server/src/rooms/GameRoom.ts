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
  LOBBY_RADIUS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  MOVE_SPEED,
  PICKUP_RADIUS,
  PLAYER_COLORS,
  PLAYER_RADIUS,
  PRANK,
  RECONNECT_SECONDS,
  ServerMsg,
  STAGES,
  TICK_RATE,
  WEAPON_RESPAWN_MS,
  zoneRadiusAt,
  type DiedEvent,
  type EventKind,
  type HammerKind,
  type HitEvent,
  type JoinOptions,
  type PrankEvent,
  type PrankKind,
  type StageConfig,
  type SwingEvent,
} from "@hammer/shared";
import { cleanName, cosmeticSchema, eventSchema, inputSchema, prankSchema, readySchema, stageSchema } from "../validate";

/** Per-player simulation state kept OUT of the synced schema (server-only). */
interface CombatState {
  vx: number; // knockback velocity (m/s), decays each tick
  vz: number;
  stunUntil: number; // frozen until this Date.now()
  lastAttackAt: number; // cooldown gate
  lastSlamAt: number; // wall-slam debounce
  lastPrankAt: number; // spectator prank cooldown
  damageDealt: number; // total dmg dealt (awards: pacifist)
  wallSlamsTaken: number; // times slammed into a wall (awards)
  diedAtMs: number; // elapsedMs when they died, -1 while alive (awards: survivor)
}

/** One end-of-match award shown on the Results screen. */
interface Award {
  icon: string;
  label: string;
  name: string;
  detail: string;
}

/** One row of the end-of-match standings (ranked winner-first). */
interface Standing {
  place: number;
  name: string;
  colorIndex: number;
  kills: number;
  dmg: number;
}

const freshCombat = (): CombatState => ({
  vx: 0,
  vz: 0,
  stunUntil: 0,
  lastAttackAt: 0,
  lastSlamAt: 0,
  lastPrankAt: 0,
  damageDealt: 0,
  wallSlamsTaken: 0,
  diedAtMs: -1,
});

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
  /** stage the Host picked for the NEXT match (applied in beginMatch). */
  private selectedStageId: string = DEFAULT_STAGE_ID;
  /** weapon pickup id → elapsedMs at which it respawns. */
  private pickupRespawnAt = new Map<string, number>();
  private eventPickupSeq = 0;
  private goldenFired = false;
  private healFired = false;
  private eventBannerUntil = 0;
  /** name of whoever drew first blood this match (awards); "" until the first kill. */
  private firstBloodName = "";

  onCreate(options?: JoinOptions) {
    const state = new GameState();
    state.code = (options?.code ?? "").toUpperCase();
    // the lobby is a walkable plaza — size the world to LOBBY_RADIUS until a match starts
    state.arenaRadius = LOBBY_RADIUS;
    state.zoneRadius = LOBBY_RADIUS;
    // stageId reflects the Host's picker choice; the lobby's own look is fixed client-side
    state.stageId = this.selectedStageId;
    state.stageTheme = this.stage.theme;
    this.setState(state);

    this.setSimulationInterval((dt) => this.update(dt), 1000 / TICK_RATE);

    // Movement intent — client sends where it wants to go; server decides.
    // Zod-validated at the edge (Phase 04): a bad shape is dropped, not coerced.
    this.onMessage(ClientMsg.Input, (client, msg) => {
      if (!this.state.players.has(client.sessionId)) return;
      const parsed = inputSchema.safeParse(msg);
      if (!parsed.success) return;
      let { dx, dz } = parsed.data;
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
    this.onMessage(ClientMsg.Ready, (client, msg) => {
      const parsed = readySchema.safeParse(msg);
      if (!parsed.success) return;
      const p = this.state.players.get(client.sessionId);
      if (p) p.ready = parsed.data.ready;
    });

    // Lobby: cosmetic pick (no stats). Validate + clamp so a bad client can't set junk.
    this.onMessage(ClientMsg.SetCosmetic, (client, msg) => {
      const parsed = cosmeticSchema.safeParse(msg);
      if (!parsed.success) return;
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const c = parsed.data;
      if (c.colorIndex !== undefined) p.colorIndex = clamp(c.colorIndex, 0, PLAYER_COLORS.length - 1);
      if (c.hatIndex !== undefined) p.hatIndex = clamp(c.hatIndex, 0, HATS.length - 1);
      if (c.faceIndex !== undefined) p.faceIndex = clamp(c.faceIndex, 0, FACES.length - 1);
      if (c.backIndex !== undefined) p.backIndex = clamp(c.backIndex, 0, BACKS.length - 1);
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
    this.onMessage(ClientMsg.Event, (client, msg) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "playing") return;
      const parsed = eventSchema.safeParse(msg);
      if (parsed.success) this.fireEvent(parsed.data.kind);
    });

    // Dead-player only: lob a prank at a random survivor.
    this.onMessage(ClientMsg.Prank, (client, msg) => {
      const parsed = prankSchema.safeParse(msg);
      if (parsed.success) this.handlePrank(client.sessionId, parsed.data.kind);
    });

    // Host-only: pick the stage for the next match (lobby only).
    this.onMessage(ClientMsg.SetStage, (client, msg) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== "lobby") return;
      const parsed = stageSchema.safeParse(msg);
      if (!parsed.success || !STAGES[parsed.data.stageId]) return;
      this.selectedStageId = parsed.data.stageId;
      const s = STAGES[this.selectedStageId];
      this.state.stageId = s.id;
      this.state.stageTheme = s.theme;
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
    player.name = cleanName(options?.name);
    this.state.players.set(client.sessionId, player);
    this.combat.set(client.sessionId, freshCombat());
    this.spawnLobbyPlayer(client.sessionId); // drop them into the plaza (not at 0,0)
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
    // Attacks fire in the lobby too (playful bonks) and during a match.
    const playing = this.state.phase === "playing";
    if (!playing && this.state.phase !== "lobby") return;
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

      // Knockback + stun always land (the satisfying bonk); damage only in a match.
      const tcs = this.combat.get(tid);
      if (tcs) {
        tcs.vx += (ddx / dist) * hammer.knockback;
        tcs.vz += (ddz / dist) * hammer.knockback;
        if (hammer.stunMs > 0) tcs.stunUntil = now + hammer.stunMs;
      }

      if (!playing) return; // lobby: no HP loss, no kills, no awards tracking
      const before = target.hp;
      target.hp = Math.max(0, target.hp - hammer.dmg);
      cs.damageDealt += before - target.hp;
      this.broadcast(ServerMsg.Hit, { id: tid, by: id, dmg: hammer.dmg, hp: target.hp } as HitEvent);
      if (target.hp <= 0) this.killPlayer(tid, id);
    });

    if (playing) this.checkWin();
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
      cs.diedAtMs = this.state.elapsedMs;
    }
    if (by) {
      const killer = this.state.players.get(by);
      if (killer) {
        killer.kills += 1;
        if (!this.firstBloodName) this.firstBloodName = killer.name;
      }
    }
    this.broadcast(ServerMsg.Died, { id, by } as DiedEvent);
    console.log(`[room ${this.roomId}] ☠ ${p.name} died (by ${by || "zone/wall"})`);
  }

  /** A dead player lobs a prank at a random survivor. Harasses; never eliminates. */
  private handlePrank(id: string, kind: PrankKind) {
    if (this.state.phase !== "playing") return;
    const sender = this.state.players.get(id);
    const cs = this.combat.get(id);
    if (!sender || sender.alive || !cs) return; // only the DEAD may prank
    const now = Date.now();
    if (now - cs.lastPrankAt < PRANK.cooldownMs) return;

    const alive: string[] = [];
    this.state.players.forEach((p, pid) => {
      if (p.alive) alive.push(pid);
    });
    if (alive.length === 0) return;
    cs.lastPrankAt = now;

    const tid = alive[Math.floor(Math.random() * alive.length)];
    const target = this.state.players.get(tid)!;
    const tcs = this.combat.get(tid);
    const a = Math.random() * Math.PI * 2;

    if (kind === "banana") {
      if (tcs) {
        tcs.vx += Math.cos(a) * PRANK.banana.knockback;
        tcs.vz += Math.sin(a) * PRANK.banana.knockback;
        tcs.stunUntil = now + PRANK.banana.stunMs;
      }
    } else {
      target.hp = Math.max(1, target.hp - PRANK.bomb.dmg); // floored — pranks don't kill
      if (tcs) {
        tcs.vx += Math.cos(a) * PRANK.bomb.knockback;
        tcs.vz += Math.sin(a) * PRANK.bomb.knockback;
        tcs.stunUntil = now + PRANK.bomb.stunMs;
      }
      this.broadcast(ServerMsg.Hit, { id: tid, by: "", dmg: PRANK.bomb.dmg, hp: target.hp } as HitEvent);
    }
    this.broadcast(ServerMsg.Prank, { id: tid, kind } as PrankEvent);
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
      this.state.awardsJson = JSON.stringify(this.computeAwards());
      this.state.standingsJson = JSON.stringify(this.computeStandings());
      this.state.phase = "ended";
      const w = this.state.players.get(last);
      console.log(`[room ${this.roomId}] 🏆 match ended — winner: ${w?.name ?? "—"}`);
    }
  }

  /**
   * Final placement for the Results screen: the winner first, then everyone else by
   * time-of-death (last to die ranks higher). This is per-match only — nothing is
   * persisted (the Host just leaves the screen up for the room to see).
   */
  private computeStandings(): Standing[] {
    const rows = [...this.state.players.entries()].map(([id, p]) => {
      const cs = this.combat.get(id);
      // alive (the winner) sorts to the very top; the rest by when they died
      const diedAt = cs && cs.diedAtMs >= 0 ? cs.diedAtMs : Number.POSITIVE_INFINITY;
      return { id, name: p.name, colorIndex: p.colorIndex, kills: p.kills, dmg: Math.round(cs?.damageDealt ?? 0), diedAt };
    });
    rows.sort((a, b) => {
      if (a.id === this.state.winnerId) return -1;
      if (b.id === this.state.winnerId) return 1;
      return b.diedAt - a.diedAt; // later death = better place
    });
    return rows.map((r, i) => ({ place: i + 1, name: r.name, colorIndex: r.colorIndex, kills: r.kills, dmg: r.dmg }));
  }

  /** Funny end-of-match awards from tracked stats. Skips any with no qualifier. */
  private computeAwards(): Award[] {
    const rows = [...this.state.players.entries()].map(([id, p]) => {
      const cs = this.combat.get(id);
      const survived = cs && cs.diedAtMs >= 0 ? cs.diedAtMs : this.state.elapsedMs;
      return {
        id,
        name: p.name,
        kills: p.kills,
        dmg: cs?.damageDealt ?? 0,
        slams: cs?.wallSlamsTaken ?? 0,
        survived,
      };
    });
    if (rows.length === 0) return [];

    const awards: Award[] = [];
    const best = <T,>(arr: T[], score: (t: T) => number) =>
      arr.reduce((a, b) => (score(b) > score(a) ? b : a));

    const topKills = best(rows, (r) => r.kills);
    if (topKills.kills > 0) {
      awards.push({ icon: "⚔️", label: "สังหารมากสุด", name: topKills.name, detail: `${topKills.kills} คิล` });
    }

    if (this.firstBloodName) {
      awards.push({ icon: "🩸", label: "เลือดหยดแรก", name: this.firstBloodName, detail: "" });
    }

    const winner = this.state.winnerId ? this.state.players.get(this.state.winnerId) : undefined;
    const survivor = winner ? { name: winner.name, survived: this.state.elapsedMs } : best(rows, (r) => r.survived);
    awards.push({ icon: "🛡️", label: "อยู่รอดนานสุด", name: survivor.name, detail: `${Math.round(survivor.survived / 1000)} วิ` });

    // pacifist: least damage dealt (tie → survived longest), only meaningful with ≥2 players
    if (rows.length >= 2) {
      const pacifist = rows.reduce((a, b) => (b.dmg < a.dmg || (b.dmg === a.dmg && b.survived > a.survived) ? b : a));
      awards.push({ icon: "🕊️", label: "สายรักสงบ", name: pacifist.name, detail: `ดาเมจ ${Math.round(pacifist.dmg)}` });
    }

    const topSlams = best(rows, (r) => r.slams);
    if (topSlams.slams > 0) {
      awards.push({ icon: "🧱", label: "โดนอัดกำแพงมากสุด", name: topSlams.name, detail: `${topSlams.slams} ครั้ง` });
    }

    return awards;
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
    this.stage = STAGES[this.selectedStageId] ?? STAGES[DEFAULT_STAGE_ID] ?? COLOSSEUM;
    this.state.stageId = this.stage.id;
    this.state.stageTheme = this.stage.theme;
    this.state.arenaRadius = this.stage.radius;
    this.state.zoneRadius = this.stage.radius;
    this.state.eventBanner = "";
    this.state.awardsJson = "";
    this.state.standingsJson = "";
    this.eventBannerUntil = 0;
    this.goldenFired = false;
    this.healFired = false;
    this.firstBloodName = "";

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
      p.kills = 0;
      this.inputs.set(id, { dx: 0, dz: 0 });
      this.combat.set(id, freshCombat());
    });
    this.aliveAtStart = n;
    this.state.winnerId = "";
  }

  private resetToLobby() {
    this.state.phase = "lobby";
    this.state.elapsedMs = -1;
    this.state.winnerId = "";
    this.state.arenaRadius = LOBBY_RADIUS;
    this.state.zoneRadius = LOBBY_RADIUS;
    this.state.eventBanner = "";
    this.state.awardsJson = "";
    this.state.standingsJson = "";
    this.aliveAtStart = 0;
    this.firstBloodName = "";
    this.inputs.clear();
    this.state.pickups.clear();
    this.pickupRespawnAt.clear();
    this.combat.forEach((cs, id) => this.combat.set(id, freshCombat()));
    this.state.players.forEach((p) => {
      p.hp = HP_MAX;
      p.alive = true;
      p.stunned = false;
      p.ready = false;
      p.hammer = DEFAULT_HAMMER;
      p.kills = 0;
    });
    this.state.players.forEach((_p, id) => this.spawnLobbyPlayer(id)); // re-scatter across the plaza
    console.log(`[room ${this.roomId}] ↺ reset to lobby`);
  }

  /** Place a player at a random spot on the plaza ring (waiting-room spawn). */
  private spawnLobbyPlayer(id: string) {
    const p = this.state.players.get(id);
    if (!p) return;
    const a = Math.random() * Math.PI * 2;
    const r = LOBBY_RADIUS * 0.5;
    p.x = Math.cos(a) * r;
    p.z = Math.sin(a) * r;
    p.dir = Math.atan2(-p.x, -p.z); // face the centre
    this.inputs.set(id, { dx: 0, dz: 0 });
  }

  /** Authoritative step — dispatches on phase (plaza vs. match). */
  private update(deltaMs: number) {
    if (this.state.phase === "lobby") this.updateLobby(deltaMs);
    else if (this.state.phase === "playing") this.updatePlaying(deltaMs);
  }

  /**
   * Plaza step: just walk + let knockback decay so bonks feel good. No zone, no
   * pickups, no wall-slam, no HP — the lobby is horseplay only.
   */
  private updateLobby(deltaMs: number) {
    const dt = deltaMs / 1000;
    const maxR = LOBBY_RADIUS - PLAYER_RADIUS;
    const now = Date.now();
    const decay = Math.exp(-KNOCKBACK_DECAY * dt);

    this.state.players.forEach((p, id) => {
      const cs = this.combat.get(id);
      const stunned = !!cs && now < cs.stunUntil;
      p.stunned = stunned;

      let x = p.x;
      let z = p.z;

      const input = this.inputs.get(id);
      if (!stunned && input && (input.dx !== 0 || input.dz !== 0)) {
        x += input.dx * MOVE_SPEED * dt;
        z += input.dz * MOVE_SPEED * dt;
        p.dir = Math.atan2(input.dx, input.dz);
      }

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

      // soft wall — clamp to the plaza edge, no slam damage
      const r = Math.hypot(x, z);
      if (r > maxR) {
        x = (x / r) * maxR;
        z = (z / r) * maxR;
        if (cs) {
          cs.vx = 0;
          cs.vz = 0;
        }
      }

      p.x = x;
      p.z = z;
    });
  }

  /** Match step: movement + knockback + wall-slam + zone + pickups + events. */
  private updatePlaying(deltaMs: number) {
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
          cs.wallSlamsTaken += 1;
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
