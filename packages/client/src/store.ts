import { create } from "zustand";
import {
  ARENA_RADIUS,
  DEFAULT_BACK_INDEX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_FACE_INDEX,
  DEFAULT_HAT_INDEX,
  type GamePhase,
} from "@hammer/shared";

/** Client connection lifecycle (distinct from the server-side game phase). */
export type Conn = "idle" | "connecting" | "open" | "reconnecting" | "error";

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
  // combat (Phase 02)
  hp: number;
  alive: boolean;
  hammer: string;
  stunned: boolean;
  connected: boolean;
  kills: number;
}

/** A map collectible mirrored out of room.state (weapon or event item). */
export interface PickupView {
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
  // Phase 03: arena / zone / weapons
  pickups: Record<string, PickupView>;
  arenaRadius: number;
  zoneRadius: number;
  stageId: string;
  stageTheme: string;
  eventBanner: string;
  awardsJson: string;
  standingsJson: string;

  set: (patch: Partial<GameStore>) => void;
  reset: () => void;
}

const initial = {
  conn: "idle" as Conn,
  booted: false,
  error: undefined as string | undefined,
  isHost: false,
  roomId: undefined as string | undefined,
  sessionId: undefined as string | undefined,
  code: "",
  phase: "lobby" as GamePhase,
  hostSessionId: "",
  winnerId: "",
  players: {} as Record<string, PlayerView>,
  pickups: {} as Record<string, PickupView>,
  arenaRadius: ARENA_RADIUS,
  zoneRadius: ARENA_RADIUS,
  stageId: "",
  stageTheme: "",
  eventBanner: "",
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
