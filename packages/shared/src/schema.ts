import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { ARENA_RADIUS, DEFAULT_HAMMER, HP_MAX } from "./constants";

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

export type GamePhase = "lobby" | "playing" | "ended";

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
    this.colorIndex = 0;
    this.hatIndex = 0;
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
});

export class GameState extends Schema {
  declare players: MapSchema<Player>;
  declare phase: GamePhase;
  declare arenaRadius: number;
  /** ms since match start; -1 while in lobby */
  declare elapsedMs: number;

  constructor() {
    super();
    this.players = new MapSchema<Player>();
    this.phase = "lobby";
    this.arenaRadius = ARENA_RADIUS;
    this.elapsedMs = -1;
  }
}

defineTypes(GameState, {
  players: { map: Player },
  phase: "string",
  arenaRadius: "number",
  elapsedMs: "number",
});
