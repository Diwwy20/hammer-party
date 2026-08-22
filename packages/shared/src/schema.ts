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
  ready: "boolean",
  colorIndex: "number",
  hatIndex: "number",
  faceIndex: "number",
  backIndex: "number",
});

export class GameState extends Schema {
  declare players: MapSchema<Player>;
  declare phase: GamePhase;
  declare arenaRadius: number;
  /** ms since match start; -1 while in lobby */
  declare elapsedMs: number;

  /** Human-readable room code shown on the Host screen / used to join. */
  declare code: string;
  /** sessionId of the invisible Host (director on the big screen); "" if none. */
  declare hostSessionId: string;

  constructor() {
    super();
    this.players = new MapSchema<Player>();
    this.phase = "lobby";
    this.arenaRadius = ARENA_RADIUS;
    this.elapsedMs = -1;
    this.code = "";
    this.hostSessionId = "";
  }
}

defineTypes(GameState, {
  players: { map: Player },
  phase: "string",
  arenaRadius: "number",
  elapsedMs: "number",
  code: "string",
  hostSessionId: "string",
});
