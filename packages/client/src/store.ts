import { create } from "zustand";
import {
  ARENA_RADIUS,
  DEFAULT_BACK_INDEX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_FACE_INDEX,
  DEFAULT_HAMMER,
  DEFAULT_HAT_INDEX,
  DEFAULT_STAGE_ID,
  GamePhase,
  HP_MAX,
  StageTheme,
  type EventKind,
  type StageId,
} from "@hammer/shared";

/**
 * The client's single store: a flattened, render-friendly mirror of the room state
 * plus the connection lifecycle. Written only by `net/session.ts`.
 *
 * Deliberately NOT in here: player positions and combat FX. Those arrive 20×/s and
 * are read per-frame by the renderer (`net/movement.ts`, `runtime/combatFx.ts`) — putting
 * them in the store would re-render React twenty times a second.
 */

/** Client connection lifecycle (distinct from the server-side game phase). */
export type Conn = "idle" | "connecting" | "open" | "reconnecting" | "error";

export const Conn = {
  Idle: "idle",
  Connecting: "connecting",
  Open: "open",
  Reconnecting: "reconnecting",
  Error: "error",
} as const;

/** A flattened, render-friendly view of a Player mirrored out of room.state. */
export interface PlayerView {
  name: string;
  x: number;
  z: number;
  ready: boolean;
  colorIndex: number;
  hatIndex: number;
  faceIndex: number;
  backIndex: number;
  hp: number;
  alive: boolean;
  /** a `HammerKind` value (decoded as a plain string off the wire). */
  hammer: string;
  stunned: boolean;
  connected: boolean;
  kills: number;
}

/** A map collectible mirrored out of room.state (weapon or event item). */
export interface PickupView {
  /** a `PickupKind` value. */
  kind: string;
  x: number;
  z: number;
  active: boolean;
}

/** Just the cosmetic slots — what AvatarBody (three/cosmetics.tsx) needs to draw an avatar. */
export interface Cosmetic {
  colorIndex: number;
  hatIndex: number;
  faceIndex: number;
  backIndex: number;
}

interface GameStore {
  conn: Conn;
  /** false until the entry splash/loading screen has finished. */
  booted: boolean;
  error?: string;
  /** true when THIS client is the big-screen Host (director, not a player). */
  isHost: boolean;
  roomId?: string;
  sessionId?: string;

  // mirrored from GameState
  code: string;
  phase: GamePhase;
  hostSessionId: string;
  winnerId: string;
  players: Record<string, PlayerView>;
  pickups: Record<string, PickupView>;
  arenaRadius: number;
  zoneRadius: number;
  stageId: StageId;
  stageTheme: string;
  /** the event whose banner is up, or "" for none. */
  activeEvent: EventKind | "";
  awardsJson: string;
  standingsJson: string;

  set: (patch: Partial<GameStore>) => void;
  reset: () => void;
}

const initial = {
  conn: Conn.Idle as Conn,
  booted: false,
  error: undefined as string | undefined,
  isHost: false,
  roomId: undefined as string | undefined,
  sessionId: undefined as string | undefined,
  code: "",
  phase: GamePhase.Lobby as GamePhase,
  hostSessionId: "",
  winnerId: "",
  players: {} as Record<string, PlayerView>,
  pickups: {} as Record<string, PickupView>,
  arenaRadius: ARENA_RADIUS,
  zoneRadius: ARENA_RADIUS,
  stageId: DEFAULT_STAGE_ID as StageId,
  stageTheme: StageTheme.Colosseum as string,
  activeEvent: "" as EventKind | "",
  awardsJson: "",
  standingsJson: "",
};

export const useGame = create<GameStore>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  reset: () => set({ ...initial }),
}));

/** Fallback cosmetics before the server echoes our own player back. */
export const FALLBACK_COSMETIC: Cosmetic = {
  colorIndex: DEFAULT_COLOR_INDEX,
  hatIndex: DEFAULT_HAT_INDEX,
  faceIndex: DEFAULT_FACE_INDEX,
  backIndex: DEFAULT_BACK_INDEX,
};

// ── Selectors ───────────────────────────────────────────────────────────────
// Every selector returns a PRIMITIVE (or a stable string key). Zustand compares
// the result by identity, so a 20Hz state patch that didn't change the value does
// not re-render the component that reads it.

type Store = GameStore;

/** This client's own player row, or undefined for the Host / before we're seated. */
export const selectMe = (s: Store): PlayerView | undefined =>
  s.sessionId ? s.players[s.sessionId] : undefined;

/** Alive is optimistic (`true`) until the server has told us otherwise. */
export const selectMeAlive = (s: Store): boolean => selectMe(s)?.alive ?? true;
export const selectMeStunned = (s: Store): boolean => selectMe(s)?.stunned ?? false;
export const selectMeHp = (s: Store): number => selectMe(s)?.hp ?? HP_MAX;
export const selectMeHammer = (s: Store): string => selectMe(s)?.hammer ?? DEFAULT_HAMMER;
export const selectMeReady = (s: Store): boolean => selectMe(s)?.ready ?? false;

export const selectPlayerCount = (s: Store): number => Object.keys(s.players).length;
export const selectAliveCount = (s: Store): number =>
  Object.values(s.players).filter((p) => p.alive).length;
export const selectReadyCount = (s: Store): number =>
  Object.values(s.players).filter((p) => p.ready).length;
export const selectHasHost = (s: Store): boolean => s.hostSessionId !== "";

/** A stable "|"-joined key of the player ids — changes only when someone joins/leaves. */
export const selectPlayerIdsKey = (s: Store): string => Object.keys(s.players).sort().join("|");

/** Signature of which pickups exist and whether they're taken (they never move). */
export const selectPickupsKey = (s: Store): string =>
  Object.keys(s.pickups)
    .map((id) => `${id}${s.pickups[id].active ? "1" : "0"}`)
    .join("|");

/**
 * Read one field off a player row. Returning a primitive is what keeps a 20Hz state
 * patch from re-rendering every avatar in the arena.
 */
export function usePlayerField<T>(id: string, pick: (player: PlayerView | undefined) => T): T {
  return useGame((s) => pick(s.players[id]));
}

/** Split a key produced by `selectPlayerIdsKey` back into ids. */
export const idsFromKey = (key: string): string[] => (key ? key.split("|") : []);
