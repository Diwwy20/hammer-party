import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import {
  ARENA_RADIUS,
  DEFAULT_BACK_INDEX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_FACE_INDEX,
  DEFAULT_HAMMER,
  DEFAULT_HAT_INDEX,
  HP_MAX,
  type GamePhase,
} from "./constants";

/**
 * Colyseus @colyseus/schema state — the "truth" the server owns and broadcasts
 * (binary delta) to every client. Only the SERVER instantiates these; the client
 * decodes via reflection.
 *
 * IMPORTANT: fields are declared with `declare` (type-only, emits NO code) and
 * initialized in the constructor. This is deliberate:
 *   - `defineTypes()` installs change-tracking accessors on the prototype.
 *   - A normal class field (`x = 0`) under useDefineForClassFields:true would emit
 *     an own-property that SHADOWS those accessors → nothing gets encoded.
 *   - `declare` + constructor-assignment routes every write through the accessors,
 *     regardless of how the bundler (esbuild/tsx/tsc) treats class fields.
 */

export type { GamePhase };

export class Player extends Schema {
  declare name: string;

  // transform (Phase 01 fills these from input)
  declare x: number;
  declare z: number;
  declare dir: number;

  // combat (Phase 02)
  declare hp: number;
  declare alive: boolean;
  declare hammer: string;
  /** Frozen by a heavy hit — the client suppresses self-prediction while true. */
  declare stunned: boolean;
  /** false while a dropped player's seat is held open for a reconnect. */
  declare connected: boolean;

  // lobby / cosmetics
  declare ready: boolean;
  declare colorIndex: number;
  declare hatIndex: number;
  declare faceIndex: number;
  declare backIndex: number;

  constructor() {
    super();
    this.name = "";
    this.x = 0;
    this.z = 0;
    this.dir = 0;
    this.hp = HP_MAX;
    this.alive = true;
    this.hammer = DEFAULT_HAMMER;
    this.stunned = false;
    this.connected = true;
    this.ready = false;
    this.colorIndex = DEFAULT_COLOR_INDEX;
    this.hatIndex = DEFAULT_HAT_INDEX;
    this.faceIndex = DEFAULT_FACE_INDEX;
    this.backIndex = DEFAULT_BACK_INDEX;
  }
}

defineTypes(Player, {
  name: "string",
  x: "number",
  z: "number",
  dir: "number",
  hp: "number",
  alive: "boolean",
  hammer: "string",
  stunned: "boolean",
  connected: "boolean",
  ready: "boolean",
  colorIndex: "number",
  hatIndex: "number",
  faceIndex: "number",
  backIndex: "number",
});

/**
 * A collectible on the map: a weapon (fast/heavy), or an event item (golden/heal).
 * `active` toggles off when taken (weapons respawn on a timer; event items don't).
 */
export class Pickup extends Schema {
  declare kind: string;
  declare x: number;
  declare z: number;
  declare active: boolean;

  constructor() {
    super();
    this.kind = "fast";
    this.x = 0;
    this.z = 0;
    this.active = true;
  }
}

defineTypes(Pickup, {
  kind: "string",
  x: "number",
  z: "number",
  active: "boolean",
});

export class GameState extends Schema {
  declare players: MapSchema<Player>;
  declare pickups: MapSchema<Pickup>;
  declare phase: GamePhase;
  declare arenaRadius: number;
  /** current safe-zone radius (m); shrinks over the match. Equals arenaRadius in lobby. */
  declare zoneRadius: number;
  /** ms since match start; -1 while in lobby */
  declare elapsedMs: number;

  /** active stage id + theme (client renders visuals from the theme). */
  declare stageId: string;
  declare stageTheme: string;

  /** transient event toast (e.g. "⚡ ค้อนทองคำปรากฏ!"); "" when nothing to show. */
  declare eventBanner: string;

  /** Human-readable room code shown on the Host screen / used to join. */
  declare code: string;
  /** sessionId of the invisible Host (director on the big screen); "" if none. */
  declare hostSessionId: string;
  /** sessionId of the winner once phase==="ended" (""=no survivor / not decided). */
  declare winnerId: string;

  constructor() {
    super();
    this.players = new MapSchema<Player>();
    this.pickups = new MapSchema<Pickup>();
    this.phase = "lobby";
    this.arenaRadius = ARENA_RADIUS;
    this.zoneRadius = ARENA_RADIUS;
    this.elapsedMs = -1;
    this.stageId = "";
    this.stageTheme = "";
    this.eventBanner = "";
    this.code = "";
    this.hostSessionId = "";
    this.winnerId = "";
  }
}

defineTypes(GameState, {
  players: { map: Player },
  pickups: { map: Pickup },
  phase: "string",
  arenaRadius: "number",
  zoneRadius: "number",
  elapsedMs: "number",
  stageId: "string",
  stageTheme: "string",
  eventBanner: "string",
  code: "string",
  hostSessionId: "string",
  winnerId: "string",
});
