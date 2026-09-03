import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import {
  DEFAULT_BACK_INDEX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_FACE_INDEX,
  DEFAULT_HAIR_INDEX,
  DEFAULT_HAMMER,
  DEFAULT_HAT_INDEX,
  HP_MAX,
  LOBBY_RADIUS,
} from "./constants";
import {
  GamePhase,
  HazardKind,
  HazardPhase,
  PickupKind,
  WeatherKind,
  type EventKind,
  type StageId,
  type StageTheme,
} from "./enums";
import { COLOSSEUM, DEFAULT_STAGE_ID } from "./stages";

/**
 * Colyseus @colyseus/schema state — the "truth" the server owns and broadcasts
 * (binary delta) to every client. Only the SERVER instantiates these; the client
 * decodes via reflection.
 *
 * Sync ONLY what clients must agree on. Server-only simulation state (knockback
 * velocity, cooldown stamps, per-match stats) lives in `server/src/game/`, never here.
 *
 * IMPORTANT: fields are declared with `declare` (type-only, emits NO code) and
 * initialized in the constructor. This is deliberate:
 *   - `defineTypes()` installs change-tracking accessors on the prototype.
 *   - A normal class field (`x = 0`) under useDefineForClassFields:true would emit
 *     an own-property that SHADOWS those accessors → nothing gets encoded.
 *   - `declare` + constructor-assignment routes every write through the accessors,
 *     regardless of how the bundler (esbuild/tsx/tsc) treats class fields.
 */

/** Sentinel for the "no session" schema fields (winner / host / active event). */
export const NO_SESSION = "";

/** `elapsedMs` while no match is running (lobby / results). */
export const NOT_STARTED_MS = -1;

export class Player extends Schema {
  declare name: string;

  // transform (server-simulated, client-interpolated)
  declare x: number;
  declare z: number;
  declare dir: number;

  // combat
  declare hp: number;
  declare alive: boolean;
  /** current weapon — always a `HammerKind` value. */
  declare hammer: string;
  /** Frozen by a heavy hit — the client suppresses self-prediction while true. */
  declare stunned: boolean;
  /** false while a dropped player's seat is held open for a reconnect. */
  declare connected: boolean;
  /** kills this match (awards + live scoreboard). */
  declare kills: number;

  // lobby / cosmetics
  declare ready: boolean;
  declare colorIndex: number;
  declare hairIndex: number;
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
    this.kills = 0;
    this.ready = false;
    this.colorIndex = DEFAULT_COLOR_INDEX;
    this.hairIndex = DEFAULT_HAIR_INDEX;
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
  kills: "number",
  ready: "boolean",
  colorIndex: "number",
  hairIndex: "number",
  hatIndex: "number",
  faceIndex: "number",
  backIndex: "number",
});

/**
 * A collectible on the map: a weapon (fast/heavy), or an event item (golden/heal).
 * `active` toggles off when taken (weapons respawn on a timer; event items don't).
 */
export class Pickup extends Schema {
  /** always a `PickupKind` value. */
  declare kind: string;
  declare x: number;
  declare z: number;
  declare active: boolean;

  constructor() {
    super();
    this.kind = PickupKind.Fast;
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

/**
 * A telegraphed environmental danger (a meteor strike). It is SYNCED rather than
 * broadcast as an FX message because the warning circle is playable information:
 * every client must see the same danger in the same spot for the same length of
 * time, and a late joiner must see the ones already on the floor.
 */
export class Hazard extends Schema {
  /** always a `HazardKind` value. */
  declare kind: string;
  /** always a `HazardPhase` value — the warning, then the aftermath. */
  declare phase: string;
  declare x: number;
  declare z: number;
  /** blast radius (m) — the client draws the marker at exactly this size. */
  declare radius: number;

  constructor() {
    super();
    this.kind = HazardKind.Meteor;
    this.phase = HazardPhase.Warn;
    this.x = 0;
    this.z = 0;
    this.radius = 0;
  }
}

defineTypes(Hazard, {
  kind: "string",
  phase: "string",
  x: "number",
  z: "number",
  radius: "number",
});

export class GameState extends Schema {
  declare players: MapSchema<Player>;
  declare pickups: MapSchema<Pickup>;
  /** live meteor strikes: warning markers and the ones that just landed. */
  declare hazards: MapSchema<Hazard>;
  declare phase: GamePhase;

  /** physical wall radius (m) — the plaza in lobby, the stage's radius in a match. */
  declare arenaRadius: number;
  /** current safe-zone radius (m); shrinks over the match. Equals arenaRadius in lobby. */
  declare zoneRadius: number;
  /** ms since match start; `NOT_STARTED_MS` while in the lobby. */
  declare elapsedMs: number;

  /** active stage id + theme (client renders visuals from the theme). */
  declare stageId: StageId;
  declare stageTheme: StageTheme;

  /**
   * The event whose banner is currently up, or `NO_SESSION` for none. The server
   * publishes the KIND; the client owns the wording (see `config/copy.ts`).
   */
  declare activeEvent: EventKind | typeof NO_SESSION;

  /**
   * Current weather. Not decoration: rain makes the floor slick on the SERVER too,
   * so both sides must agree on it.
   */
  declare weather: WeatherKind;

  /** end-of-match `MatchAward[]` as JSON (computed once when the phase ends); "" otherwise. */
  declare awardsJson: string;

  /** end-of-match `MatchStanding[]` as JSON (ranked winner-first); "" otherwise. */
  declare standingsJson: string;

  /** Human-readable room code shown on the Host screen / used to join. */
  declare code: string;
  /** sessionId of the invisible Host (director on the big screen); "" if none. */
  declare hostSessionId: string;
  /** sessionId of the winner once the match has ended ("" = no survivor / not decided). */
  declare winnerId: string;

  constructor() {
    super();
    this.players = new MapSchema<Player>();
    this.pickups = new MapSchema<Pickup>();
    this.hazards = new MapSchema<Hazard>();
    this.phase = GamePhase.Lobby;
    this.arenaRadius = LOBBY_RADIUS;
    this.zoneRadius = LOBBY_RADIUS;
    this.elapsedMs = NOT_STARTED_MS;
    this.stageId = DEFAULT_STAGE_ID;
    this.stageTheme = COLOSSEUM.theme;
    this.activeEvent = NO_SESSION;
    this.weather = WeatherKind.Clear;
    this.awardsJson = "";
    this.standingsJson = "";
    this.code = "";
    this.hostSessionId = NO_SESSION;
    this.winnerId = NO_SESSION;
  }
}

defineTypes(GameState, {
  players: { map: Player },
  pickups: { map: Pickup },
  hazards: { map: Hazard },
  phase: "string",
  arenaRadius: "number",
  zoneRadius: "number",
  elapsedMs: "number",
  stageId: "string",
  stageTheme: "string",
  activeEvent: "string",
  weather: "string",
  awardsJson: "string",
  standingsJson: "string",
  code: "string",
  hostSessionId: "string",
  winnerId: "string",
});
